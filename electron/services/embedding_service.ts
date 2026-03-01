// electron/services/embedding_service.ts
import OpenAI from "openai";
import { Database } from "sqlite3";
import { getOpenAI } from "../ai/client";
import { logger } from "../utils/logger";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;

// ⚡ 全域快取，避免重複計算相同內容
const embeddingCache = new Map<string, Float32Array>();

/**
 * 產生文字的向量嵌入
 */
export async function getEmbedding(text: string): Promise<Float32Array> {
  if (!text?.trim()) return new Float32Array(DIMENSIONS);

  if (process.env.MOCK_OPENAI === "1") {
    const mock = new Float32Array(DIMENSIONS);
    mock.fill(0.01);
    return mock;
  }

  // 使用快取避免重算
  if (embeddingCache.has(text)) return embeddingCache.get(text)!;

  try {
    const openai = getOpenAI();
    const response = await openai.embeddings.create({
      model: MODEL,
      input: text.slice(0, 8000),
    });

    const vector = Float32Array.from(response.data[0].embedding);
    embeddingCache.set(text, vector);
    return vector;
  } catch (err) {
    logger.warn("[EMB] getEmbedding failed, returning zero vector", err);
    return new Float32Array(DIMENSIONS);
  }
}

/**
 * 儲存嵌入結果到資料庫（保證 JSON 格式正確）
 */
export async function saveEmbedding(db: Database, noteId: number, vector: Float32Array) {
  const jsonVector = JSON.stringify(Array.from(vector)); // ✅ 正確轉換為 JSON 字串

  return new Promise<void>((resolve, reject) => {
    db.run(
      `
      INSERT OR REPLACE INTO embeddings (note_id, vector)
      VALUES (?, ?)
      `,
      [noteId, jsonVector],
      (err) => {
        if (err) {
          logger.error("[EMB] Failed to save embedding for note", { noteId, error: String(err) });
          reject(err);
        } else {
          logger.info("[EMB] Saved embedding for note", { noteId });
          resolve();
        }
      }
    );
  });
}

/**
 * 計算餘弦相似度
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

/**
 * 從資料庫中找出與當前向量最相似的筆記
 * ✅ 防呆：自動忽略無效或舊格式的向量
 */
export async function findSimilarNotes(db: Database, vector: Float32Array, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT note_id, vector FROM embeddings`, [], (err, rows) => {
      if (err) return reject(err);

      if (!rows?.length) {
        logger.info("[EMB] ℹ️ 沒有任何已儲存的 embeddings");
        return resolve([]);
      }

      const results = rows
        .map((row: any) => {
          let storedVector: Float32Array;

          try {
            // 🚧 處理 undefined / NULL / 空字串
            if (!row.vector || row.vector === "undefined" || row.vector === "null") {
              throw new Error("Empty vector");
            }

            // ✅ 嘗試解析為 JSON
            const parsed = JSON.parse(row.vector);
            if (Array.isArray(parsed) && parsed.length > 0) {
              storedVector = new Float32Array(parsed);
            } else {
              throw new Error("Not a valid array");
            }
          } catch (e) {
            // ⚠️ 若不是合法 JSON，跳過並記錄警告
            const preview =
              typeof row.vector === "string"
                ? row.vector.slice(0, 50)
                : String(row.vector);
            logger.warn(`[WARN] Invalid vector JSON for note ${row.note_id}: ${preview}`);
            storedVector = new Float32Array(DIMENSIONS); // fallback 空向量
          }

          return {
            id: row.note_id,
            score: cosineSimilarity(vector, storedVector),
          };
        })
        .filter((r) => r.score > 0); // 去除無效分數

      results.sort((a, b) => b.score - a.score);
      resolve(results.slice(0, limit));
    });
  });
}

/**
 * 🧠 自動重建缺失的 Embeddings（啟動時執行）
 */
export async function rebuildMissingEmbeddings(db: Database) {
  return new Promise<void>((resolve) => {
    db.all(
      "SELECT id, content FROM notes WHERE id NOT IN (SELECT note_id FROM embeddings WHERE vector IS NOT NULL)",
      async (err, rows) => {
        if (err) {
          logger.error("[EMBED] 查詢缺失 embedding 失敗", err);
          return resolve();
        }

        if (!rows.length) {
          logger.info("[EMBED] ✅ 所有筆記均已有 embeddings");
          return resolve();
        }

        logger.info(`[EMBED] 🔄 檢測到 ${rows.length} 筆缺失，開始重建...`);
        // ✅ 明確指定 rows 的型別
        const typedRows = rows as { id: number; content: string }[];

        for (const { id, content } of typedRows) {
          try {
            const vector = await getEmbedding(content);
            await saveEmbedding(db, id, vector);
            logger.info(`[EMBED] ✅ Note ${id} 向量已重建`);
          } catch (err3) {
            logger.error(`[EMBED] ⚠️ Note ${id} 生成失敗`, err3);
          }
        }

        resolve();
      }
    );
  });
}
