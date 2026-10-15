import * as argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import { decodeJwt } from "jose";
import { db } from "../../db/client.js";
import { publicUserFields, type PublicUser } from "../../db/projections/users.js";
import { findUserCredentialsByEmail } from "../../db/queries/user-credentials.js";
import { refreshTokens, users } from "../../db/schema/index.js";
import { postgresErrorCode } from "../../lib/database-errors.js";
import { ConflictError, InternalServerError, UnauthorizedError } from "../../lib/errors.js";
import { createAccessToken, createRefreshToken } from "../../lib/jwt.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  // Hash before opening the transaction to avoid holding a connection during hashing.
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

  return db.transaction(async (tx) => {
    let user: PublicUser | undefined;

    try {
      [user] = await tx
        .insert(users)
        .values({ email: input.email, username: input.username, passwordHash })
        .returning(publicUserFields);
    } catch (error) {
      if (postgresErrorCode(error) === "23505") {
        throw new ConflictError("Email is already in use", "EMAIL_CONFLICT");
      }
      throw error;
    }

    if (!user) {
      throw new InternalServerError("User creation returned no record");
    }

    return createAuthSession(user, tx);
  });
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const credentials = await findUserCredentialsByEmail(input.email);

  if (!credentials || credentials.passwordHash === "!password-reset-required") {
    throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  // Password verification is expensive, so keep it outside the transaction.
  let validPassword: boolean;
  try {
    validPassword = await argon2.verify(credentials.passwordHash, input.password);
  } catch (error) {
    throw new InternalServerError("Password verification failed", { cause: error });
  }

  if (!validPassword) {
    throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
  }

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select(publicUserFields)
      .from(users)
      // Reject a password changed during verification; lock the user until the session is stored.
      .where(and(eq(users.id, credentials.id), eq(users.passwordHash, credentials.passwordHash)))
      .limit(1)
      .for("share");

    if (!user) {
      throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
    }

    return createAuthSession(user, tx);
  });
}

async function createAuthSession(
  user: PublicUser,
  tx: Pick<typeof db, "insert">,
): Promise<AuthResponse> {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(user.id, user.role),
    createRefreshToken(user.id),
  ]);

  // This token was just signed here. Incoming tokens must be verified, not decoded.
  const { exp } = decodeJwt(refreshToken);
  if (typeof exp !== "number" || !Number.isSafeInteger(exp)) {
    throw new InternalServerError("Refresh token has no valid expiration");
  }

  await tx.insert(refreshTokens).values({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(exp * 1000),
  });

  return { user, accessToken, refreshToken };
}
