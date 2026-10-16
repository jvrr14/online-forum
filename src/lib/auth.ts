import type { Role } from "../db/schema/user.schema.js";
import { ForbiddenError, UnauthorizedError } from "./errors.js";

export type AuthenticatedUser = { id: number; role: Role };

export function requireAuthenticatedUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export function assertCanManageResource(actor: AuthenticatedUser, ownerId: number): void {
  if (actor.id !== ownerId && actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
    throw new ForbiddenError();
  }
}
