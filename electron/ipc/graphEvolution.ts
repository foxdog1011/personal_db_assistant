import { ipcMain } from "electron";
import type sqlite3 from "sqlite3";

export interface IpcContext {
  db: sqlite3.Database;
}

/** 註冊 IPC：查詢知識演化（Triple 演化紀錄） */
export function registerGraphEvolutionIpc(db: sqlite3.Database) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS triples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        head TEXT NOT NULL,
        relation TEXT NOT NULL,
        tail TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  ipcMain.handle("get-graph-evolution", async () => {
    return new Promise<{ success: boolean; steps?: any[]; error?: string }>((resolve) => {
      db.all(
        `SELECT head, relation, tail, created_at FROM triples ORDER BY created_at ASC`,
        (err, rows: any[]) => {
          if (err) {
            console.error("[EVOL] ❌ get-graph-evolution error:", err);
            return resolve({ success: false, error: err.message });
          }

          const steps = rows.map((r, i) => ({
            step: i + 1,
            head: r.head,
            relation: r.relation,
            tail: r.tail,
            created_at: r.created_at,
          }));

          console.log(`[EVOL] 📈 Loaded ${steps.length} evolution records`);
          resolve({ success: true, steps });
        }
      );
    });
  });
}

/** 註冊 IPC：插入新的 Triple（三元組） */
export function registerInsertTripleIpc(db: sqlite3.Database) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS triples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        head TEXT NOT NULL,
        relation TEXT NOT NULL,
        tail TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  ipcMain.handle("insert-triple", async (_event, triple: { head: string; relation: string; tail: string }) => {
    return new Promise<{ success: boolean; id?: number; error?: string }>((resolve) => {
      const { head, relation, tail } = triple;
      db.run(
        `INSERT INTO triples (head, relation, tail) VALUES (?, ?, ?)`,
        [head, relation, tail],
        function (err) {
          if (err) {
            console.error("[EVOL] ❌ insert-triple error:", err);
            return resolve({ success: false, error: err.message });
          }

          console.log(`[EVOL] ✅ Inserted ${head} -[${relation}]-> ${tail}`);
          resolve({ success: true, id: this.lastID });
        }
      );
    });
  });
}
