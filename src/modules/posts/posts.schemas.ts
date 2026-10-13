import { z } from "zod";

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
      input.title !== undefined ||
      input.content !== undefined ||
      input.published !== undefined,
    {
      message: "Provide a title, content, or published status to update",
      path: ["title"],
    },
  );

export const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPostsQuery = z.output<typeof listPostsQuerySchema>;
export type CreatePostInput = z.output<typeof createPostSchema>;
export type UpdatePostInput = z.output<typeof updatePostSchema>;
