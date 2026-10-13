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
