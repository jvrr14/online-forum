# online-forum

## User database schema

This project uses Drizzle ORM with PostgreSQL. The table definition lives in
`src/db/schema/user.schema.ts`. Each table gets its own schema module, following
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
- `createdAt` maps to `created_at` and defaults to the database's current time.
- `updatedAt` maps to `updated_at`, defaults to the current time on insert, and
  gets a new JavaScript `Date` on Drizzle updates when no value is supplied.
  This hook is not a database trigger: raw SQL updates must set it explicitly.

Both timestamps use millisecond precision and no time zone, matching the original
Prisma PostgreSQL `DateTime` fields. `.notNull()` preserves Prisma's required
fields. `User` describes a selected row; `NewUser` describes an insert, where
fields with defaults can be omitted.

Run `npm run db:generate` after changing the schema to create a SQL migration.
Review the generated SQL, then run `npm run db:migrate` to apply it to the database
configured by `DATABASE_URL`. Generating a migration does not change the database.

The current API repositories still use temporary in-memory storage. Defining and
migrating a table prepares persistence; querying it from the repositories is the
next step.
