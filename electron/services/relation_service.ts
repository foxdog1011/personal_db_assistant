import { Database } from "sqlite3";
import { getEmbedding, findSimilarNotes } from "./embedding_service";
import { logger } from "../utils/logger";

/**
 * 🧱 確保 relations schema 存在與正確
 */
async function ensureRelationsSchema(db: Database): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `CREATE TABLE IF NOT EXISTS relations (
          from_note INTEGER NOT NULL,
          to_note INTEGER NOT NULL,
          score REAL NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (from_note, to_note)
        )`,
        (err) => {
          if (err) return reject(err);

          db.all(`PRAGMA table_info(relations)`, [], (e, rows: any[]) => {
            if (e) return reject(e);
            const names = new Set((rows || []).map((r: any) => r.name));

            const alters: Array<Promise<void>> = [];
            if (!names.has("score")) {
              alters.push(
                new Promise<void>((res, rej) =>
                  db.run(`ALTER TABLE relations ADD COLUMN score REAL DEFAULT 0`, (err2) =>
                    err2 ? rej(err2) : res()
                  )
                )
              );
            }
            if (!names.has("updated_at")) {
              alters.push(
                new Promise<void>((res, rej) =>
                  db.run(
                    `ALTER TABLE relations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
                    (err3) => (err3 ? rej(err3) : res())
                  )
                )
              );
            }
            Promise.all(alters)
            .then(() => resolve())
            .catch(reject);

          });
        }
      );
    });
  });
}

/** 📘 相關筆記型別 */
export interface RelatedNote {
  id: number;
  content: string;
  score: number;
}

/**
 * 🧠 建立筆記間相似關聯（使用 Embeddings）
 */
export async function buildRelations(
  db: Database,
  noteId: number,
  content: string
): Promise<RelatedNote[]> {
  if (!content?.trim()) {
    logger.warn(`[REL] ⚠️ Note ${noteId} 無內容，略過關聯建立`);
    return [];
  }

  try {
    await ensureRelationsSchema(db);

    const vector = await getEmbedding(content);
    const similarNotes = (await findSimilarNotes(db, vector, 10)) as RelatedNote[];
    if (!similarNotes?.length) {
      logger.info(`[REL] ℹ️ Note ${noteId} 無可建立的關聯`);
      return [];
    }

    // 🔧 新增清除舊資料步驟
    await new Promise<void>((resolve, reject) => {
      db.run("DELETE FROM relations WHERE from_note = ?", [noteId], (err) => {
        if (err) {
          logger.error(`[REL] ❌ 清除舊關聯失敗 for note ${noteId}`, err);
          return reject(err);
        }
        resolve();
      });
    });

    // 插入新關聯
    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO relations (from_note, to_note, score, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);

        for (const { id: otherId, score } of similarNotes) {
          if (otherId !== noteId && score > 0.55) {
            stmt.run(noteId, otherId, score);
            stmt.run(otherId, noteId, score);
          }
        }

        stmt.finalize((err) => {
          if (err) {
            logger.error(`[REL] ❌ Transaction failed for note ${noteId}`, err);
            db.run("ROLLBACK");
            reject(err);
          } else {
            db.run("COMMIT");
            resolve();
          }
        });
      });
    });

    const inserted = similarNotes.filter((n) => n.id !== noteId && n.score > 0.55);
    logger.info(`[REL] ✅ 已更新 Note ${noteId} 的相似關聯 (${inserted.length} 筆)`);

    return inserted;
  } catch (err) {
    logger.error(`[REL] ❌ 建立 Note ${noteId} 關聯失敗`, err);
    return [];
  }
}

/**
 * 🔍 取得指定筆記的關聯筆記列表
 */
export async function getRelatedNotes(
  db: Database,
  noteId: number,
  limit = 10
): Promise<RelatedNote[]> {
  return new Promise((resolve, reject) => {
    db.all<RelatedNote>(
      `
      SELECT n.id, n.content, r.score
      FROM relations r
      JOIN notes n ON r.to_note = n.id
      WHERE r.from_note = ?
      ORDER BY r.score DESC
      LIMIT ?
      `,
      [noteId, limit],
      (err, rows) => {
        if (err) {
          logger.error("[REL] ❌ getRelatedNotes 查詢失敗", err);
          reject(err);
          return;
        }

        const result = rows || [];
        logger.info(`[REL] 🔍 Note ${noteId} 找到 ${result.length} 筆相關筆記`);
        resolve(result);
      }
    );
  });
}
