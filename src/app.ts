import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Response } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { pingDb } from "./db/client.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { apiLimiter, authLimiter } from "./middleware/rate-limit.js";
import { apiRouter } from "./routes.js";

export const app = express();
let shuttingDown = false;

export function markShuttingDown(): void {
  shuttingDown = true;
}

app.disable("x-powered-by");
// Apply to nested objects and arrays in every JSON response as a final safeguard.
app.set("json replacer", (key: string, value: unknown) =>
  key === "passwordHash" || key === "password_hash" ? undefined : value,
);

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incomingId = req.headers["x-request-id"];
      const requestId =
        typeof incomingId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingId)
          ? incomingId
          : randomUUID();

      res.setHeader("X-Request-Id", requestId);
      return requestId;
    },
    autoLogging: {
      ignore: (req) => {
        const path = req.url?.split("?")[0];
        return path === "/health" || path === "/health/live" || path === "/health/ready";
      },
    },
    quietReqLogger: true,
    quietResLogger: true,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessObject: (req, res, { responseTime }) => ({
      event: "http.request.completed",
      method: req.method,
      path: req.originalUrl?.split("?")[0],
      statusCode: res.statusCode,
      responseTimeMs: responseTime,
      errorCode: (res as Response).locals.errorCode,
    }),
  }),
);

app.use(helmet());
// Set this before CORS, rate limiting, and parsing, including early responses.
app.use("/api/v1/auth", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

// Health probes do not need body parsing or consume API quotas.
app.get(["/health", "/health/live"], (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/health/ready", async (req, res) => {
  if (shuttingDown) {
    res.status(503).json({ status: "not_ready" });
    return;
  }

  try {
    await pingDb();
    res.status(200).json({ status: "ready" });
  } catch (error) {
    req.log.warn({ event: "health.readiness.failed", err: error }, "readiness check failed");
    res.status(503).json({ status: "not_ready" });
  }
});

// Reject excess traffic before parsing bodies or cookies. Preflights finish in CORS.
app.use("/api/v1", apiLimiter);
// Share the credential-attempt budget without blocking session cleanup or refresh.
app.post(["/api/v1/auth/login", "/api/v1/auth/register"], authLimiter);
app.use("/api/v1", express.json({ limit: "10kb" }), cookieParser(), apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
