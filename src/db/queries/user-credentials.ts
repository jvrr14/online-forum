import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { users, type User } from "../schema/user.schema.js";

type UserCredentials = Pick<User, "id" | "passwordHash">;

// Internal authentication lookup. Never return credentials in an API response.
export async function findUserCredentialsByEmail(
  email: string,
): Promise<UserCredentials | undefined> {
  const [credentials] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return credentials;
}
