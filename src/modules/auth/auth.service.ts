import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { publicUserFields, type PublicUser } from "../../db/projections/users.js";
import { findUserCredentialsByEmail } from "../../db/queries/user-credentials.js";
import { refreshTokens, users } from "../../db/schema/index.js";
import { postgresErrorCode } from "../../lib/database-errors.js";
import { normalizeEmail } from "../../lib/email.js";
import { hashPassword, PASSWORD_RESET_REQUIRED, verifyPassword } from "../../lib/password.js";
import { hashToken } from "../../lib/token-hash.js";
import { ConflictError, UnauthorizedError } from "../../lib/errors.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  // Hash before opening the transaction to avoid holding a connection during hashing.
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    let user: PublicUser | undefined;

    try {
      [user] = await tx
        .insert(users)
        .values({ email: normalizeEmail(input.email), username: input.username, passwordHash })
        .onConflictDoNothing({ target: users.email })
        .returning(publicUserFields);
    } catch (error) {
      if (postgresErrorCode(error) === "23505") {
        throw new ConflictError("User conflicts with an existing account", "USER_CONFLICT");
      }
      throw error;
    }

    if (!user) {
      throw new ConflictError("Email is already in use", "EMAIL_CONFLICT");
    }

    return createAuthSession(user, tx);
  });
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const found = await findUserCredentialsByEmail(input.email);
  const credentials = found && found.passwordHash !== PASSWORD_RESET_REQUIRED ? found : undefined;

  // Password verification is expensive, so keep it outside the transaction.
  // Missing and disabled accounts still perform one Argon2 verification.
  const validPassword = await verifyPassword(credentials?.passwordHash, input.password);

  if (!credentials || !validPassword) {
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

export async function refreshSession(token: string | undefined): Promise<AuthResponse> {
  if (!token) {
    throw new UnauthorizedError("Refresh token is required");
  }
  const userId = await verifyRefreshToken(token);

  return db.transaction(async (tx) => {
    // Lock the user first, matching login and all-session revocation lock order.
    const [user] = await tx
      .select(publicUserFields)
      .from(users)
      .where(eq(users.id, userId))
      .for("share");

    if (!user) {
      throw new UnauthorizedError("Refresh token has been revoked", "TOKEN_REVOKED");
    }

    // DELETE acquires the row lock; only one concurrent rotation can consume it.
    const [consumed] = await tx
      .delete(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, hashToken(token)),
          eq(refreshTokens.userId, userId),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .returning({ id: refreshTokens.id });
    if (!consumed) {
      throw new UnauthorizedError("Refresh token has been revoked", "TOKEN_REVOKED");
    }

    // Signing or insertion failures roll back consumption of the old token.
    return createAuthSession(user, tx);
  });
}

export async function logoutSession(token: string | undefined): Promise<void> {
  if (token) {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashToken(token)));
  }
}

export async function revokeAllSessions(userId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialize against login/refresh so an in-flight rotation cannot escape revocation.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });
}

export const EXPIRED_SESSION_BATCH_SIZE = 1_000;

export async function deleteExpiredSessions(): Promise<number> {
  // One bounded SQL statement; skip rows being changed by another worker.
  const expiredIds = db
    .select({ id: refreshTokens.id })
    .from(refreshTokens)
    .where(lte(refreshTokens.expiresAt, new Date()))
    .orderBy(refreshTokens.expiresAt, refreshTokens.id)
    .limit(EXPIRED_SESSION_BATCH_SIZE)
    .for("update", { skipLocked: true });
  const result = await db.delete(refreshTokens).where(inArray(refreshTokens.id, expiredIds));
  return result.rowCount ?? 0;
}

async function createAuthSession(
  user: PublicUser,
  tx: Pick<typeof db, "insert">,
): Promise<AuthResponse> {
  const [accessToken, refresh] = await Promise.all([
    createAccessToken(user.id, user.role),
    createRefreshToken(user.id),
  ]);

  await tx.insert(refreshTokens).values({
    tokenHash: hashToken(refresh.token),
    userId: user.id,
    expiresAt: refresh.expiresAt,
  });

  return { user, accessToken, refreshToken: refresh.token };
}
