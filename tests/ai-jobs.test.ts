import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  initDatabase,
  insertNote,
  closeDatabase,
  getDb,
} from "../db/manager";

/**
 * Minimal helper — mirrors enqueueJob logic using INSERT OR IGNORE
 * directly against the test in-memory DB, so we can verify the
 * UNIQUE(note_id, job_type) constraint.
 */
function enqueueJob(
  db: import("sqlite3").Database,
  noteId: number,
  jobType: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT OR IGNORE INTO ai_jobs (note_id, job_type, status, attempts, created_at, updated_at)
       VALUES (?, ?, 'pending', 0, datetime('now'), datetime('now'))`,
      [noteId, jobType],
      function (err) {
        if (err) return reject(err);
        // this.changes === 1 means inserted, 0 means ignored (duplicate)
        resolve(this.changes);
      }
    );
  });
}

function countJobs(
  db: import("sqlite3").Database,
  noteId: number,
  jobType: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT COUNT(*) AS cnt FROM ai_jobs WHERE note_id = ? AND job_type = ?",
      [noteId, jobType],
      (err, row: any) => (err ? reject(err) : resolve(row?.cnt ?? 0))
    );
  });
}

describe("ai_jobs dedup", () => {
  beforeAll(() => {
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("INSERT OR IGNORE prevents duplicate (note_id, job_type) jobs", async () => {
    const db = getDb()!;
    const note = await insertNote("test content", "tag", "", "text");

    // First enqueue should insert
    const first = await enqueueJob(db, note.id, "summary");
    expect(first).toBe(1);

    // Second enqueue for same note+type should be ignored (no error, 0 changes)
    const second = await enqueueJob(db, note.id, "summary");
    expect(second).toBe(0);

    // Only 1 row exists
    const cnt = await countJobs(db, note.id, "summary");
    expect(cnt).toBe(1);

    // Different job_type for same note should succeed
    const third = await enqueueJob(db, note.id, "triples");
    expect(third).toBe(1);
  });
});
