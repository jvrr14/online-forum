import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { InternalServerError } from "./errors.js";

export const PASSWORD_RESET_REQUIRED = "!password-reset-required";

// Pin the current application policy so real and dummy hashes use the same costs.
const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  version: 0x13,
} as const;

export function hashPassword(password: string | Buffer): Promise<string> {
  return argon2.hash(password, passwordHashOptions);
}

// Generate once at module initialization, before any request can take a faster path.
const dummyPasswordHash = await hashPassword(randomBytes(32));

export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash ?? dummyPasswordHash, password);
  } catch (error) {
    throw new InternalServerError("Password verification failed", { cause: error });
  }
}
