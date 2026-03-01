# Knowledge Graph Data Flow Trace

## Data Flow

```
add-note IPC
  └─ enqueueJob(db, noteId, "triples")     ← electron/ipc/notes.ts
       └─ INSERT OR IGNORE INTO ai_jobs     ← electron/services/ai_job_queue.ts

ai_job_worker (setInterval 5s)
  └─ claimNextJob(db)                       ← electron/services/ai_job_queue.ts
       └─ processTriples(db, noteId)        ← electron/services/ai_job_worker.ts
            ├─ SELECT content FROM notes
            ├─ extractTriples(openai, content)  ← electron/ai/extractTriples.ts
            │    └─ MOCK_OPENAI=1 → [{source:"mock", relation:"test", target:"note"}]
            ├─ saveTriples(db, noteId, triples) ← electron/db/query.ts
            │    ├─ DELETE FROM concept_relations WHERE note_id = ?
            │    └─ INSERT INTO concept_relations (source, relation, target, note_id)
            └─ completeJob(db, jobId)

get-knowledge-graph IPC                    ← electron/ipc/graph.ts
  └─ SELECT c.* FROM concept_relations c JOIN notes n ON c.note_id = n.id
       └─ returns { nodes, links }
```

## Breakpoints Found & Fixed

### 1. `saveTriples` was fire-and-forget (no Promise)

- **File:** `electron/db/query.ts`
- **Problem:** `saveTriples` returned `void`, not `Promise<void>`. The worker called it without `await`, so `completeJob` could fire before triples were actually written to `concept_relations`.
- **Fix:** Wrapped the entire function body in `new Promise`, resolved in `stmt.finalize` callback. Worker now does `await saveTriples(...)`.

### 2. Test DB missing `concept_relations` table

- **File:** `db/manager.ts`
- **Problem:** The test-only in-memory DB created `notes` and `ai_jobs` tables but NOT `concept_relations`. Any test calling `saveTriples` would fail with "no such table".
- **Fix:** Added `CREATE TABLE IF NOT EXISTS concept_relations (...)` to `initDatabase()`.

### 3. `get-knowledge-graph` lacked diagnostic logging

- **File:** `electron/ipc/graph.ts`
- **Problem:** The handler logged `[KG] Graph loaded: N relations` but didn't log node/edge counts in a format that smoke tests could verify.
- **Fix:** Changed to `[GRAPH] getKnowledgeGraph nodes=N edges=N`.

## How to Manually Verify the Graph

### With MOCK_OPENAI=1

```bash
MOCK_OPENAI=1 npm run dev
```

1. Create a new note with any content
2. Wait ~5 seconds for the worker to process the "triples" job
3. Check the console/log for:
   - `[QUEUE] enqueue {"noteId":N,"jobType":"triples"}`
   - `[WORKER] processing {"id":N,"type":"triples","noteId":N}`
   - `[DB] saveTriples: 1 relations (note N)`
   - `[WORKER] done {"id":N,"type":"triples"}`
4. Open the Knowledge Graph view (if available in UI) or open Diagnostics
5. The graph should contain at least 2 nodes ("mock", "note") and 1 edge

### With real OpenAI

```bash
npm run dev
```

Same flow, but `extractTriples` calls GPT-4o-mini and returns real triples from the note content.

### Via test

```bash
npm test -- tests/graph-triples.test.ts
```

Tests verify:
- `saveTriples` writes to `concept_relations` correctly
- `getKnowledgeGraph` returns non-empty `{ nodes, links }`
- Old triples are replaced on re-save
- Orphan triples (deleted notes) are excluded via JOIN
