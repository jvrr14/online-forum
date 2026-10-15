import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { env } from "../config/env.js";
import type { Role } from "../db/schema/user.schema.js";

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

export async function createRefreshToken(userId: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(refreshSecret);
}
