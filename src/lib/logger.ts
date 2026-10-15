import pino, { type Logger } from "pino";
import { env } from "../config/env.js";

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: env.SERVICE_NAME,
    environment: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: redactedPaths, censor: "[Redacted]" },
  serializers: { err: pino.stdSerializers.err },
});

export function flushLogger(logger: Logger): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.flush((error) => (error ? reject(error) : resolve()));
  });
}
