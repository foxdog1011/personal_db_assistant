import type { Database } from "sqlite3";
import { logger } from "../utils/logger";

export type JobStatus = "pending" | "running" | "done" | "error";
export type JobType = "summary" | "triples" | "embedding";

export interface AiJob {
  id: number;
  note_id: number;
  job_type: JobType;
  status: JobStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiJobStats {
  pending: number;
  running: number;
  error: number;
  done: number;
}

// ─── helpers ──────────────────────────────────────────

function run(db: Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function get<T = any>(db: Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
  });
}

function all<T = any>(db: Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows || []) as T[])));
  });
}

// ─── public API ───────────────────────────────────────

/**
 * Enqueue a job. INSERT OR IGNORE ensures UNIQUE(note_id, job_type)
 * prevents duplicates — a second call for the same pair is a no-op.
 */
export async function enqueueJob(
  db: Database,
  noteId: number,
  jobType: JobType
): Promise<void> {
  await run(
    db,
    `INSERT OR IGNORE INTO ai_jobs (note_id, job_type, status, attempts, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, datetime('now'), datetime('now'))`,
    [noteId, jobType]
  );
  logger.info("[QUEUE] enqueue", { noteId, jobType });
}

/**
 * Claim the next pending job (oldest first) and mark it running.
 * Returns undefined if nothing to do.
 */
export async function claimNextJob(db: Database): Promise<AiJob | undefined> {
  const job = await get<AiJob>(
    db,
    `SELECT * FROM ai_jobs
     WHERE status = 'pending' AND attempts < 3
     ORDER BY created_at ASC LIMIT 1`
  );
  if (!job) return undefined;

  await run(
    db,
    `UPDATE ai_jobs SET status = 'running', attempts = attempts + 1, updated_at = datetime('now')
     WHERE id = ?`,
    [job.id]
  );
  logger.info("[QUEUE] claimed", { id: job.id, noteId: job.note_id, type: job.job_type });
  return { ...job, status: "running", attempts: job.attempts + 1 };
}

/**
 * Mark a job as done.
 */
export async function completeJob(db: Database, jobId: number): Promise<void> {
  await run(
    db,
    `UPDATE ai_jobs SET status = 'done', last_error = NULL, updated_at = datetime('now')
     WHERE id = ?`,
    [jobId]
  );
  logger.info("[QUEUE] done", { jobId });
}

/**
 * Mark a job as error. If attempts >= 3 it stays in error and won't be retried.
 */
export async function failJob(
  db: Database,
  jobId: number,
  errorMsg: string
): Promise<void> {
  // Redact any key-like strings before persisting
  const safeMsg = errorMsg.replace(/\b(sk-[A-Za-z0-9_-]{10,})\b/g, "[REDACTED]");
  await run(
    db,
    `UPDATE ai_jobs SET status = 'error', last_error = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [safeMsg, jobId]
  );
  logger.error("[QUEUE] failed", { jobId, error: safeMsg });
}

/**
 * Aggregate counts by status.
 */
export async function getJobStats(db: Database): Promise<AiJobStats> {
  const rows = await all<{ status: string; cnt: number }>(
    db,
    `SELECT status, COUNT(*) AS cnt FROM ai_jobs GROUP BY status`
  );
  const stats: AiJobStats = { pending: 0, running: 0, error: 0, done: 0 };
  for (const r of rows) {
    if (r.status in stats) (stats as any)[r.status] = r.cnt;
  }
  return stats;
}

/**
 * Get jobs for a specific note.
 */
export async function getJobsForNote(
  db: Database,
  noteId: number
): Promise<AiJob[]> {
  return all<AiJob>(
    db,
    `SELECT * FROM ai_jobs WHERE note_id = ? ORDER BY created_at`,
    [noteId]
  );
}
