import { z } from "zod";
import { closeDb, db } from "./client.js";
import { categories, postCategories, posts, profiles, users } from "./schema/index.js";
import { InternalServerError } from "../lib/errors.js";

async function seedDatabase(): Promise<void> {
  const { SEED_USER_PASSWORD_HASH: passwordHash } = z
    .object({
      SEED_USER_PASSWORD_HASH: z.string().min(1).max(100).default("!password-reset-required"),
    })
    .parse(process.env);

  await db.transaction(async (tx) => {
    // Deleting users cascades to posts, profiles, refresh tokens, and post/category links.
    await tx.delete(users);
    await tx.delete(categories);

    const [category] = await tx
      .insert(categories)
      .values({ name: "TypeScript" })
      .returning({ id: categories.id });
    if (!category) {
      throw new InternalServerError("Seed category creation returned no record");
    }

    const [user] = await tx
      .insert(users)
      .values({ username: "jon", email: "jon@example.com", passwordHash, role: "ADMIN" })
      .returning({ id: users.id });
    if (!user) {
      throw new InternalServerError("Seed user creation returned no record");
    }

    await tx.insert(profiles).values({ bio: "Full-stack developer", userId: user.id });

    const [post] = await tx
      .insert(posts)
      .values({
        title: "Getting Started with TypeScript",
        content: "TypeScript adds static typing to JavaScript.",
        published: true,
        views: 142,
        authorId: user.id,
      })
      .returning({ id: posts.id });
    if (!post) {
      throw new InternalServerError("Seed post creation returned no record");
    }

    await tx.insert(postCategories).values({ postId: post.id, categoryId: category.id });
  });
}

try {
  await seedDatabase();
  console.log("Seeding complete.");
} catch (error: unknown) {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
} finally {
  try {
    await closeDb();
  } catch (error: unknown) {
    console.error("Database cleanup failed:", error);
    process.exitCode = 1;
  }
}
