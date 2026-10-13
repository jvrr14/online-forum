import { z } from "zod";

export const idParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d*$/, "ID must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(1),
  email: z.email(),
});

export const updateUserSchema = createUserSchema
  .extend({ username: z.string().trim().min(1).max(100) })
  .partial()
  .strict()
  .refine((input) => input.username !== undefined || input.email !== undefined, {
    message: "Provide a username or email to update",
    path: ["username"],
  });

export type UserIdParams = z.output<typeof idParamsSchema>;
export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
