import { z } from "zod";
import { emailSchema } from "../../lib/email.js";

export const registerSchema = z
  .object({
    username: z.string().trim().min(1).max(100),
    email: emailSchema,
    password: z.string().min(8).max(128),
  })
  .strict();

export type RegisterInput = z.output<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export type LoginInput = z.output<typeof loginSchema>;
