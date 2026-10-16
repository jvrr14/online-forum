import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { deleteExpiredSessions, EXPIRED_SESSION_BATCH_SIZE } from "../modules/auth/auth.service.js";

export function startSessionCleanup(): () => Promise<void> {
  let stopping = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void>;

  const run = (): void => {
    let nextDelay = env.SESSION_CLEANUP_INTERVAL_MS;
    inFlight = deleteExpiredSessions()
      .then((deleted) => {
        if (deleted > 0) {
          logger.info({ event: "auth.sessions.cleaned", deleted }, "expired sessions removed");
        }
        // Drain a backlog in bounded batches without waiting a full interval.
        if (deleted === EXPIRED_SESSION_BATCH_SIZE) {
          nextDelay = 1_000;
        }
      })
      .catch((error: unknown) => {
        logger.error(
          { event: "auth.sessions.cleanup.failed", err: error },
          "session cleanup failed",
        );
      })
      .finally(() => {
        if (!stopping) {
          timer = setTimeout(run, nextDelay);
          timer.unref();
        }
      });
  };

  run();
  return async (): Promise<void> => {
    stopping = true;
    if (timer) {
      clearTimeout(timer);
    }
    await inFlight;
  };
}
