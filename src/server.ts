import { app } from "./app.js";
import { env } from "./config/env.js";
import { closeDb } from "./db/client.js";

const server = app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

let isShuttingDown = false;

async function shutdown(reason: string, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${reason}. Shutting down...`);

  const forceShutdown = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceShutdown.unref();

  let shutdownFailed = false;

  if (server.listening) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      shutdownFailed = true;
      console.error("Failed to close HTTP server", error);
    }
  }

  try {
    await closeDb();
  } catch (error) {
    shutdownFailed = true;
    console.error("Failed to close database pool", error);
  }

  clearTimeout(forceShutdown);
  process.exitCode = shutdownFailed ? 1 : exitCode;
}

server.on("error", (error) => {
  console.error("HTTP server error", error);
  void shutdown("HTTP server error", 1);
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM received");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT received");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  void shutdown("Uncaught exception", 1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);
  void shutdown("Unhandled rejection", 1);
});
