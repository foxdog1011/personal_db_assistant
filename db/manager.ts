import sqlite3 from "sqlite3";
import { Database } from "sqlite3";

let db: Database | null = null;

export type NoteRow = {
  id: number;
  content: string;
  tags: string;
  created_at?: string;
  pinned?: number;
  color?: string;
  summary?: string;
  type?: string;
};

export function initDatabase(dbFilePath: string) {
  if (db) return;
  db = new sqlite3.Database(dbFilePath);
  db.serialize(() => {
    db!.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pinned INTEGER DEFAULT 0,
        color TEXT DEFAULT '#ffffff',
        summary TEXT,
        type TEXT DEFAULT 'text'
      )
    `);

    ["summary", "type"].forEach((col) => {
      db!.run(`ALTER TABLE notes ADD COLUMN ${col} TEXT`, (err) => {
        if (err && !err.message.includes("duplicate column")) {
          console.error(`Failed to add column ${col}:`, err);
        }
      });
    });

    db!.run(`
      CREATE TABLE IF NOT EXISTS concept_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        relation TEXT NOT NULL,
        target TEXT NOT NULL,
        note_id INTEGER,
        canonical_source TEXT,
        canonical_target TEXT,
        support_count INTEGER NOT NULL DEFAULT 1,
        last_seen_at TEXT,
        FOREIGN KEY (note_id) REFERENCES notes(id)
      )
    `);

    db!.run(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER UNIQUE NOT NULL,
        vector TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (note_id) REFERENCES notes(id)
      )
    `);

    db!.run(`
      CREATE TABLE IF NOT EXISTS ai_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(note_id, job_type)
      )
    `);

    db!.run(`
      CREATE TABLE IF NOT EXISTS relation_evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        relation_id INTEGER NOT NULL,
        note_id INTEGER NOT NULL,
        snippet TEXT NOT NULL,
        source_text TEXT NOT NULL,
        source_offset_start INTEGER,
        source_offset_end INTEGER,
        best_sentence TEXT,
        confidence REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(relation_id, note_id)
      )
    `);

    db!.run("CREATE INDEX IF NOT EXISTS idx_evi_relation ON relation_evidence(relation_id)");
    db!.run("CREATE INDEX IF NOT EXISTS idx_evi_note ON relation_evidence(note_id)");
  });
}

export function insertNote(
  content: string,
  tags: string,
  summary: string,
  type: string
): Promise<NoteRow> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    db.run(
      "INSERT INTO notes (content, tags, summary, type) VALUES (?, ?, ?, ?)",
      [content, tags, summary, type],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, content, tags, summary, type });
      }
    );
  });
}

export function searchNotes(
  query: string,
  orderBy?: string
): Promise<NoteRow[]> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    let orderClause = "ORDER BY pinned DESC, created_at DESC";
    if (orderBy === "content") {
      orderClause = "ORDER BY pinned DESC, content ASC";
    }
    db!.all(
      `SELECT * FROM notes 
       WHERE content LIKE ? OR tags LIKE ? OR summary LIKE ? 
       ${orderClause}`,
      [`%${query}%`, `%${query}%`, `%${query}%`],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows as NoteRow[]);
      }
    );
  });
}

export function deleteNote(id: number): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    db!.run("DELETE FROM notes WHERE id = ?", [id], function (err) {
      if (err) reject(err);
      else resolve({ success: this.changes > 0 });
    });
  });
}

export function updateNote(
  id: number,
  content: string,
  tags: string
): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    db!.run(
      "UPDATE notes SET content = ?, tags = ? WHERE id = ?",
      [content, tags, id],
      function (err) {
        if (err) reject(err);
        else resolve({ success: this.changes > 0 });
      }
    );
  });
}

export function togglePin(
  id: number
): Promise<{ success: boolean; pinned: number }> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    db!.get("SELECT pinned FROM notes WHERE id = ?", [id], (err, row: any) => {
      if (err) return reject(err);
      if (!row) return resolve({ success: false, pinned: 0 });
      const newPinned = row.pinned === 1 ? 0 : 1;
      db!.run(
        "UPDATE notes SET pinned = ? WHERE id = ?",
        [newPinned, id],
        function (err) {
          if (err) reject(err);
          else resolve({ success: this.changes > 0, pinned: newPinned });
        }
      );
    });
  });
}

export function updateColor(
  id: number,
  color: string
): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    db!.run(
      "UPDATE notes SET color = ? WHERE id = ?",
      [color, id],
      function (err) {
        if (err) reject(err);
        else resolve({ success: this.changes > 0 });
      }
    );
  });
}

export function saveSummary(
  id: number,
  summary: string
): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    db!.run(
      "UPDATE notes SET summary = ? WHERE id = ?",
      [summary, id],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

export function closeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    db!.close((err) => {
      if (err) return reject(err);
      db = null;
      resolve();
    });
  });
}

export function getDb(): Database | null {
  return db;
}

export function getNotesByIds(ids: number[]): Promise<{ id: number; content: string }[]> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("DB not initialized"));
    if (!ids || ids.length === 0) return resolve([]);
    const placeholders = ids.map(() => "?").join(",");
    db!.all(
      `SELECT id, content FROM notes WHERE id IN (${placeholders})`,
      ids,
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows as { id: number; content: string }[]);
      }
    );
  });
}
