import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { app } from "electron";
import { rebuildMissingEmbeddings } from "../services/embedding_service";
import { logger } from "../utils/logger";

let db: sqlite3.Database | null = null;
logger.info("[DB] init.ts module loaded");

/**
 * 初始化 SQLite 資料庫
 * - 使用固定路徑 (process.cwd()/db/notes.db)
 */
export function initDatabase() {
  if (db) return db;

  const dbDir = path.join(process.cwd(), "db");
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, "notes.db");
  logger.info("[DB] init path", { dbPath });

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error("[DB] initDatabase:error", err);
      return;
    }

    logger.info("[DB] Database initialized", { dbPath });

    db!.serialize(() => {
      db!.run(`
        CREATE TABLE IF NOT EXISTS notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          tags TEXT,
          summary TEXT,
          insight TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          pinned INTEGER DEFAULT 0,
          color TEXT DEFAULT '#ffffff',
          type TEXT DEFAULT 'text'
        )
      `);

      db!.run(`
        CREATE TABLE IF NOT EXISTS concept_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          relation TEXT NOT NULL,
          target TEXT NOT NULL,
          note_id INTEGER,
          FOREIGN KEY (note_id) REFERENCES notes(id)
        )
      `);

      db!.run(`
        CREATE TABLE IF NOT EXISTS relations (
          from_note INTEGER,
          to_note INTEGER,
          score REAL DEFAULT 0,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (from_note, to_note)
        )
      `);

      db!.run(
        `
        CREATE TABLE IF NOT EXISTS embeddings (
          note_id INTEGER PRIMARY KEY,
          vector TEXT
        )
        `,
        (err) => {
          if (err) logger.error("[DB] embeddings table create error", err);
          else logger.info("[DB] embeddings table ensured");
        }
      );

      db!.run(
        `
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
        `,
        (err) => {
          if (err) logger.error("[DB] ai_jobs table create error", err);
          else logger.info("[DB] ai_jobs table ensured");
        }
      );

      db!.run(
        `
        CREATE TABLE IF NOT EXISTS relation_evidence (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          relation_id INTEGER NOT NULL,
          note_id INTEGER NOT NULL,
          snippet TEXT NOT NULL,
          source_text TEXT NOT NULL,
          source_offset_start INTEGER,
          source_offset_end INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(relation_id, note_id)
        )
        `,
        (err) => {
          if (err) logger.error("[DB] relation_evidence table create error", err);
          else logger.info("[DB] relation_evidence table ensured");
        }
      );

      db!.run("CREATE INDEX IF NOT EXISTS idx_evi_relation ON relation_evidence(relation_id)");
      db!.run("CREATE INDEX IF NOT EXISTS idx_evi_note ON relation_evidence(note_id)");

      db!.run(
        "UPDATE embeddings SET vector = NULL WHERE typeof(vector) != 'text';",
        (err) => {
          if (err) logger.error("[DB] embeddings 清理失敗", err);
          else logger.info("[DB] embeddings 非 text 欄位已重設為 NULL");
        }
      );

      const ensureNoteColumn = (col: string, type: string) => {
        db!.all(`PRAGMA table_info(notes)`, [], (_, rows) => {
          const hasColumn = rows.some((r: any) => r.name === col);
          if (!hasColumn) {
            db!.run(`ALTER TABLE notes ADD COLUMN ${col} ${type}`);
            logger.info(`[DB] Added missing column on notes: ${col}`);
          }
        });
      };
      ensureNoteColumn("insight", "TEXT");
      ensureNoteColumn("summary", "TEXT");
      ensureNoteColumn("type", "TEXT DEFAULT 'text'");
      ensureNoteColumn("color", "TEXT DEFAULT '#ffffff'");

      // Migrate concept_relations: add canonical_source, canonical_target, support_count, last_seen_at + indexes
      db!.all(`PRAGMA table_info(concept_relations)`, [], (_, rows) => {
        const names = new Set((rows as any[] || []).map((r: any) => r.name));
        db!.serialize(() => {
          if (!names.has("canonical_source"))
            db!.run("ALTER TABLE concept_relations ADD COLUMN canonical_source TEXT");
          if (!names.has("canonical_target"))
            db!.run("ALTER TABLE concept_relations ADD COLUMN canonical_target TEXT");
          if (!names.has("support_count"))
            db!.run("ALTER TABLE concept_relations ADD COLUMN support_count INTEGER NOT NULL DEFAULT 1");
          if (!names.has("last_seen_at"))
            db!.run("ALTER TABLE concept_relations ADD COLUMN last_seen_at TEXT");
          db!.run("CREATE INDEX IF NOT EXISTS idx_rel_note_id ON concept_relations(note_id)");
          db!.run("CREATE INDEX IF NOT EXISTS idx_rel_canonical ON concept_relations(canonical_source, canonical_target)");
          db!.run("CREATE INDEX IF NOT EXISTS idx_rel_support ON concept_relations(support_count)", (err) => {
            if (err) logger.error("[DB] concept_relations index error", { error: err.message });
            else logger.info("[DB] concept_relations schema migrated");
          });
        });
      });

      db!.all(`PRAGMA table_info(relations)`, [], (_, rows) => {
        const names = new Set((rows as any[] || []).map((r: any) => r.name));
        const addIfMissing = (
          col: string,
          def: string,
          isConstantDefault = true
        ): Promise<void> =>
          new Promise((resolve) => {
            if (!names.has(col)) {
              const safeDef = isConstantDefault
                ? def
                : def.replace("CURRENT_TIMESTAMP", "'1970-01-01 00:00:00'");
              db!.run(
                `ALTER TABLE relations ADD COLUMN ${col} ${safeDef}`,
                (err) => {
                  if (err)
                    logger.error(`[DB] Failed to add column ${col}`, { error: err.message });
                  else logger.info(`[DB] Added missing column on relations: ${col}`);
                  resolve();
                }
              );
            } else resolve();
          });

        (async () => {
          await addIfMissing("from_note", "INTEGER");
          await addIfMissing("to_note", "INTEGER");
          await addIfMissing("score", "REAL DEFAULT 0");
          await addIfMissing("updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP", false);
          logger.info("[DB] relations table migrated successfully");
        })();
      });

      logger.info("[DB] All tables ready");

      setTimeout(() => {
        rebuildMissingEmbeddings(db!)
          .then(() => logger.info("[EMBED] Embedding rebuild complete"))
          .catch((err) => logger.error("[EMBED] Embedding rebuild failed", err));
      }, 2000);
    });
  });

  return db;
}

export function getDb() {
  if (!db) throw new Error("[DB] not initialized");
  return db;
}
