import "dotenv/config";
import closeWithGrace from "close-with-grace";
import { app, markShuttingDown } from "./app.js";
import { env } from "./config/env.js";
import { closeDb, pingDb } from "./db/client.js";
import { flushLogger, logger } from "./lib/logger.js";

async function start(): Promise<void> {
  try {
    await pingDb();
  } catch (error) {
    logger.fatal({ event: "database.startup.failed", err: error }, "database is unavailable");
    process.exitCode = 1;

    try {
      await closeDb();
    } catch (closeError) {
      logger.error(
        { event: "shutdown.database.failed", err: closeError },
        "database failed to close",
      );
    } finally {
      await flushLogger(logger);
    }
    return;
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ event: "server.started", port: env.PORT }, "HTTP server started");
  });

  closeWithGrace(
    {
      delay: env.SHUTDOWN_TIMEOUT_MS,
      logger,
      onTimeout: (delay) => {
        logger.fatal({ event: "shutdown.timeout", timeoutMs: delay }, "shutdown timed out");
      },
    },
    async ({ signal, err }) => {
      markShuttingDown();
      logger[err ? "fatal" : "info"](
        { event: "shutdown.started", signal, err },
        "server shutting down",
      );

      const errors: unknown[] = [];

      if (server.listening) {
        try {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          });
        } catch (error) {
          errors.push(error);
          logger.error(
            { event: "shutdown.http.failed", err: error },
            "HTTP server failed to close",
          );
        }
      }

      try {
        await closeDb();
      } catch (error) {
        errors.push(error);
        logger.error({ event: "shutdown.database.failed", err: error }, "database failed to close");
      }

      if (errors.length > 0) {
        await flushLogger(logger);
        throw new AggregateError(errors, "Graceful shutdown failed");
      }

      logger.info({ event: "shutdown.completed" }, "graceful shutdown completed");
      await flushLogger(logger);
    },
  );
}

void start();
