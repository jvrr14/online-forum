# online-forum

## Project layout

- `src/` – application code: `modules/` (routes, schemas, services per feature),
  `db/` (schema, relations, projections, seed), `lib/`, `middleware/`, `jobs/`, `config/`.
- `drizzle/` – generated SQL migrations and snapshots.
- `dist/` – build output (`npm run build`, git-ignored).

The repository has no test suite or placeholder test/data directories.

## Database schemas

This project uses Drizzle ORM with PostgreSQL. Table definitions live in
`src/db/schema/`. Each table gets its own schema module (for example
`user.schema.ts`), mirroring the focused modules used elsewhere in the project.

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
  are rejected. All API email inputs are trimmed and lowercased before validation
  and storage through `src/lib/email.ts`; direct service writes and credential
  lookups use the same normalizer. Raw SQL writers must also normalize emails.
  Username uniqueness is not enforced by the current schema.
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
- `tokenHash` maps to `token_hash`, required text with a unique constraint. It holds
  the lowercase SHA-256 hex digest of the UTF-8 refresh token, never the raw JWT.
  `src/lib/token-hash.ts` provides the shared digest for insert, refresh, and logout.
- `userId` maps to `user_id`, is required, and references `users.id` with cascade
  deletion. Deleting a user also deletes their refresh tokens.
- `expiresAt` maps to `expires_at` and is required; `createdAt` maps to
  `created_at` and defaults to the database's current time. Both timestamps use
  millisecond precision and no time zone, matching Prisma's PostgreSQL `DateTime`.
- Separate indexes cover `user_id` and `expires_at`.

The schema barrel exports `refreshTokens`, `RefreshToken`, and `NewRefreshToken`.
The relations module exposes `users.refreshTokens` and required `refreshTokens.user`;
these relations do not add columns. Registration and login create refresh-token records;
refresh rotates them atomically and checks both JWT and stored expiration times.

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

The `20261016061319_harden_auth_storage` migration renames `token` to `token_hash`
and hashes every existing token in place using PostgreSQL's built-in
[`sha256` and `encode`](https://www.postgresql.org/docs/current/functions-binarystring.html).
Existing refresh cookies continue to match after migration, with their original
expiration dates. The same migration normalizes stored emails and updates timestamps
for changed accounts. If normalization would merge case/space variants of different
accounts, it aborts before changing data; resolve those accounts explicitly and
rerun it. It never merges users or drops their sessions. No pgcrypto extension is
needed. Stop the old API, run `npm run db:migrate`, then start the updated API;
old and new binaries require different column names and must not run together.
Migration generation does not apply these changes to any database.

## Authentication service

`src/modules/auth/auth.service.ts` exports `registerUser` and `loginUser`. Their
input types come from `auth.schemas.ts`; parse requests with `registerSchema` or
`loginSchema` before calling the corresponding service. Registration trims usernames,
trims/lowercases and validates email addresses, requires passwords of 8–128 characters without trimming
them, and rejects unknown fields,
including client-supplied roles. New users receive the database's default `USER` role.

Registration hashes passwords with Argon2id before opening a transaction. The
transaction creates the user, signs a 15-minute access token and a 7-day refresh
token through `src/lib/jwt.ts`, and stores the refresh token's SHA-256 digest with the JWT's exact
expiration time. The response contains `{ user, accessToken, refreshToken }`;
`user` selects only public columns. Duplicate emails produce `ConflictError`
(`EMAIL_CONFLICT`, HTTP 409), and token signing or storage failures roll back the
new user. An email-targeted `ON CONFLICT DO NOTHING` identifies duplicate emails
without examining constraint names. Other registration `23505` errors and ambiguous
user-update uniqueness errors become `USER_CONFLICT` (HTTP 409). User creation
retains `EMAIL_CONFLICT` for its email-targeted conflict. These are deliberate
improvements over the book's separate writes.

Login accepts a valid email and a nonempty password of at most 128 characters,
without trimming the password. It uses the internal credential lookup and verifies
the password with Argon2. Missing users, disabled-password markers, and incorrect
passwords produce the same `UnauthorizedError` (`INVALID_CREDENTIALS`, HTTP 401).
Every login performs one Argon2 verification: absent and disabled accounts use a
dummy hash generated once before requests are handled. `src/lib/password.ts` pins
the same Argon2id settings for registration and the dummy: 64 MiB memory, three
passes, four lanes, a 32-byte output, and version 19. This removes the obvious early
return timing difference described in the
[OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
It does not guarantee identical request times; externally supplied or legacy hashes
may encode different costs. Admin-created and seeded hashes should follow this policy.
Unexpected password-verification failures remain internal server errors.

Verification happens before opening a transaction. Login then selects only public
user columns and rechecks the password hash under a shared row lock, rejecting a
user deleted or a password changed during verification. The lock prevents updates
or deletion until the refresh-token record is stored. Registration and login share
the token-signing and refresh-token persistence helper.
`createRefreshToken` returns `{ token, expiresAt }`, with both the JWT `exp` and
the database timestamp derived from one integer-second expiration value. Each
refresh JWT still has a random `jti`; no decode step is needed after signing.

`src/modules/auth/auth.routes.ts` exports the named `authRouter`, mounted at
`/api/v1/auth` through the existing API router. It exposes:

- `POST /api/v1/auth/register`: validates the body and returns HTTP 201.
- `POST /api/v1/auth/login`: validates the body and returns HTTP 200.
- `POST /api/v1/auth/refresh`: reads the refresh cookie, rotates it, and returns
  `{ accessToken }` with HTTP 200.
- `POST /api/v1/auth/logout`: deletes the cookie's stored token if present, clears
  the cookie, and returns HTTP 204, including when already logged out.
- `DELETE /api/v1/auth/sessions`: requires an access token, deletes every refresh
  token for the authenticated user, clears the cookie, and returns HTTP 204.

Registration and login read parsed input from `res.locals.body` and return only
`{ user, accessToken }` with `Cache-Control: no-store`. The refresh token is set
through `src/lib/cookies.ts` as a `refreshToken` cookie with `HttpOnly`,
`SameSite=Strict`, `Secure` in production, and a path of `/api/v1/auth`. Its 7-day
maximum age shares the refresh JWT's lifetime constant. The versioned route
prefix follows this project's conventions rather than the book's `/api/auth`.

The strict SameSite policy assumes the frontend and API are on the same site.
CORS allows credentialed cross-origin browser requests from `http://localhost:5173`.
Frontend requests must include credentials (for example, `credentials: "include"`
with `fetch`) to send and receive refresh cookies.

Access and refresh secrets must be distinct; environment validation rejects equal
values. JWT verification pins HS256 and requires a JWT header type plus `sub`,
`exp`, `iat`, and `jti`. Subjects must be positive PostgreSQL integer IDs; access
roles must match the database's `Role` enum. These options follow the
[jose verification API](https://github.com/panva/jose/blob/main/docs/jwt/verify/interfaces/JWTVerifyOptions.md).
Missing/malformed authorization headers produce `UNAUTHORIZED`, expired tokens
produce `TOKEN_EXPIRED`, and invalid signatures or claims produce `INVALID_TOKEN`.
All use HTTP 401 through the existing central error response:
`{ error: { code, message, requestId } }`. This preserves the project's response
format rather than the book's top-level error string.

Refresh verifies the JWT before accessing the database. Inside one transaction
it reads public user columns under a shared user-row lock, hashes the incoming token,
deletes the matching,
unexpired stored token bound to that user, then signs and stores its replacement.
The delete returns a row only once, so concurrent reuse produces `TOKEN_REVOKED`
(HTTP 401). Failed signing or insertion rolls the deletion back. All-session
revocation locks the same user exclusively before deleting sessions, so it waits
for in-flight login/refresh transactions. Authentication failures clear the cookie
using the same path and security options used to set it; database or signing
failures remain server errors and preserve the cookie for retry. All auth routes,
including their error responses, send `Cache-Control: no-store`.

Clients must deduplicate concurrent refresh requests with a shared in-flight
promise, then retry failed API calls with the new access token. Refresh reuse
detection rejects only the reused token; it does not revoke all other sessions.
Logout and logout-all revoke refresh tokens. Already-issued access tokens, including
their role claims, remain valid for up to 15 minutes. Immediate access-token
revocation or role changes would require a database check or revocation mechanism.
Single-session logout can race with refresh: a replacement created first can
survive deletion of the old digest. Clients must discard local credentials on
logout regardless of the response and coordinate logout with in-flight refresh.
There is no password-change endpoint yet. A future password change must hash
outside its transaction, then lock the user first, update the password, and delete
their refresh tokens in that same transaction. Do not call the standalone
`revokeAllSessions` while holding that lock in another transaction.

`src/jobs/session-cleanup.ts` starts an expired-session sweep after database startup.
It deletes up to 1,000 rows per SQL statement, ordered by expiry/ID, using
`FOR UPDATE SKIP LOCKED`. A full batch triggers the next batch after one second;
otherwise it waits `SESSION_CLEANUP_INTERVAL_MS` (default one hour). The interval
is validated between 1,000 and 2,147,483,647 milliseconds. Each worker runs one
batch at a time; multiple instances can safely skip each other's locks. Failures
are logged and retried after the configured interval. Graceful shutdown cancels
the timer and waits for any batch before closing the database pool. Active
sessions are not capped, preserving concurrent logins and existing device sessions.

## Route access policies

`src/types/express.d.ts` adds optional `req.user` with a numeric ID and the schema's
`Role` type. `authenticate` verifies Bearer credentials, while `authorize` requires
an authenticated identity and checks allowed roles. Both throw AppError subclasses.
Protected routes authenticate before validating request input. Services receive a
plain identity object and never import Express.

- Post list/detail reads and `GET /api/v1/users/:id/posts` are public.
- `POST /api/v1/posts` requires authentication and takes only `title` and optional
  `content`. The author comes from the access token; a body `authorId` is rejected.
- Updating, deleting, publishing, or changing post categories requires ownership
  or a MODERATOR/ADMIN role. The service locks the post and checks ownership inside
  the write transaction, preventing a concurrent transfer from bypassing the check.
- `POST /api/v1/authors/:id/publish-all` allows that author or MODERATOR/ADMIN.
- `PATCH /api/v1/posts/:id/view` allows any authenticated user to record a view.
- `POST /api/v1/posts/transfer` requires ADMIN.
- `GET /api/v1/users/me` returns the authenticated user's public fields and profile.
  `PUT /api/v1/users/me` accepts only username/email; `PUT /api/v1/users/me/profile`
  accepts bio/avatar. Update bodies must be nonempty. Neither accepts a role or
  credentials, and the target ID always comes from the token.
- All other user account routes (list, detail, creation, updates, profile updates,
  deletion) require ADMIN. Public registration remains at `/api/v1/auth/register`.

This follows the book's permission matrix: ordinary users can edit their own
posts; moderators and admins can edit any post. Applying a blanket
`authorize("ADMIN", "MODERATOR")` to post updates would exclude ordinary owners,
so those routes enforce ownership in the service instead. Unauthorized identities
receive HTTP 401; authenticated identities without permission receive HTTP 403
(`FORBIDDEN`); missing posts receive HTTP 404 (`POST_NOT_FOUND`). Bulk publish
checks the requested author's permission before looking up the author.

Existing read behavior is preserved: public post reads can include unpublished
posts, post detail includes the author's public email projection, and the admin
user-detail response embeds an unpaginated post collection. Publication visibility,
email privacy, and pagination of that embedded collection need separate changes.

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
