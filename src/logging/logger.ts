import pino, { type LevelWithSilent, type Logger } from "pino";

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "DATABASE_URL",
  "JWT_SECRET",
];

const logLevels = new Set<LevelWithSilent>([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

const configuredLevel = process.env.LOG_LEVEL as LevelWithSilent | undefined;

export const logger = pino({
  level: configuredLevel && logLevels.has(configuredLevel) ? configuredLevel : "info",
  base: {
    service: process.env.SERVICE_NAME || "online-forum-api",
    environment: process.env.NODE_ENV || "development",
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
