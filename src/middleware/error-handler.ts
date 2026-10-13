import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }

  const appError = normalizeError(error);
  const requestId = String(req.id);
  const message = appError.expose ? appError.message : "An unexpected error occurred";

  res.locals.errorCode = appError.code;

  if (appError.statusCode >= 500) {
    req.log.error(
      {
        event: "http.request.error",
        err: toError(error),
        errorCode: appError.code,
      },
      "request failed",
    );
  }

  const body: ErrorResponse = {
    error: {
      code: appError.code,
      message,
      requestId,
    },
  };

  if (appError.expose && appError.details !== undefined) {
    body.error.details = appError.details;
  }

  res.status(appError.statusCode).json(body);
};

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
      details: z.flattenError(error).fieldErrors,
      cause: error,
    });
  }

  if (isMalformedJsonError(error)) {
    return new AppError(400, "INVALID_JSON", "Request body contains invalid JSON");
  }

  if (isPayloadTooLargeError(error)) {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  return new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred", {
    cause: error,
  });
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

function isPayloadTooLargeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    error.status === 413 &&
    "type" in error &&
    error.type === "entity.too.large"
  );
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error("A non-Error value was thrown", { cause: error });
}
