import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  initDatabase,
  insertNote,
  closeDatabase,
  getDb,
} from "../db/manager";

/**
 * Thin wrappers mirroring ai_job_queue.ts but operating directly on the
 * test in-memory DB so we don't need to import Electron-only modules.
 */

function run(db: import("sqlite3").Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => (err ? reject(err) : resolve()));
  });
}

function get<T = any>(db: import("sqlite3").Database, sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
  });
}

function all<T = any>(db: import("sqlite3").Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve((rows || []) as T[])));
  });
}

async function enqueueJob(db: import("sqlite3").Database, noteId: number, jobType: string): Promise<void> {
  await run(
    db,
    `INSERT OR IGNORE INTO ai_jobs (note_id, job_type, status, attempts, created_at, updated_at)
     VALUES (?, ?, 'pending', 0, datetime('now'), datetime('now'))`,
    [noteId, jobType]
  );
}

async function claimNextJob(db: import("sqlite3").Database) {
  const job = await get<any>(
    db,
    `SELECT * FROM ai_jobs WHERE status = 'pending' AND attempts < 3 ORDER BY created_at ASC LIMIT 1`
  );
  if (!job) return undefined;
  await run(
    db,
    `UPDATE ai_jobs SET status = 'running', attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?`,
    [job.id]
  );
  return { ...job, status: "running", attempts: job.attempts + 1 };
}

async function completeJob(db: import("sqlite3").Database, jobId: number): Promise<void> {
  await run(
    db,
    `UPDATE ai_jobs SET status = 'done', last_error = NULL, updated_at = datetime('now') WHERE id = ?`,
    [jobId]
  );
}

async function failJob(db: import("sqlite3").Database, jobId: number, errorMsg: string): Promise<void> {
  const safeMsg = errorMsg.replace(/\b(sk-[A-Za-z0-9_-]{10,})\b/g, "[REDACTED]");
  await run(
    db,
    `UPDATE ai_jobs SET status = 'error', last_error = ?, updated_at = datetime('now') WHERE id = ?`,
    [safeMsg, jobId]
  );
}

async function getJobStats(db: import("sqlite3").Database) {
  const rows = await all<{ status: string; cnt: number }>(
    db,
    `SELECT status, COUNT(*) AS cnt FROM ai_jobs GROUP BY status`
  );
  const stats: Record<string, number> = { pending: 0, running: 0, error: 0, done: 0 };
  for (const r of rows) {
    if (r.status in stats) stats[r.status] = r.cnt;
  }
  return stats;
}

describe("ai_jobs lifecycle", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("pending → running → done", async () => {
    const db = getDb()!;
    const note = await insertNote("lifecycle test", "tag", "", "text");

    await enqueueJob(db, note.id, "summary");

    // Verify pending
    const pending = await get<any>(db, "SELECT * FROM ai_jobs WHERE note_id = ? AND job_type = 'summary'", [note.id]);
    expect(pending).toBeDefined();
    expect(pending!.status).toBe("pending");
    expect(pending!.attempts).toBe(0);

    // Claim → running
    const claimed = await claimNextJob(db);
    expect(claimed).toBeDefined();
    expect(claimed!.status).toBe("running");
    expect(claimed!.attempts).toBe(1);

    // Complete → done
    await completeJob(db, claimed!.id);
    const done = await get<any>(db, "SELECT * FROM ai_jobs WHERE id = ?", [claimed!.id]);
    expect(done!.status).toBe("done");
    expect(done!.last_error).toBeNull();
  });

  it("pending → running → error with redacted key", async () => {
    const db = getDb()!;
    const note = await insertNote("error test", "tag", "", "text");

    await enqueueJob(db, note.id, "triples");
    const claimed = await claimNextJob(db);
    expect(claimed).toBeDefined();

    // Fail with an error containing a fake API key
    await failJob(db, claimed!.id, "Auth failed: sk-abcdefghij1234567890");
    const failed = await get<any>(db, "SELECT * FROM ai_jobs WHERE id = ?", [claimed!.id]);
    expect(failed!.status).toBe("error");
    expect(failed!.last_error).toContain("[REDACTED]");
    expect(failed!.last_error).not.toContain("sk-abcdefghij");
  });

  it("getJobStats reflects correct counts", async () => {
    const db = getDb()!;
    const stats = await getJobStats(db);
    // From the two tests above we should have 1 done + 1 error (at minimum)
    expect(stats.done).toBeGreaterThanOrEqual(1);
    expect(stats.error).toBeGreaterThanOrEqual(1);
  });

  it("claim skips jobs with attempts >= 3", async () => {
    const db = getDb()!;
    const note = await insertNote("retry test", "tag", "", "text");

    await enqueueJob(db, note.id, "embedding");
    // Manually set attempts to 3
    await run(db, "UPDATE ai_jobs SET attempts = 3 WHERE note_id = ? AND job_type = 'embedding'", [note.id]);

    // claimNextJob should NOT pick it up (it's still pending but attempts >= 3)
    // First clear any other pending jobs
    await run(db, "UPDATE ai_jobs SET status = 'done' WHERE status = 'pending' AND NOT (note_id = ? AND job_type = 'embedding')", [note.id]);

    const claimed = await claimNextJob(db);
    expect(claimed).toBeUndefined();
  });
});
