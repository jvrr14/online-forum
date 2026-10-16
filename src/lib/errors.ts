export type AppErrorOptions = {
  details?: unknown;
  cause?: unknown;
  expose?: boolean;
};

export class AppError extends Error {
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    options: AppErrorOptions = {},
  ) {
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new RangeError("AppError statusCode must be between 400 and 599");
    }

    super(message, { cause: options.cause });
    this.name = "AppError";
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists", code = "CONFLICT") {
    super(409, code, message);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(401, code, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action", code = "FORBIDDEN") {
    super(403, code, message);
    this.name = "ForbiddenError";
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = "Invalid request",
    code = "VALIDATION_ERROR",
    options: AppErrorOptions = {},
  ) {
    super(400, code, message, options);
    this.name = "BadRequestError";
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected error occurred", options: AppErrorOptions = {}) {
    super(500, "INTERNAL_ERROR", message, options);
    this.name = "InternalServerError";
  }
}
