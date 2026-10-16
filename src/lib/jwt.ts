import { randomUUID } from "node:crypto";
import { errors, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { env } from "../config/env.js";
import { roleEnum, type Role } from "../db/schema/user.schema.js";
import type { AuthenticatedUser } from "./auth.js";
import { UnauthorizedError } from "./errors.js";

export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const encoder = new TextEncoder();
const accessSecret = encoder.encode(env.JWT_ACCESS_SECRET);
const refreshSecret = encoder.encode(env.JWT_REFRESH_SECRET);

export async function createAccessToken(userId: number, role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(accessSecret);
}

export type CreatedRefreshToken = { token: string; expiresAt: Date };

export async function createRefreshToken(userId: number): Promise<CreatedRefreshToken> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + REFRESH_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(refreshSecret);
  return { token, expiresAt: new Date(expiresAt * 1000) };
}

async function verifyToken(token: string, secret: Uint8Array): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      typ: "JWT",
      requiredClaims: ["sub", "exp", "iat", "jti"],
    });
    return payload;
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new UnauthorizedError("Token has expired", "TOKEN_EXPIRED");
    }
    if (error instanceof errors.JOSEError) {
      throw new UnauthorizedError("Invalid token", "INVALID_TOKEN");
    }
    throw error;
  }
}

function subjectId(payload: JWTPayload): number {
  if (
    typeof payload.sub !== "string" ||
    !/^[1-9]\d*$/.test(payload.sub) ||
    !Number.isSafeInteger(Number(payload.sub)) ||
    Number(payload.sub) > 2_147_483_647 ||
    typeof payload.jti !== "string" ||
    payload.jti.length === 0
  ) {
    throw new UnauthorizedError("Invalid token claims", "INVALID_TOKEN");
  }
  return Number(payload.sub);
}

export async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
  const payload = await verifyToken(token, accessSecret);
  const id = subjectId(payload);
  const role = roleEnum.enumValues.find((role) => role === payload.role);
  if (!role) {
    throw new UnauthorizedError("Invalid token claims", "INVALID_TOKEN");
  }
  return { id, role };
}

export async function verifyRefreshToken(token: string): Promise<number> {
  return subjectId(await verifyToken(token, refreshSecret));
}
