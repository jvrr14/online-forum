# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` holds the binding conventions for this repo (Prisma-book port rules, error mapping, auth/token/refresh rules, no tests unless asked, run `tsc --noEmit` after each change). Read it first; this file doesn't repeat it. `README.md` documents schema, auth flow, and access-policy decisions in detail.

## Commands

```sh
docker compose up -d        # local Postgres 18 (creds match .env.example)
npm run dev                 # tsx watch src/server.ts
npm run build               # tsc -> dist/
npm start                   # node dist/server.js
npx tsc --noEmit            # type check (required after each change)
npm run fmt / fmt:check     # oxfmt (no ESLint)
npm run db:generate         # create SQL migration from schema changes (review it; doesn't touch the DB)
npm run db:migrate          # apply migrations to DATABASE_URL
npm run db:seed             # WIPES all users/categories, then inserts sample data
```

There is no test runner or `test` script, and tests are not to be added unless requested. Copy `.env.example` to `.env`; `DATABASE_URL`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (distinct, 32+ chars) are required and validated in `src/config/env.ts`.

## Architecture

Express 5 + Drizzle ORM (`1.0.0-rc`, PostgreSQL via `pg`) + Zod 4 + jose, ESM with `NodeNext` (relative imports use `.js` extensions). It is a structure-only port of a Prisma-based book project.

- **Entry/wiring**: `src/server.ts` pings the DB, starts the session-cleanup job, listens, and shuts down via `close-with-grace` (stop cleanup -> close HTTP -> await cleanup -> close DB pool; order matters). `src/app.ts` fixes middleware order: pino-http -> helmet -> `no-store` on `/api/v1/auth` -> cors -> health probes -> rate limiters -> `express.json`/`cookieParser` -> `apiRouter` -> not-found -> error handler. It also sets a global `json replacer` that strips `passwordHash`/`password_hash` from every response as a last-resort safeguard.
- **Modules** (`src/modules/{auth,users,posts,authors}`): each has `*.routes.ts` (thin), `*.schemas.ts` (Zod), and `*.service.ts` (business logic, no Express). Routes are all mounted under `/api/v1` in `src/routes.ts`.
- **Request flow**: `validate(schema, "body"|"params"|"query")` parses and puts the result in `res.locals[target]` (not `req.*`; Express 5 `req.query` is read-only). Handlers read `res.locals.body` etc. and pass plain values/identity objects to services. Zod and `AppError` failures go to `src/middleware/error-handler.ts`, which responds `{ error: { code, message, requestId } }`.
- **Auth**: `authenticate` (Bearer access JWT -> `req.user`) -> `authorize(...roles)` -> `validate`. Ownership checks live in services, inside the write transaction. JWT signing/verification is in `src/lib/jwt.ts`; refresh tokens are stored only as SHA-256 hashes (`src/lib/token-hash.ts`); cookie options are shared in `src/lib/cookies.ts`; Argon2 settings and the dummy hash are in `src/lib/password.ts`.
- **DB layer** (`src/db`): `schema/*.schema.ts` is one file per table, re-exported through `schema/index.ts` (which `drizzle.config.ts` reads); `relations.ts` defines relational-query relations. `projections/users.ts` is the allowlist of public user columns (and the source of the `PublicUser`/`PostAuthor` types). `queries/user-credentials.ts` is the only place that selects `passwordHash`, and its result must never reach a response.
- **Background job**: `src/jobs/session-cleanup.ts` deletes expired refresh tokens in batches (`FOR UPDATE SKIP LOCKED`).
- **Errors**: `src/lib/errors.ts` (`AppError` subclasses) and `src/lib/database-errors.ts` (Postgres `code` mapping).
- **Migrations**: `drizzle/<timestamp>_<name>/{migration.sql,snapshot.json}`. The `harden_auth_storage` migration renames `token` -> `token_hash`, so old and new API binaries must not run together.
