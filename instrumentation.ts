/**
 * Runs once when the server boots. Starts the background sweep that deletes
 * expired task folders so uploads do not linger on disk.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { sweepExpiredTasks } = await import("@/lib/server/storage");

  const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

  const sweep = async () => {
    try {
      const removed = await sweepExpiredTasks();
      if (removed > 0) console.log(`[xtools] cleaned up ${removed} expired task(s)`);
    } catch (err) {
      console.error("[xtools] cleanup sweep failed:", err);
    }
  };

  await sweep();
  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  // Do not hold the process open just for the sweeper.
  timer.unref?.();
}
