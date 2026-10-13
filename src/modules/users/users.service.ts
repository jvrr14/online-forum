import { DrizzleQueryError, eq } from "drizzle-orm";
import { DatabaseError } from "pg";
import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { CreateUserInput, UpdateUserInput } from "./users.schemas.js";

export type UserResponse = {
  id: number;
  username: string;
  email: string;
};

const userFields = {
  id: users.id,
  username: users.username,
  email: users.email,
};

export async function listUsers(): Promise<UserResponse[]> {
  return db.select(userFields).from(users).orderBy(users.id);
}

export async function getUser(id: number): Promise<UserResponse> {
  const [user] = await db.select(userFields).from(users).where(eq(users.id, id)).limit(1);

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  return user;
}

export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  const [user] = await db
    .insert(users)
    .values({ username: input.username, email: input.email })
    .onConflictDoNothing({ target: users.email })
    .returning(userFields);

  if (!user) {
    throw new ConflictError("Email is already in use", "EMAIL_CONFLICT");
  }

  return user;
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<UserResponse> {
  try {
    const [user] = await db
      .update(users)
      .set({ username: input.username, email: input.email })
      .where(eq(users.id, id))
      .returning(userFields);

    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    return user;
  } catch (error) {
    const cause = error instanceof DrizzleQueryError ? error.cause : error;
    if (
      cause instanceof DatabaseError &&
      cause.code === "23505" &&
      cause.constraint === "users_email_key"
    ) {
      throw new ConflictError("Email is already in use", "EMAIL_CONFLICT");
    }

    throw error;
  }
}

export async function deleteUser(id: number): Promise<void> {
  const [user] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }
}
