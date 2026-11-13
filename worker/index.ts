/**
 * GrowBuff background worker.
 *
 * Polls the Postgres job table (the same queue /api/cron drains) and runs
 * scheduled posts, campaign sends, reminders, review requests and AI follow-ups.
 * Run alongside the web app:  npm run worker
 */
import { runDueJobs } from "../src/lib/jobs/run";
import { unscoped } from "../src/lib/db";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 5000);
let running = true;
let busy = false;

async function tick() {
  if (busy || !running) return;
  busy = true;
  try {
    const result = await runDueJobs(20);
    if (result.processed > 0) {
      console.log(`[worker] processed ${result.processed} job(s)`, result.results);
    }
  } catch (error) {
    console.error("[worker] tick failed", error);
  } finally {
    busy = false;
  }
}

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, finishing current job…`);
  running = false;
  setTimeout(async () => {
    await unscoped.$disconnect();
    process.exit(0);
  }, 200);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log(`[worker] GrowBuff worker started (every ${INTERVAL_MS}ms)`);
void tick();
setInterval(() => void tick(), INTERVAL_MS);
