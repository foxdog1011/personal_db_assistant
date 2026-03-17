import type sqlite3 from "sqlite3";
import { enqueueJob } from "./ai_job_queue";
import { buildRelations } from "./relation_service";
import { logger } from "../utils/logger";

export interface NoteRow {
  id: number;
  content: string;
  tags: string | null;
  summary: string | null;
  insight: string | null;
  created_at: string;
  pinned: number;
  color: string | null;
  type: string | null;
}

export interface CreateNoteInput {
  content: string;
  tags?: string;
  createdAt?: string; // optional explicit timestamp; fallback to CURRENT_TIMESTAMP
  type?: string;
}

export interface CreateNoteResult { success: boolean; id?: number; error?: string }

export function searchNotes(
  db: sqlite3.Database,
  { query, limit }: { query: string; limit?: number }
): Promise<NoteRow[]> {
  const q = `%${query || ""}%`;
  return new Promise((resolve) => {
    const baseSql = `SELECT * FROM notes WHERE content LIKE ? OR tags LIKE ? ORDER BY created_at DESC`;
    const sql = typeof limit === "number" ? `${baseSql} LIMIT ?` : baseSql;
    const params = typeof limit === "number" ? [q, q, limit] : [q, q];
    db.all(sql, params, (_err, rows: any[]) => {
      if (_err) {
        logger.error("[DB] search-notes:error", _err);
        return resolve([]);
      }
      resolve((rows || []) as NoteRow[]);
    });
  });
}

export function getNoteById(db: sqlite3.Database, id: number): Promise<NoteRow | null> {
  return new Promise((resolve) => {
    db.get(`SELECT * FROM notes WHERE id = ?`, [id], (err, row: any) => {
      if (err) {
        logger.error("[DB] getNoteById:error", err);
        return resolve(null);
      }
      resolve((row as NoteRow) || null);
    });
  });
}

export function createNote(
  db: sqlite3.Database,
  input: CreateNoteInput
): Promise<CreateNoteResult> {
  const { content, tags = "", createdAt, type } = input;
  return new Promise((resolve) => {
    const sql = createdAt
      ? `INSERT INTO notes (content, tags, created_at${type ? ", type" : ""}) VALUES (?, ?, ?, ${type ? "?" : ""})`
      : `INSERT INTO notes (content, tags${type ? ", type" : ""}) VALUES (?, ?${type ? ", ?" : ""})`;
    const params = createdAt
      ? ([content, tags, createdAt] as any[])
      : ([content, tags] as any[]);
    if (type) params.push(type);

    db.run(sql, params, async function (err) {
      if (err) {
        logger.error("[DB] createNote:error", err);
        return resolve({ success: false, error: err.message });
      }
      const noteId = this.lastID as number;
      logger.info("[DB] createNote", { noteId });

      try {
        await enqueueJob(db, noteId, "summary");
        await enqueueJob(db, noteId, "triples");
        await enqueueJob(db, noteId, "embedding");
      } catch (e: any) {
        logger.error("[QUEUE] enqueue failed after createNote", { noteId, error: e?.message });
      }

      resolve({ success: true, id: noteId });
    });
  });
}

export function updateNote(
  db: sqlite3.Database,
  { id, content, tags, insight }: { id: number; content?: string; tags?: string; insight?: string }
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const updates: string[] = [];
    const params: any[] = [];
    if (typeof content === "string") { updates.push("content = ?"); params.push(content); }
    if (typeof tags === "string") { updates.push("tags = ?"); params.push(tags); }
    if (typeof insight === "string") { updates.push("insight = ?"); params.push(insight); }

    if (updates.length === 0) return resolve({ success: false, error: "No updatable fields provided" });

    const sql = `UPDATE notes SET ${updates.join(", ")} WHERE id = ?`;
    params.push(id);

    db.run(sql, params, async (err) => {
      if (err) {
        logger.error("[DB] updateNote:error", err);
        return resolve({ success: false, error: err.message });
      }
      try {
        if (typeof content === "string") await buildRelations(db, id, content);
      } catch (e: any) {
        logger.error("[REL] buildRelations after updateNote failed", { id, error: e?.message });
      }
      logger.info("[DB] updateNote: note updated", { id });
      resolve({ success: true });
    });
  });
}
