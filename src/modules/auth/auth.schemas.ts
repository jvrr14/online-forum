import { z } from "zod";

export const registerSchema = z
  .object({
    username: z.string().trim().min(1).max(100),
    email: z.email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export type RegisterInput = z.output<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginInput = z.output<typeof loginSchema>;
