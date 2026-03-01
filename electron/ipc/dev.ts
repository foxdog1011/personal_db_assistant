import { app, ipcMain } from "electron";
import type sqlite3 from "sqlite3";
import { getJobStats, getJobsForNote } from "../services/ai_job_queue";
import { getWorkerStatus, pauseWorker, resumeWorker } from "../services/ai_job_worker";

/**
 * 用於開發環境的 IPC：清理資料庫 / 重設資料 / 診斷
 */
export function registerDevIpc(db: sqlite3.Database) {
  /* ====================================================
     🩺 Diagnostics — always available
  ==================================================== */
  ipcMain.handle("get-diagnostics", async () => {
    const pkg = require("../../package.json");

    // Count notes
    const notesCount = await new Promise<number>((resolve) => {
      db.get("SELECT COUNT(*) AS cnt FROM notes", [], (err: Error | null, row: any) => {
        resolve(err ? -1 : row?.cnt ?? 0);
      });
    });

    // DB path
    let dbPath: string | undefined;
    let dbError: string | null = null;
    try {
      dbPath = (db as any).filename || undefined;
    } catch (e: any) {
      dbError = e?.message || String(e);
    }

    return {
      app: {
        version: pkg.version,
        electron: process.versions.electron,
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
      },
      dev: {
        VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL || null,
        port: process.env.VITE_DEV_SERVER_URL
          ? Number(new URL(process.env.VITE_DEV_SERVER_URL).port) || null
          : null,
      },
      db: {
        dbPath: dbPath || null,
        notesCount,
        lastError: dbError,
      },
      ai: {
        mockMode: process.env.MOCK_OPENAI === "1",
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        lastError: null,
      },
      ipc: {
        ready: true,
      },
    };
  });

  /* ====================================================
     🧠 AI Job Queue stats
  ==================================================== */
  ipcMain.handle("get-ai-job-stats", async () => {
    return getJobStats(db);
  });

  ipcMain.handle("get-note-ai-jobs", async (_, noteId: string) => {
    // Accept string from renderer; SQLite will coerce to INTEGER for the note_id column
    return getJobsForNote(db, parseInt(noteId, 10));
  });

  /* ====================================================
     Worker control: pause / resume / status
  ==================================================== */
  ipcMain.handle("get-worker-status", async () => {
    return getWorkerStatus();
  });

  ipcMain.handle("pause-worker", async () => {
    pauseWorker();
    return { success: true };
  });

  ipcMain.handle("resume-worker", async () => {
    resumeWorker();
    return { success: true };
  });

  /* ====================================================
     🧹 DB reset — dev/non-production only
  ==================================================== */
  const allow =
    process.env.ENABLE_DB_RESET === "1" ||
    process.env.NODE_ENV !== "production";

  if (!allow) return;

  /** ✅ 清空 Graph 資料（不影響 notes） */
  ipcMain.handle("clear-graph-data", async () => {
    return new Promise((resolve) => {
      try {
        db.serialize(() => {
          db.run("BEGIN");
          const exec = (sql: string) => db.run(sql, () => {});

          exec("DELETE FROM concept_relations");
          exec("DELETE FROM relations");
          exec("DELETE FROM embeddings");
          exec(
            "DELETE FROM sqlite_sequence WHERE name IN ('concept_relations','relations','embeddings')"
          );

          db.run("COMMIT", (err: Error | null) => {
            if (err) {
              try {
                db.run("ROLLBACK");
              } catch {}
              return resolve({ success: false, error: err.message });
            }

            db.run("VACUUM", (vacErr: Error | null) => {
              if (vacErr)
                return resolve({
                  success: false,
                  error: `VACUUM failed: ${vacErr.message}`,
                });
              resolve({ success: true });
            });
          });
        });
      } catch (e: any) {
        resolve({ success: false, error: e?.message || String(e) });
      }
    });
  });

  /** 🧹 全資料庫重設（包含 notes） */
  ipcMain.handle("reset-database", async () => {
    return new Promise((resolve) => {
      try {
        db.serialize(() => {
          db.run("BEGIN");
          const exec = (sql: string) => db.run(sql, () => {});

          exec("DELETE FROM concept_relations");
          exec("DELETE FROM relations");
          exec("DELETE FROM embeddings");
          exec("DELETE FROM notes");
          exec(
            "DELETE FROM sqlite_sequence WHERE name IN ('notes','concept_relations','relations','embeddings')"
          );

          db.run("COMMIT", (err: Error | null) => {
            if (err) {
              try {
                db.run("ROLLBACK");
              } catch {}
              return resolve({ success: false, error: err.message });
            }

            db.run("VACUUM", (vacErr: Error | null) => {
              if (vacErr)
                return resolve({
                  success: false,
                  error: `VACUUM failed: ${vacErr.message}`,
                });
              resolve({ success: true });
            });
          });
        });
      } catch (e: any) {
        resolve({ success: false, error: e?.message || String(e) });
      }
    });
  });
}
