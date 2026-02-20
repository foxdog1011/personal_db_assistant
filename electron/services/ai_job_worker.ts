import type { Database } from "sqlite3";
import { logger } from "../utils/logger";
import { claimNextJob, completeJob, failJob } from "./ai_job_queue";
import { summarizeText } from "./ai_service";
import { extractTriples } from "../ai/extractTriples";
import { saveTriples, saveEvidenceForNote } from "../db/query";
import { getEmbedding, saveEmbedding } from "./embedding_service";
import { getOpenAI } from "../ai/client";

/** Promise wrapper for db.get */
function dbGet<T = any>(db: Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
  });
}

/** Promise wrapper for db.run */
function dbRun(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

async function processSummary(db: Database, noteId: number): Promise<void> {
  const row = await dbGet<{ content: string }>(db, "SELECT content FROM notes WHERE id = ?", [noteId]);
  if (!row?.content) throw new Error(`Note ${noteId} not found or empty`);

  const { summary } = await summarizeText(row.content);
  await dbRun(db, "UPDATE notes SET summary = ? WHERE id = ?", [summary, noteId]);
  logger.info("[WORKER] summary written", { noteId });
}

async function processTriples(db: Database, noteId: number): Promise<void> {
  const row = await dbGet<{ content: string }>(db, "SELECT content FROM notes WHERE id = ?", [noteId]);
  if (!row?.content) throw new Error(`Note ${noteId} not found or empty`);

  const openai = getOpenAI();
  const triples = await extractTriples(openai, row.content);
  await saveTriples(db, noteId, triples);
  await saveEvidenceForNote(db, noteId, row.content);
  logger.info("[WORKER] triples extracted", { noteId, count: triples.length });
}

async function processEmbedding(db: Database, noteId: number): Promise<void> {
  const row = await dbGet<{ content: string }>(db, "SELECT content FROM notes WHERE id = ?", [noteId]);
  if (!row?.content) throw new Error(`Note ${noteId} not found or empty`);

  const vector = await getEmbedding(row.content);
  await saveEmbedding(db, noteId, vector);
  logger.info("[WORKER] embedding saved", { noteId });
}

let running = false;
let paused = false;

async function tick(db: Database): Promise<void> {
  if (running || paused) return;
  running = true;
  try {
    const job = await claimNextJob(db);
    if (!job) return;

    logger.info("[WORKER] processing", { id: job.id, type: job.job_type, noteId: job.note_id });

    switch (job.job_type) {
      case "summary":
        await processSummary(db, job.note_id);
        break;
      case "triples":
        await processTriples(db, job.note_id);
        break;
      case "embedding":
        await processEmbedding(db, job.note_id);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    await completeJob(db, job.id);
    logger.info("[WORKER] done", { id: job.id, type: job.job_type });
  } catch (err: any) {
    logger.error("[WORKER] job failed", { error: err?.message });
    try {
      const stuck = await dbGet<{ id: number }>(
        db,
        "SELECT id FROM ai_jobs WHERE status = 'running' ORDER BY updated_at DESC LIMIT 1"
      );
      if (stuck) await failJob(db, stuck.id, err?.message ?? String(err));
    } catch {
      // ignore secondary failure
    }
  } finally {
    running = false;
  }
}

/**
 * Start the background AI job worker.
 * Polls for pending jobs every `pollMs` milliseconds.
 */
export function startAiJobWorker(db: Database, pollMs = 5_000): void {
  logger.info("[WORKER] started", { pollMs });
  setTimeout(() => tick(db), 1_000);
  setInterval(() => tick(db), pollMs);
}

/** Pause the worker — pending jobs stay queued but won't be claimed. */
export function pauseWorker(): void {
  paused = true;
  logger.info("[WORKER] paused");
}

/** Resume the worker — next tick will pick up pending jobs. */
export function resumeWorker(): void {
  paused = false;
  logger.info("[WORKER] resumed");
}

/** Get the current worker status. */
export function getWorkerStatus(): { paused: boolean } {
  return { paused };
}
