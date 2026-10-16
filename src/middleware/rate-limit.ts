import rateLimit, { type RateLimitExceededEventHandler } from "express-rate-limit";
import { TooManyRequestsError } from "../lib/errors.js";

const handleRateLimit: RateLimitExceededEventHandler = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next(new TooManyRequestsError());
};

export const apiLimiter = rateLimit({
  identifier: "api",
  requestPropertyName: "apiRateLimit",
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: handleRateLimit,
});

export const authLimiter = rateLimit({
  identifier: "auth",
  requestPropertyName: "authRateLimit",
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: handleRateLimit,
});
