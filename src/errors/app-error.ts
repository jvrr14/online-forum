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
