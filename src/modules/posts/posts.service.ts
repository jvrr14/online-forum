import { desc, DrizzleQueryError, eq, getTableColumns, sql } from "drizzle-orm";
import { DatabaseError } from "pg";
import { db } from "../../db/client.js";
import { posts, users, type Post, type User } from "../../db/schema/index.js";
import { NotFoundError } from "../../lib/errors.js";
import type {
  CreatePostInput,
  ListPostsQuery,
  UpdatePostInput,
} from "./posts.schemas.js";

export type PostAuthor = Pick<User, "id" | "username">;
export type PostWithAuthor = Post & { author: PostAuthor };
export type PostWithFullAuthor = Post & {
  author: PostAuthor & Pick<User, "email">;
};

const authorFields = { id: users.id, username: users.username };

const newestFirst = [desc(posts.createdAt), desc(posts.id)] as const;

function isForeignKeyViolation(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return cause instanceof DatabaseError && cause.code === "23503";
}

async function updateOrThrow(id: number, values: Partial<Post>): Promise<Post> {
  const [post] = await db
    .update(posts)
    .set(values)
    .where(eq(posts.id, id))
    .returning();

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }

  return post;
}

export async function listPosts({
  limit,
  offset,
}: ListPostsQuery): Promise<PostWithAuthor[]> {
  return db
    .select({ ...getTableColumns(posts), author: authorFields })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .orderBy(...newestFirst)
    .limit(limit)
    .offset(offset);
}

export async function getPost(id: number): Promise<PostWithFullAuthor> {
  const [post] = await db
    .select({
      ...getTableColumns(posts),
      author: { ...authorFields, email: users.email },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id))
    .limit(1);

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }

  return post;
}

export async function listPostsByUser(
  authorId: number,
  { limit, offset }: ListPostsQuery,
): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(...newestFirst)
    .limit(limit)
    .offset(offset);
}

export async function createPost(
  input: CreatePostInput,
): Promise<PostWithAuthor> {
  let post: Post | undefined;

  try {
    [post] = await db
      .insert(posts)
      .values({
        title: input.title,
        content: input.content,
        authorId: input.authorId,
      })
      .returning();
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }
    throw error;
  }

  const [author] = await db
    .select(authorFields)
    .from(users)
    .where(eq(users.id, input.authorId))
    .limit(1);

  if (!post || !author) {
    throw new Error("Post creation returned no record");
  }

  return { ...post, author };
}

export async function updatePost(
  id: number,
  input: UpdatePostInput,
): Promise<Post> {
  return updateOrThrow(id, {
    title: input.title,
    content: input.content,
    published: input.published,
  });
}

export async function publishPost(id: number): Promise<Post> {
  return updateOrThrow(id, { published: true });
}

export async function incrementPostViews(id: number): Promise<Post> {
  const [post] = await db
    .update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(eq(posts.id, id))
    .returning();

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }

  return post;
}

export async function deletePost(id: number): Promise<void> {
  const [post] = await db
    .delete(posts)
    .where(eq(posts.id, id))
    .returning({ id: posts.id });

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }
}
