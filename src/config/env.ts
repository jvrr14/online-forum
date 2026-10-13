import "dotenv/config";
import { z } from "zod";
import pino from "pino";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SERVICE_NAME: z.string().min(1).default("online-forum-api"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  pino().fatal(
    {
      event: "config.validation.failed",
      fields: z.flattenError(result.error).fieldErrors,
    },
    "application configuration is invalid",
  );
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
