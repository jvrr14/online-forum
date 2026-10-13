import { z } from "zod";
import type { PaginationQuery } from "../../lib/request.schemas.js";

export { paginationSchema as listPostsQuerySchema } from "../../lib/request.schemas.js";

const postFieldsSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().nullable().optional(),
});

export const createPostSchema = postFieldsSchema.extend({
  authorId: z.number().int().positive().max(2_147_483_647),
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

export type ListPostsQuery = PaginationQuery;
export type CreatePostInput = z.output<typeof createPostSchema>;
export type UpdatePostInput = z.output<typeof updatePostSchema>;
export type AddPostCategoriesInput = z.output<typeof addPostCategoriesSchema>;
export type RemovePostCategoryInput = z.output<typeof removePostCategorySchema>;
