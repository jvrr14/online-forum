# online-forum

## Database schemas

This project uses Drizzle ORM with PostgreSQL. Table definitions live in
`src/db/schema/`. Each table gets its own schema module, following
the project's focused modules such as `user.repository.ts`.

`src/db/schema/index.ts` is a barrel file: it re-exports tables and their inferred
types from the individual modules. This gives consumers a single schema entry
point. A plain import would only make a definition available inside `index.ts`;
a re-export also makes it available to modules that import from `index.ts`.
`drizzle.config.ts` points Drizzle Kit at this entry point to discover the tables.

The connection uses `DATABASE_URL` through `src/db/client.ts`. Drizzle infers
TypeScript types directly from the schema, so no Prisma client generator is needed.

The Prisma `User` model is represented by the `users` table:

- `id` is an integer primary key. PostgreSQL generates increasing IDs when one
  is omitted; an explicit ID is also allowed.
- `username` is required and has a database limit of 100 characters.
- `email` is required text with a unique constraint, so duplicate stored values
  are rejected. Email format validation belongs to the request validation layer.
- Prisma's `password` maps to `passwordHash` (`password_hash`), a required
  `varchar(100)` following this repo's credential naming convention. User creation
  requires an already-hashed `passwordHash`; the registration service hashes
  passwords separately. User responses explicitly omit this field,
  and the general user update endpoint does not accept credential changes.
  Express also globally strips `passwordHash` and `password_hash` keys from JSON
  responses, including nested objects and arrays, using its `json replacer`
  setting in `src/app.ts`. Unlike Prisma's client-level `omit`, this safeguard
  runs during response serialization; database queries still require explicit
  public columns, and authentication queries can explicitly select the hash.
- `role` is a required PostgreSQL enum (`USER`, `ADMIN`, `MODERATOR`) and defaults
  to `USER`, including for existing users when the migration is applied.
- `createdAt` maps to `created_at` and defaults to the database's current time.
- `updatedAt` maps to `updated_at`, defaults to the current time on insert, and
  gets a new JavaScript `Date` on Drizzle updates when no value is supplied.
  This hook is not a database trigger: raw SQL updates must set it explicitly.

Both timestamps use millisecond precision and no time zone, matching the original
Prisma PostgreSQL `DateTime` fields. `.notNull()` preserves Prisma's required
fields. `User` describes a selected row; `NewUser` describes an insert, where
fields with defaults can be omitted.

Public user selections live in `src/db/projections/users.ts`. Use
`publicUserFields` for SQL selections and write results, and `publicUserColumns`
for relational queries. Nested post authors use `postAuthorFields` or
`postAuthorWithEmailFields` and their corresponding `Columns` exports for
relational queries. These allowlists also define `PublicUser`, `PostAuthor`, and
`PostAuthorWithEmail`, keeping response types in sync with selected fields. Adding
a database column does not automatically expose it through these projections.

`src/db/queries/user-credentials.ts` provides the separate internal
`findUserCredentialsByEmail` lookup, selecting only the user ID and password hash.
Its result is for credential verification and must never be returned by a route.
API routes should pass response objects to `res.json()`; pre-serialized JSON
strings bypass the global JSON filter.

The Prisma `Post` model is represented by the `posts` table:

- `id` uses the same generated integer primary key as `users`.
- `title` is required and limited to 255 characters; `content` is nullable text.
- `published` is required and defaults to `false`; `views` is required and defaults to `0`.
- `authorId` maps to `author_id`, is required, and references `users.id`.
  Deleting a user also deletes their posts through the database foreign key.
- Separate indexes cover `author_id` and `published`.
- `createdAt` and `updatedAt` follow the same timestamp conventions as `users`.

The Prisma `Profile` model is represented by the `profiles` table:

- `id` uses a generated integer primary key; `bio` is required text.
- `avatar` is nullable and limited to 500 characters.
- `userId` maps to `user_id` and is required, unique, and references `users.id`.
  A user can have zero or one profile. Deleting a user also deletes their profile.

The Prisma `Category` model is represented by the `categories` table, with a
generated integer `id` and a required, unique `name` limited to 100 characters.

The `post_categories` join table stores the many-to-many relationship between
posts and categories. Its composite primary key (`post_id`, `category_id`)
prevents duplicate associations, and an index on `category_id` supports reverse
lookups. Deleting either a post or a category removes its associations; deleting
a category does not delete posts.

Each table exports inferred select and insert types (for example, `Post` and
`NewPost`); `Role` is inferred from the enum. The relations in
`src/db/relations.ts` expose `users.posts`, nullable `users.profile`,
required `profiles.user` and `posts.author`, and the arrays `posts.categories`
and `categories.posts` through Drizzle's relational query API. They are exported
by the relations module and registered with the database client. Relation
properties are query results, not additional database columns. The many-to-many
relations use Drizzle's `through` mapping, following the
[official relations documentation](https://orm.drizzle.team/docs/relations#many-to-many).

The Prisma `RefreshToken` model is represented by `refresh_tokens`:

- `id` uses the same generated integer primary key as `users`.
- `token` is required text with a unique constraint.
- `userId` maps to `user_id`, is required, and references `users.id` with cascade
  deletion. Deleting a user also deletes their refresh tokens.
- `expiresAt` maps to `expires_at` and is required; `createdAt` maps to
  `created_at` and defaults to the database's current time. Both timestamps use
  millisecond precision and no time zone, matching Prisma's PostgreSQL `DateTime`.
- Separate indexes cover `user_id` and `expires_at`.

The schema barrel exports `refreshTokens`, `RefreshToken`, and `NewRefreshToken`.
The relations module exposes `users.refreshTokens` and required `refreshTokens.user`;
these relations do not add columns. Registration and login create refresh-token records;
refresh-token rotation and expiry enforcement are not implemented.

Run `npm run db:generate` after changing the schema to create a SQL migration.
Review the generated SQL, then run `npm run db:migrate` to apply it to the database
configured by `DATABASE_URL`. Generating a migration does not change the database.
The migration adding `password_hash` first adds a nullable column, backfills
existing users with the disabled-password marker `!password-reset-required`, and
then enforces `NOT NULL`. Existing records are preserved, but those users need a
real password hash set before password login can work. This is a migration
backfill only: no database default or shared login password is added, and new
users must still supply a hash. Authentication code must treat this marker as a
disabled credential rather than passing it to a password verifier. Drizzle's
migrator runs the statements in a transaction. If the earlier migration failed
with a not-null violation, rerun `npm run db:migrate` after this correction.

## Authentication service

`src/modules/auth/auth.service.ts` exports `registerUser` and `loginUser`. Their
input types come from `auth.schemas.ts`; parse requests with `registerSchema` or
`loginSchema` before calling the corresponding service. Registration trims usernames,
validates email addresses, requires passwords of 8–128 characters without trimming
them, and rejects unknown fields,
including client-supplied roles. New users receive the database's default `USER` role.

Registration hashes passwords with Argon2id before opening a transaction. The
transaction creates the user, signs a 15-minute access token and a 7-day refresh
token through `src/lib/jwt.ts`, and stores the refresh token with the JWT's exact
expiration time. The response contains `{ user, accessToken, refreshToken }`;
`user` selects only public columns. Duplicate emails produce `ConflictError`
(`EMAIL_CONFLICT`, HTTP 409), and token signing or storage failures roll back the
new user. These are deliberate improvements over the book's separate writes.

Login accepts a valid email and a nonempty password of at most 128 characters,
without trimming the password. It uses the internal credential lookup and verifies
the password with Argon2. Missing users, disabled-password markers, and incorrect
passwords produce the same `UnauthorizedError` (`INVALID_CREDENTIALS`, HTTP 401).
Unexpected password-verification failures remain internal server errors.

Verification happens before opening a transaction. Login then selects only public
user columns and rechecks the password hash under a shared row lock, rejecting a
user deleted or a password changed during verification. The lock prevents updates
or deletion until the refresh-token record is stored. Registration and login share
the token-signing and refresh-token persistence helper.

`src/modules/auth/auth.routes.ts` exports the named `authRouter`, mounted at
`/api/v1/auth` through the existing API router. It exposes:

- `POST /api/v1/auth/register`: validates the body and returns HTTP 201.
- `POST /api/v1/auth/login`: validates the body and returns HTTP 200.

Both handlers read parsed input from `res.locals.body` and return only
`{ user, accessToken }` with `Cache-Control: no-store`. The refresh token is set
through `src/lib/cookies.ts` as a `refreshToken` cookie with `HttpOnly`,
`SameSite=Strict`, `Secure` in production, and a path of `/api/v1/auth`. Its 7-day
maximum age shares the refresh JWT's lifetime constant. The versioned route
prefix follows this project's conventions rather than the book's `/api/auth`.

The strict SameSite policy assumes the frontend and API are on the same site.
The existing default CORS configuration does not enable credentialed cross-origin
browser requests. A frontend on a different origin will need an explicit allowed
origin, server-side CORS credentials, and client requests with credentials included.
Token verification, refresh-token rotation, and logout are separate work.

## Database seeding

After configuring `.env` (see `.env.example`), run:

```sh
npm run db:migrate
npm run db:seed
```

`SEED_USER_PASSWORD_HASH` is optional. If omitted, the sample user receives the
disabled-password marker `!password-reset-required`. To supply a usable credential,
set this variable to an already-hashed password of 1–100 characters before seeding.
Empty or oversized values are rejected before any data is deleted, with the
environment variable name included in the validation error.

`src/db/seed.ts` uses the existing Drizzle client and environment validation,
including the required `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`.
It deletes all users and categories from the configured database, relying on
foreign-key cascades to remove posts, profiles, and post/category links,
then creates the book's sample data: the TypeScript
category, the admin `jon` (`jon@example.com`), his "Full-stack developer" profile,
and his published "Getting Started with TypeScript" post with 142 views linked
to that category. Running it again replaces the data; generated IDs are not reset.

Unlike the Prisma example's separate cleanup and creation steps, cleanup and all
inserts share one transaction, so a failed seed restores the previous data.
The script closes the database pool on success or failure and exits with a
nonzero status on failure. Cleanup errors are logged separately so they do not
hide a seeding error.

The current API repositories still use temporary in-memory storage. Defining and
migrating a table prepares persistence; querying it from the repositories is the
next step.
