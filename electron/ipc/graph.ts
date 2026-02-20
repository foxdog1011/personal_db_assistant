import { ipcMain } from "electron";
import type sqlite3 from "sqlite3";
import type OpenAI from "openai";
import { extractTriples } from "../ai/extractTriples";
import { saveTriples, getRelationEvidence } from "../db/query";

export interface IpcContext {
  db: sqlite3.Database;
  openai?: OpenAI;
}

export function registerGraphIpc(ctx: IpcContext) {
  const { db, openai } = ctx;
  if (!db) throw new Error("[KG] Missing db instance");
  if (!openai) console.warn("[KG] ⚠️ No OpenAI instance provided (some features disabled)");

  if ((global as any).__GRAPH_IPC_REGISTERED__) {
    console.warn("[KG] ⚠️ Graph IPC already registered, skipping duplicate.");
    return;
  }
  (global as any).__GRAPH_IPC_REGISTERED__ = true;

  /* =====================================================
   * 🧭 取得 Knowledge Graph 資料
   * params: { mode?, noteId?, depth?, limit?, minSupportCount?, minSupportingNotes?, minWeight? }
   *
   * mode              : 'global' (default) | 'note'
   * noteId            : filter to a single note's ego-graph (implies mode='note')
   * depth             : 1 = direct triples only | 2 = 2-hop via canonical terms
   * minSupportCount   : note mode — min support_count per row (default 1)
   * minSupportingNotes: global mode — min COUNT(DISTINCT note_id) per canonical pair (default 1)
   * minWeight         : legacy alias; mapped to minSupportCount (note) or minSupportingNotes (global)
   * limit             : max edges returned (default 200)
   * ===================================================== */
  ipcMain.handle("get-knowledge-graph", async (_, params?: {
    mode?: "global" | "note";
    noteId?: string;
    depth?: number;
    limit?: number;
    minSupportCount?: number;
    minSupportingNotes?: number;
    minWeight?: number;
  }) => {
    // Backwards compat: bare string → treat as noteId
    const p: typeof params & { noteId?: string } =
      typeof params === "string" ? { noteId: params as unknown as string } : (params || {});

    const { noteId, depth = 1, limit = 200 } = p;
    const mode = p.mode ?? (noteId ? "note" : "global");

    // Resolve minSupportCount / minSupportingNotes with legacy minWeight fallback
    let minSupportCount =
      typeof p.minSupportCount === "number" ? p.minSupportCount
      : (mode === "note" && typeof p.minWeight === "number") ? p.minWeight
      : 1;
    let minSupportingNotes =
      typeof p.minSupportingNotes === "number" ? p.minSupportingNotes
      : (mode === "global" && typeof p.minWeight === "number") ? p.minWeight
      : 1;

    console.log(
      `[GRAPH] get-knowledge-graph mode=${mode} noteId=${noteId ?? "all"} depth=${depth}` +
      ` minSupportCount=${minSupportCount} minSupportingNotes=${minSupportingNotes} limit=${limit}`
    );

    const buildGraphFromRows = (rows: any[]): { nodes: any[]; links: any[] } => {
      const nodesMap = new Map<string, { id: string; label: string; color: string }>();
      const links: { source: string; target: string; label: string; relationId?: string }[] = [];
      rows.forEach((r) => {
        const src: string = r.cs ?? r.canonical_source ?? r.source;
        const tgt: string = r.ct ?? r.canonical_target ?? r.target;
        nodesMap.set(src, { id: src, label: src, color: "#8b5cf6" });
        nodesMap.set(tgt, { id: tgt, label: tgt, color: "#6366f1" });
        links.push({ source: src, target: tgt, label: r.relation, relationId: r.id != null ? String(r.id) : undefined });
      });
      const result = { nodes: Array.from(nodesMap.values()), links };
      console.log(`[GRAPH] getKnowledgeGraph nodes=${result.nodes.length} edges=${result.links.length}`);
      return result;
    };

    return new Promise((resolve) => {
      if (mode === "note" && noteId) {
        const noteIdInt = parseInt(noteId, 10);

        if (depth >= 2) {
          // depth=2: include triples from other notes sharing canonical terms with this note
          const sql = `
            WITH d1 AS (
              SELECT COALESCE(canonical_source, source) AS cs,
                     COALESCE(canonical_target, target) AS ct
              FROM concept_relations WHERE note_id = ?
            ),
            d1_terms AS (
              SELECT cs AS term FROM d1
              UNION SELECT ct FROM d1
            )
            SELECT c.*
            FROM concept_relations c JOIN notes n ON c.note_id = n.id
            WHERE (COALESCE(c.canonical_source, c.source) IN (SELECT term FROM d1_terms)
               OR  COALESCE(c.canonical_target, c.target) IN (SELECT term FROM d1_terms))
              AND c.support_count >= ?
            LIMIT ?
          `;
          db.all(sql, [noteIdInt, minSupportCount, limit], (err, rows: any[]) => {
            if (err) { console.error("[GRAPH] depth=2 error", err); return resolve({ nodes: [], links: [] }); }
            resolve(buildGraphFromRows(rows || []));
          });
        } else {
          // depth=1: only this note's triples
          db.all(
            `SELECT c.* FROM concept_relations c JOIN notes n ON c.note_id = n.id
             WHERE c.note_id = ? AND c.support_count >= ? LIMIT ?`,
            [noteIdInt, minSupportCount, limit],
            (err, rows: any[]) => {
              if (err) { console.error("[GRAPH] note mode error", err); return resolve({ nodes: [], links: [] }); }
              resolve(buildGraphFromRows(rows || []));
            }
          );
        }
      } else {
        // global mode: aggregate by canonical pair, filter by cross-note supporting-notes count
        const sql = `
          SELECT COALESCE(canonical_source, source) AS cs,
                 COALESCE(canonical_target, target) AS ct,
                 relation,
                 COUNT(DISTINCT c.note_id) AS agg_support,
                 MIN(c.id) AS id
          FROM concept_relations c JOIN notes n ON c.note_id = n.id
          GROUP BY cs, ct, relation
          HAVING agg_support >= ?
          ORDER BY agg_support DESC
          LIMIT ?
        `;
        db.all(sql, [minSupportingNotes, limit], (err, rows: any[]) => {
          if (err) { console.error("[GRAPH] global mode error", err); return resolve({ nodes: [], links: [] }); }
          resolve(buildGraphFromRows(rows || []));
        });
      }
    });
  });

  /* =====================================================
   * 🔁 重新構建所有筆記關聯（修正：清理孤兒 triples）
   * ===================================================== */
  ipcMain.handle("rebuild-relations", async () => {
    if (!openai) return { success: false, message: "OpenAI not initialized" };
    try {
      console.log("[KG] 🧱 Rebuilding all relations...");

      // 🔧 Step 0: 刪除孤兒 triples
      await new Promise<void>((resolve, reject) => {
        db.run(
          "DELETE FROM concept_relations WHERE note_id NOT IN (SELECT id FROM notes)",
          (err) => {
            if (err) {
              console.error("[KG] ❌ Failed to delete orphan triples", err);
              return reject(err);
            }
            console.log("[KG] 🧹 Cleared orphan concept_relations rows");
            resolve();
          }
        );
      });

      const notes = await new Promise<{ id: number; content: string }[]>((resolve) => {
        db.all("SELECT id, content FROM notes", (err, rows: any[]) => {
          if (err) {
            console.error("[KG] ❌ DB query error:", err);
            return resolve([]);
          }
          resolve(rows as { id: number; content: string }[]);
        });
      });

      if (notes.length === 0)
        return { success: true, totalNotes: 0, totalRelations: 0 };

      let totalRelations = 0;
      for (const note of notes) {
        const triples = await extractTriples(openai, note.content);
        await saveTriples(db, note.id, triples);
        totalRelations += triples.length;
      }

      console.log(`[KG] ✅ Rebuild complete: ${notes.length} notes, ${totalRelations} triples`);
      return { success: true, totalNotes: notes.length, totalRelations };
    } catch (e: any) {
      console.error("[KG] ❌ rebuild-relations:error", e);
      return { success: false, message: e?.message || String(e) };
    }
  });

  /* =====================================================
   * 📝 抽取單筆 Triples
   * ===================================================== */
  ipcMain.handle("extract-triples", async (_event, noteId: number) => {
    if (!openai) return { success: false, triples: [] };
    try {
      const contentRow = await new Promise<{ content: string } | null>((resolve) => {
        db.get("SELECT content FROM notes WHERE id = ?", [noteId], (err, row) => {
          if (err) {
            console.error("[KG] extract-triples:db error", err);
            return resolve(null);
          }
          resolve(row as { content: string } | null);
        });
      });

      const content = contentRow?.content || "";
      if (!content.trim()) return { success: false, triples: [] };

      const triples = await extractTriples(openai, content);
      await saveTriples(db, noteId, triples);

      console.log(`[KG] ✅ Extracted ${triples.length} triples for note ${noteId}`);
      return { success: true, triples };
    } catch (err: any) {
      console.error("[KG] extract-triples:error", err);
      return { success: false, triples: [] };
    }
  });

  /* =====================================================
   * 📋 取得 Relation Evidence（edge 點擊後顯示支撐片段）
   * ===================================================== */
  ipcMain.handle("get-relation-evidence", async (_, params: { relationId: string | number; limit?: number }) => {
    const id = typeof params?.relationId === "string"
      ? parseInt(params.relationId, 10)
      : Number(params?.relationId);
    if (!id || isNaN(id)) return { evidence: [] };
    const limit = params?.limit ?? 5;
    const result = await getRelationEvidence(db, { relationId: id, limit });
    console.log(`[GRAPH] get-relation-evidence relId=${id} returned=${result.evidence.length}`);
    return result;
  });

  console.log(
    "[IPC] ✅ Graph IPC registered (get-knowledge-graph / rebuild-relations / extract-triples / get-relation-evidence)"
  );
}
