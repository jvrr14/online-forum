import { and, desc, eq, exists, getColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  categories,
  postCategories,
  posts,
  users,
  type Category,
  type Post,
  type User,
} from "../../db/schema/index.js";
import { ConflictError, InternalServerError, NotFoundError } from "../../lib/errors.js";
import { postgresErrorCode } from "../../lib/database-errors.js";
import type { PaginationQuery } from "../../lib/request.schemas.js";
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from "./posts.schemas.js";

export type PostAuthor = Pick<User, "id" | "username">;
export type PostWithAuthor = Post & { author: PostAuthor };
export type PostListResponse = {
  data: PostWithAuthor[];
  meta: { total: number; page: number; totalPages: number };
};
export type PostWithCategories = Post & { categories: Category[] };
export type PostWithFullAuthor = Post & {
  author: PostAuthor & Pick<User, "email">;
};

const authorFields = { id: users.id, username: users.username };

const newestFirst = [desc(posts.createdAt), desc(posts.id)] as const;

async function updateOrThrow(id: number, values: Partial<Post>): Promise<Post> {
  const [post] = await db.update(posts).set(values).where(eq(posts.id, id)).returning();

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }

  return post;
}

export async function listPosts({
  search,
  published,
  category,
  page,
  limit,
}: ListPostsQuery): Promise<PostListResponse> {
  const where = and(
    published !== undefined ? eq(posts.published, published) : undefined,
    search ? or(ilike(posts.title, `%${search}%`), ilike(posts.content, `%${search}%`)) : undefined,
    category
      ? exists(
          db
            .select({ postId: postCategories.postId })
            .from(postCategories)
            .innerJoin(categories, eq(postCategories.categoryId, categories.id))
            .where(and(eq(postCategories.postId, posts.id), eq(categories.name, category))),
        )
      : undefined,
  );

  const [data, total] = await Promise.all([
    db
      .select({ ...getColumns(posts), author: authorFields })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(where)
      .orderBy(...newestFirst)
      .limit(limit)
      .offset((page - 1) * limit),
    db.$count(posts, where),
  ]);

  return {
    data,
    meta: { total, page, totalPages: Math.ceil(total / limit) },
  };
}

export async function getPost(id: number): Promise<PostWithFullAuthor> {
  const [post] = await db
    .select({
      ...getColumns(posts),
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
  { limit, offset }: PaginationQuery,
): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(eq(posts.authorId, authorId))
    .orderBy(...newestFirst)
    .limit(limit)
    .offset(offset);
}

export async function createPost(input: CreatePostInput): Promise<PostWithAuthor> {
  try {
    return await db.transaction(async (tx) => {
      const [post] = await tx
        .insert(posts)
        .values({ title: input.title, content: input.content, authorId: input.authorId })
        .returning();

      // The insert's foreign-key lock protects the author until this read finishes.
      const [author] = await tx
        .select(authorFields)
        .from(users)
        .where(eq(users.id, input.authorId))
        .limit(1);

      if (!post || !author) {
        throw new InternalServerError("Post creation returned no record");
      }

      return { ...post, author };
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23503") {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }
    throw error;
  }
}

export async function updatePost(id: number, input: UpdatePostInput): Promise<Post> {
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
  const [post] = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }
}

export async function addPostCategories(
  id: number,
  categoryNames: string[],
): Promise<PostWithCategories> {
  return db.transaction(async (tx) => {
    // Lock the post while changing its relations and refresh its update timestamp.
    const [post] = await tx
      .update(posts)
      .set({ updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    if (!post) {
      throw new NotFoundError("Post not found", "POST_NOT_FOUND");
    }

    const names = [...new Set(categoryNames)].sort();
    await tx
      .insert(categories)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing({ target: categories.name });
    const linkedCategories = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.name, names))
      .for("key share");
    if (linkedCategories.length !== names.length) {
      throw new ConflictError(
        "Categories changed while adding them; retry the request",
        "CATEGORY_CONFLICT",
      );
    }
    await tx
      .insert(postCategories)
      .values(linkedCategories.map((category) => ({ postId: id, categoryId: category.id })))
      .onConflictDoNothing();

    const result = await tx
      .select(getColumns(categories))
      .from(categories)
      .innerJoin(postCategories, eq(postCategories.categoryId, categories.id))
      .where(eq(postCategories.postId, id))
      .orderBy(categories.name);
    return { ...post, categories: result };
  });
}

export async function removePostCategory(
  id: number,
  categoryName: string,
): Promise<PostWithCategories> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .update(posts)
      .set({ updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    if (!post) {
      throw new NotFoundError("Post not found", "POST_NOT_FOUND");
    }

    await tx
      .delete(postCategories)
      .where(
        and(
          eq(postCategories.postId, id),
          inArray(
            postCategories.categoryId,
            tx
              .select({ id: categories.id })
              .from(categories)
              .where(eq(categories.name, categoryName)),
          ),
        ),
      );
    const result = await tx
      .select(getColumns(categories))
      .from(categories)
      .innerJoin(postCategories, eq(postCategories.categoryId, categories.id))
      .where(eq(postCategories.postId, id))
      .orderBy(categories.name);
    return { ...post, categories: result };
  });
}
