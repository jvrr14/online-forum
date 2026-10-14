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
`src/db/schema/relations.ts` expose `users.posts`, nullable `users.profile`,
required `profiles.user` and `posts.author`, and the arrays `posts.categories`
and `categories.posts` through Drizzle's relational query API. They are exported
by the schema barrel and registered with the database client. Relation
properties are query results, not additional database columns. The many-to-many
relations use Drizzle's `through` mapping, following the
[official relations documentation](https://orm.drizzle.team/docs/relations#many-to-many).

Run `npm run db:generate` after changing the schema to create a SQL migration.
Review the generated SQL, then run `npm run db:migrate` to apply it to the database
configured by `DATABASE_URL`. Generating a migration does not change the database.

## Database seeding

After configuring `.env` (see `.env.example`), run:

```sh
npm run db:migrate
npm run db:seed
```

`src/db/seed.ts` uses the existing Drizzle client and environment validation,
including the required `DATABASE_URL` and `JWT_SECRET`.
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
