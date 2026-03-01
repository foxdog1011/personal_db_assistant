# Personal DB Assistant — Project Overview

A desktop note-taking and knowledge-graph app built with Electron (main + preload) and a React + TypeScript renderer (Vite). It enriches notes with AI summarization, vector embeddings, and semantic relations stored in SQLite.

## Tech Stack
- Electron 28 (main/preload, IPC)
- React 19 + TypeScript + Vite 7 (renderer)
- TailwindCSS for styling
- SQLite3 for persistence
- OpenAI SDK for summarization and embeddings
- Vitest + Testing Library for tests

## Scripts
- `npm run dev` — Start Vite dev server and launch Electron for live development.
- `npm run electron-dev` — Type-check/build Electron and start Electron pointed at dev server.
- `npm run build` — Build Electron (tsc) and Vite production bundles.
- `npm run test` — Run unit tests (Vitest, headless).
- `npm run test:ui` — Run Vitest in UI mode.

## Project Structure
- `src/` — React + TS renderer (Vite)
  - `src/main.tsx` — App bootstrap
  - `src/pages/GraphPage.tsx` — Knowledge graph visualization
  - `src/features/notes/components/` — Note UI: `NoteList.tsx`, `NoteInput.tsx`, etc.
  - `src/features/notes/services/noteService.ts` — Renderer-side helpers
  - `src/hooks/` — Hooks for notes, graph, and AI
  - `src/services/` — Renderer-side IPC proxies: `electronAPI.ts`, `electronIpc.ts`, `apiClient.ts`
  - `src/types/` — Shared type declarations (`Note.ts`, `ConceptRelation.ts`, `electron-api.d.ts`)
  - `src/styles/` — Theme and global styles
- `electron/` — Electron main + preload and backend services
  - `electron/main.ts` — Creates BrowserWindow, registers IPC, global shortcuts, DB init
  - `electron/preload.ts` — Exposes validated IPC APIs on `window.electronAPI`
  - `electron/ipc/` — IPC handlers for notes, AI, graph, reflections, graph evolution
  - `electron/db/` — DB bootstrap and helpers: `init.ts`, `connection.ts`, `query.ts`
  - `electron/services/` — Intelligence layer
    - `ai_service.ts` — Summarize text and extract tags via OpenAI (GPT-4o-mini)
    - `embedding_service.ts` — Generate 1536-d vectors via `text-embedding-3-small`, store/search
    - `relation_service.ts` — Build and query semantic relations between notes
  - `electron/ai/` — OpenAI client and AI utilities (`client.ts`, `generateSummary.ts`, `extractTriples.ts`)
  - `electron/utils/` — Graph utilities (`kg.ts`)
- `db/` — SQLite artifacts
  - `db/notes.db` — User database file
  - `db/schema.sql` — Project schema (see DB section)
  - `db/manager.ts` — Managed access layer
- `dist-electron/` — Built Electron output (do not edit)
- Root configs — `vite.config.ts`, `tsconfig*.json`, `tailwind.config.js`, `postcss.config.js`

## Electron IPC & Preload Bridge
Preload exposes a safe `window.electronAPI` with these operations (see `electron/preload.ts`):
- Notes CRUD: `addNote`, `deleteNote`, `updateNote`, `togglePin`, `updateColor`, `searchNote`, `getNoteByNode`
- Graph: `getKnowledgeGraph`, `generateAIRelations`
- Graph evolution: `getGraphEvolution`, `insertTriple`
- AI: `generateSummary`, `generateInsight`, `aiQuery`, `extractTriples`
- Reflection: `generateReflectionQuestions`

IPC handlers are registered in `electron/main.ts` via modules under `electron/ipc/`.

## Intelligence Layer
- `[AI] ai_service.ts`
  - Validates `OPENAI_API_KEY`; empty content returns `{ summary: "", tags: [] }`.
  - Logs start/end, key detection, latency, raw/parsed output, and errors.
- `[EMB] embedding_service.ts`
  - Generates embeddings with `text-embedding-3-small` (1536 dims).
  - If no API key and `MOCK_OPENAI=1`, returns zero vector with warning; empty input returns zero vector.
  - Stores embeddings in SQLite `embeddings(note_id, vector)` (BLOB as `Float32Array`), UPSERT semantics with detailed logs.
  - Provides cosine similarity and `findSimilarNotes()` by vector.
- `[REL] relation_service.ts`
  - `buildRelations(db, noteId, content)` regenerates embedding, finds similar notes, and upserts into `relations(from_note, to_note, score)` within a transaction; logs and skips on failures.
  - `getRelatedNotes(db, noteId)` sorts by score; auto-creates table; logs errors.
  - `findSimilarNotesForNote(db, noteId)` ensures embeddings exist (regenerates if missing) and returns top similar notes.

## Database
Primary tables (created across `electron/db` and services):
- `notes`
  - `id INTEGER PRIMARY KEY AUTOINCREMENT`
  - `content TEXT NOT NULL`, `tags TEXT`, `pinned INTEGER`, `color TEXT`, `summary TEXT`, `type TEXT`, `created_at TIMESTAMP`
- `concept_relations` — Stores extracted triples linked to `notes(id)`
- `embeddings(note_id INTEGER PRIMARY KEY, vector BLOB)` — Created on demand by embedding service
- `relations(from_note INTEGER, to_note INTEGER, score REAL, updated_at TIMESTAMP, PRIMARY KEY(from_note,to_note))` — Created on demand by relation service

Note: `db/schema.sql` exists, but the canonical schema is initialized at runtime in `electron/db/init.ts`/`connection.ts` and within services.

## Development
- Dev: `npm run dev` (Vite + Electron, live reload)
- Build: `npm run build` (compile Electron + Vite bundle)
- Tests: `npm run test` (Vitest)

## Environment
- `OPENAI_API_KEY` — Required for real AI calls; missing key throws in `[AI]`. For embeddings, missing key with `MOCK_OPENAI=1` returns zero vectors.
- `MOCK_OPENAI=1` — Offline/mock mode for embeddings; useful in CI.

## Notes
- Do not edit compiled outputs in `dist-electron/`.
- Maintain isolation between renderer and main; only communicate via validated preload IPC.
- Logging prefixes: `[AI]`, `[EMB]`, `[REL]`, `[DB]`, `[KG]` are used consistently for predictable debugging.
