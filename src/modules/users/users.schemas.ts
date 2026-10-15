import { z } from "zod";
import { roleEnum } from "../../db/schema/index.js";
import type { IdParams, PaginationQuery } from "../../lib/request.schemas.js";

export {
  idParamsSchema,
  paginationSchema as listUsersQuerySchema,
} from "../../lib/request.schemas.js";

export const createUserSchema = z.object({
  username: z.string().trim().min(1).max(100),
  email: z.email(),
  passwordHash: z.string().min(1).max(100),
  role: z.enum(roleEnum.enumValues).optional(),
  bio: z.string().optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ bio: true, passwordHash: true })
  .partial()
  .strict()
  .refine(
    (input) =>
      input.username !== undefined || input.email !== undefined || input.role !== undefined,
    {
      message: "Provide a username, email, or role to update",
      path: ["username"],
    },
  );

export const upsertProfileSchema = z
  .object({
    bio: z.string().optional(),
    avatar: z.string().max(500).nullable().optional(),
  })
  .strict()
  .refine((input) => input.bio !== undefined || input.avatar !== undefined, {
    message: "Provide a bio or avatar to update",
    path: ["bio"],
  });

export type UserIdParams = IdParams;
export type ListUsersQuery = PaginationQuery;
export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
export type UpsertProfileInput = z.output<typeof upsertProfileSchema>;
