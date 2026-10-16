import type { RequestHandler } from "express";
import type { Role } from "../db/schema/user.schema.js";
import { requireAuthenticatedUser } from "../lib/auth.js";
import { ForbiddenError } from "../lib/errors.js";

export function authorize(...allowedRoles: [Role, ...Role[]]): RequestHandler {
  return (req, _res, next): void => {
    const user = requireAuthenticatedUser(req.user);
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}
