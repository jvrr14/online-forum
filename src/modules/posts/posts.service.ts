import { and, desc, eq, exists, getColumns, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  postAuthorFields,
  postAuthorWithEmailFields,
  type PostAuthor,
  type PostAuthorWithEmail,
} from "../../db/projections/users.js";
import {
  categories,
  postCategories,
  posts,
  users,
  type Category,
  type Post,
} from "../../db/schema/index.js";
import { ConflictError, InternalServerError, NotFoundError } from "../../lib/errors.js";
import { postgresErrorCode } from "../../lib/database-errors.js";
import { assertCanManageResource, type AuthenticatedUser } from "../../lib/auth.js";
import type { PaginationQuery } from "../../lib/request.schemas.js";
import type {
  CreatePostInput,
  ListPostsQuery,
  TransferPostsInput,
  UpdatePostInput,
} from "./posts.schemas.js";

export type { PostAuthor } from "../../db/projections/users.js";
export type PostWithAuthor = Post & { author: PostAuthor };
export type PostListResponse = {
  data: PostWithAuthor[];
  meta: { total: number; page: number; totalPages: number };
};
export type PostWithCategories = Post & { categories: Category[] };
export type PostWithFullAuthor = Post & {
  author: PostAuthorWithEmail;
};
export type PublishAllPostsResult = { username: string; count: number };
export type TransferPostsResult = { transferred: number; from: string; to: string };

const newestFirst = [desc(posts.createdAt), desc(posts.id)] as const;

type PostTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockPostForWrite(
  tx: PostTransaction,
  id: number,
  actor: AuthenticatedUser,
): Promise<void> {
  const [post] = await tx
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, id))
    .for("update");

  if (!post) {
    throw new NotFoundError("Post not found", "POST_NOT_FOUND");
  }

  assertCanManageResource(actor, post.authorId);
}

async function updateOrThrow(
  id: number,
  values: Partial<Post>,
  actor: AuthenticatedUser,
): Promise<Post> {
  return db.transaction(async (tx) => {
    await lockPostForWrite(tx, id, actor);
    const [post] = await tx.update(posts).set(values).where(eq(posts.id, id)).returning();
    if (!post) {
      throw new InternalServerError("Post update returned no record");
    }
    return post;
  });
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
      .select({ ...getColumns(posts), author: postAuthorFields })
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
      author: postAuthorWithEmailFields,
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

export async function createPost(
  input: CreatePostInput,
  actor: AuthenticatedUser,
): Promise<PostWithAuthor> {
  try {
    return await db.transaction(async (tx) => {
      const [post] = await tx
        .insert(posts)
        .values({ title: input.title, content: input.content, authorId: actor.id })
        .returning();

      // The insert's foreign-key lock protects the author until this read finishes.
      const [author] = await tx
        .select(postAuthorFields)
        .from(users)
        .where(eq(users.id, actor.id))
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

export async function transferPosts({
  fromAuthorId,
  toAuthorId,
}: TransferPostsInput): Promise<TransferPostsResult> {
  try {
    return await db.transaction(async (tx) => {
      const [fromUser] = await tx
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, fromAuthorId))
        .limit(1);
      if (!fromUser) {
        throw new NotFoundError("Source user not found", "USER_NOT_FOUND");
      }

      const [toUser] = await tx
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, toAuthorId))
        .limit(1);
      if (!toUser) {
        throw new NotFoundError("Destination user not found", "USER_NOT_FOUND");
      }

      const postCount = await tx.$count(posts, eq(posts.authorId, fromAuthorId));
      if (postCount === 0) {
        throw new ConflictError(
          `${fromUser.username} has no posts to transfer`,
          "NO_POSTS_TO_TRANSFER",
        );
      }

      await tx.update(posts).set({ authorId: toAuthorId }).where(eq(posts.authorId, fromAuthorId));

      return { transferred: postCount, from: fromUser.username, to: toUser.username };
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23503") {
      throw new NotFoundError("Destination user not found", "USER_NOT_FOUND");
    }
    throw error;
  }
}

export async function updatePost(
  id: number,
  input: UpdatePostInput,
  actor: AuthenticatedUser,
): Promise<Post> {
  return updateOrThrow(
    id,
    {
      title: input.title,
      content: input.content,
      published: input.published,
    },
    actor,
  );
}

export async function publishPost(id: number, actor: AuthenticatedUser): Promise<Post> {
  return updateOrThrow(id, { published: true }, actor);
}

export async function publishAllPostsByAuthor(
  authorId: number,
  actor: AuthenticatedUser,
): Promise<PublishAllPostsResult> {
  assertCanManageResource(actor, authorId);
  return db.transaction(async (tx) => {
    const [author] = await tx
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    if (!author) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    const result = await tx
      .update(posts)
      .set({ published: true })
      .where(and(eq(posts.authorId, authorId), eq(posts.published, false)));

    return { username: author.username, count: result.rowCount ?? 0 };
  });
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

export async function deletePost(id: number, actor: AuthenticatedUser): Promise<void> {
  await db.transaction(async (tx) => {
    await lockPostForWrite(tx, id, actor);
    await tx.delete(posts).where(eq(posts.id, id));
  });
}

export async function addPostCategories(
  id: number,
  categoryNames: string[],
  actor: AuthenticatedUser,
): Promise<PostWithCategories> {
  return db.transaction(async (tx) => {
    await lockPostForWrite(tx, id, actor);
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
  actor: AuthenticatedUser,
): Promise<PostWithCategories> {
  return db.transaction(async (tx) => {
    await lockPostForWrite(tx, id, actor);
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
