import { z } from "zod";

export const idParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d*$/, "ID must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().positive().max(2_147_483_647)),
});

export const paginationSchema = z.object({
  limit: z
    .string()
    .regex(/^[1-9]\d*$/, "Limit must be a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .default(20),
  offset: z
    .string()
    .regex(/^\d+$/, "Offset must be a non-negative integer")
    .transform(Number)
    .pipe(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER))
    .default(0),
});

export type IdParams = z.output<typeof idParamsSchema>;
export type PaginationQuery = z.output<typeof paginationSchema>;
