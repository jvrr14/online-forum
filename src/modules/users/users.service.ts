import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { CreateUserInput } from "./users.schemas.js";

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
