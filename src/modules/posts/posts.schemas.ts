import { z } from "zod";
import { paginationSchema } from "../../lib/request.schemas.js";

export const listPostsQuerySchema = paginationSchema
  .omit({ offset: true })
  .extend({
    limit: paginationSchema.shape.limit.default(10),
    page: z
      .string()
      .regex(/^[1-9]\d*$/, "Page must be a positive integer")
      .transform(Number)
      .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
      .default(1),
    search: z.string().optional(),
    published: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    category: z.string().optional(),
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    message: "Page and limit produce an offset that is too large",
    path: ["page"],
  });

const postFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().nullable().optional(),
});

export const createPostSchema = postFieldsSchema.extend({
  authorId: z.number().int().positive().max(2_147_483_647),
});

export const transferPostsSchema = z
  .object({
    fromAuthorId: z.number().int().positive().max(2_147_483_647),
    toAuthorId: z.number().int().positive().max(2_147_483_647),
  })
  .strict()
  .refine((input) => input.fromAuthorId !== input.toAuthorId, {
    message: "Source and destination must differ",
    path: ["toAuthorId"],
  });

export const updatePostSchema = postFieldsSchema
  .extend({ published: z.boolean() })
  .partial()
  .strict()
  .refine(
    (input) =>
      input.title !== undefined || input.content !== undefined || input.published !== undefined,
    {
      message: "Provide a title, content, or published status to update",
      path: ["title"],
    },
  );

const categoryNameSchema = z.string().trim().min(1).max(100);

export const addPostCategoriesSchema = z
  .object({
    categoryNames: z.array(categoryNameSchema).min(1),
  })
  .strict();

export const removePostCategorySchema = z
  .object({
    categoryName: categoryNameSchema,
  })
  .strict();

export type ListPostsQuery = z.output<typeof listPostsQuerySchema>;
export type CreatePostInput = z.output<typeof createPostSchema>;
export type TransferPostsInput = z.output<typeof transferPostsSchema>;
export type UpdatePostInput = z.output<typeof updatePostSchema>;
export type AddPostCategoriesInput = z.output<typeof addPostCategoriesSchema>;
export type RemovePostCategoryInput = z.output<typeof removePostCategorySchema>;
