import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError } from "pg";

export function postgresErrorCode(error: unknown): string | undefined {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return cause instanceof DatabaseError ? cause.code : undefined;
}
