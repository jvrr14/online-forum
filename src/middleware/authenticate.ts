import type { RequestHandler } from "express";
import { UnauthorizedError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

export const authenticate: RequestHandler = async (req, _res, next): Promise<void> => {
  // Reject missing tokens, extra credentials, and whitespace inside the JWT.
  const match = /^Bearer[ \t]+(\S+)$/i.exec(req.headers.authorization ?? "");
  const token = match?.[1];
  if (!token) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  req.user = await verifyAccessToken(token);
  next();
};
