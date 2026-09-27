import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }

  const appError = normalizeError(error);

  req.log[appError.statusCode >= 500 ? "error" : "warn"](
    { err: error, code: appError.code },
    appError.message,
  );

  const body: ErrorResponse = {
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  if (appError.details !== undefined) {
    body.error.details = appError.details;
  }

  res.status(appError.statusCode).json(body);
};

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isMalformedJsonError(error)) {
    return new AppError(400, "INVALID_JSON", "Request body contains invalid JSON");
  }

  return new AppError(500, "INTERNAL_ERROR", "An unexpected error occurred", undefined, {
    cause: error,
  });
}

function isMalformedJsonError(error: unknown): error is SyntaxError & { status: number } {
  return (
    error instanceof SyntaxError && "status" in error && error.status === 400 && "body" in error
  );
}
