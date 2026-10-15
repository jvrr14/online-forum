## Conventions for this repo

- Structure-only ports from the book's Prisma code unless I say otherwise; note any behavior differences you introduce.
- Services never import express. Errors are thrown as AppError subclasses.
- Never return `passwordHash`: select public columns explicitly, never raw `getTableColumns(users)`.
- Map Postgres errors by `code` only (23505 -> ConflictError, 23503 -> NotFoundError/ConflictError). Never match constraint names.
- Zod update schemas must reject empty bodies. Array inputs must have `.min(1)` before any `.values(array)`.
- List endpoints are paginated with a capped limit.
- Express 5: `req.query` is read-only; don't assign to it.
- Multi-statement writes use `db.transaction`.
- Do not add or run tests unless I explicitly request them. Keep the TypeScript check below.
- After each change, run `tsc --noEmit` and report anything noticed but not changed.
