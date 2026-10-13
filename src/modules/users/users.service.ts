import { eq, getColumns, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { posts, profiles, users, type Profile, type User } from "../../db/schema/index.js";
import { postgresErrorCode } from "../../lib/database-errors.js";
import {
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "../../lib/errors.js";
import type { PostWithCategories } from "../posts/posts.service.js";
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UpsertProfileInput,
} from "./users.schemas.js";

const publicUserColumns = {
  id: true,
  username: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

const userFields = {
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export type UserResponse = Pick<User, keyof typeof publicUserColumns>;
export type UserWithProfile = UserResponse & { profile: Profile | null };
export type UserListResponse = UserWithProfile & { _count: { posts: number } };
export type UserDetailResponse = UserWithProfile & { posts: PostWithCategories[] };

export async function listUsers({ limit, offset }: ListUsersQuery): Promise<UserListResponse[]> {
  return db
    .select({
      ...userFields,
      profile: getColumns(profiles),
      _count: {
        posts:
          sql<number>`(select count(*) from ${posts} where ${posts.authorId} = ${users.id})`.mapWith(
            Number,
          ),
      },
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .orderBy(users.id)
    .limit(limit)
    .offset(offset);
}

export async function getUser(id: number): Promise<UserDetailResponse> {
  const user = await db.query.users.findFirst({
    where: { id },
    columns: publicUserColumns,
    with: {
      profile: true,
      posts: {
        orderBy: { createdAt: "desc", id: "desc" },
        with: { categories: { orderBy: { name: "asc" } } },
      },
    },
  });

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  return user;
}

export async function createUser(input: CreateUserInput): Promise<UserWithProfile> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ username: input.username, email: input.email, role: input.role })
      .onConflictDoNothing({ target: users.email })
      .returning(userFields);

    if (!user) {
      throw new ConflictError("Email is already in use", "EMAIL_CONFLICT");
    }

    let profile: Profile | null = null;
    if (input.bio) {
      const [createdProfile] = await tx
        .insert(profiles)
        .values({ bio: input.bio, userId: user.id })
        .returning();
      if (!createdProfile) {
        throw new InternalServerError("Profile creation returned no record");
      }
      profile = createdProfile;
    }

    return { ...user, profile };
  });
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<UserResponse> {
  try {
    const [user] = await db
      .update(users)
      .set({ username: input.username, email: input.email, role: input.role })
      .where(eq(users.id, id))
      .returning(userFields);

    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    return user;
  } catch (error) {
    if (postgresErrorCode(error) === "23505") {
      throw new ConflictError("Email is already in use", "EMAIL_CONFLICT");
    }

    throw error;
  }
}

export async function upsertProfile(id: number, input: UpsertProfileInput): Promise<Profile> {
  try {
    return await db.transaction(async (tx) => {
      // Serialize profile changes for this user, including first-time creation.
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .for("update");
      if (!user) {
        throw new NotFoundError("User not found", "USER_NOT_FOUND");
      }

      let bio = input.bio;
      if (bio === undefined) {
        const [existingProfile] = await tx
          .select({ bio: profiles.bio })
          .from(profiles)
          .where(eq(profiles.userId, id))
          .limit(1);
        if (!existingProfile) {
          throw new BadRequestError("Bio is required when creating a profile", "VALIDATION_ERROR", {
            details: { bio: ["Bio is required when creating a profile"] },
          });
        }
        bio = existingProfile.bio;
      }

      const [profile] = await tx
        .insert(profiles)
        .values({ userId: id, bio, avatar: input.avatar })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: { bio: input.bio, avatar: input.avatar },
        })
        .returning();

      if (!profile) {
        throw new InternalServerError("Profile upsert returned no record");
      }

      return profile;
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23503") {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
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
