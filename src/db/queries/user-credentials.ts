import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { users, type User } from "../schema/user.schema.js";
import { normalizeEmail } from "../../lib/email.js";

type UserCredentials = Pick<User, "id" | "passwordHash">;

// Internal authentication lookup. Never return credentials in an API response.
export async function findUserCredentialsByEmail(
  email: string,
): Promise<UserCredentials | undefined> {
  const [credentials] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return credentials;
}
