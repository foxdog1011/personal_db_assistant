# KeepInMind — Personal Knowledge Assistant

A desktop note-taking and knowledge-graph app built with **Electron + React + TypeScript + SQLite**. Drop in your thoughts, URLs, or text — and watch them automatically evolve into an interconnected mind map powered by AI.

> **"Let your notes grow into a mind forest where each new note automatically branches into related concepts."**

---

## Features

### AI-Powered Enrichment
- **Auto-summarization** — GPT-4o-mini distills each note into a concise summary
- **Tag & topic extraction** — intelligent keyword tagging without manual effort
- **Concept triple extraction** — pulls out structured `(subject, relation, object)` triples from note content

### Semantic Search & Relations
- **Vector embeddings** — every note is embedded with `text-embedding-3-small` (1536 dimensions)
- **Cosine similarity search** — find conceptually related notes even with no shared keywords
- **Auto-linking** — relations between notes are built automatically as you write

### Interactive Knowledge Graph
- **Visual mind map** — notes rendered as nodes with edges representing semantic connections
- **Two exploration modes**:
  - **Global** — aggregate view of all notes and concept relations across the entire knowledge base
  - **Note-local** — 1-hop or 2-hop subgraph centered on a specific note
- **Edge evidence panel** — inspect which notes support each relation
- **Graph evolution** — track how your knowledge base grows over time

### Note Management
- Full CRUD with color-coding and pinning
- Search across all note content
- Type classification (text, URL, etc.)
- Background AI job queue — enrichment never blocks the UI

### Design System
- Consistent Tailwind-based component library (Badge, Button, Card, Modal, Tabs, Chip, Slider, Input)
- Light/dark theme with CSS custom property tokens

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS 3, Framer Motion |
| Graph rendering | vis-network 9 |
| Database | SQLite3 (node-native) |
| AI | OpenAI SDK v5 (GPT-4o-mini, text-embedding-3-small) |
| Testing | Vitest 3, React Testing Library |
| Routing | React Router DOM 7 (HashRouter for `file://`) |

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **OpenAI API key** — required for AI features; set `MOCK_OPENAI=1` to run offline without one

---

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd personal_db_assistant
npm install

# 2. Configure environment
cp .env.example .env
# Open .env and add your OPENAI_API_KEY

# 3. Start development (Vite on port 5173 + Electron with live reload)
npm run dev
```

The app window will open automatically once the dev server is ready.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes (for AI) | OpenAI API key for summarization, embeddings, and triple extraction |
| `MOCK_OPENAI` | No | Set to `1` to disable all OpenAI calls (zero embeddings returned — useful for CI or offline development) |

> **Never commit `.env`** — it is already in `.gitignore`. Use `.env.example` as the template.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (port 5173) + Electron with live reload |
| `npm run build` | Compile Electron TypeScript + Vite production bundle |
| `npm run start` | Launch Electron from built output (`dist-electron/`) |
| `npm run smoke` | Build then launch — one-command production validation |
| `npm test` | Run all unit tests headlessly (CI-friendly) |
| `npm run test:ui` | Run Vitest in interactive browser UI |

---

## Project Structure

```
personal_db_assistant/
├── electron/                   Electron main process
│   ├── main.ts                 Entry point — DB init, IPC routing, worker start
│   ├── preload.ts              Context bridge (window.electronAPI)
│   ├── db/
│   │   ├── init.ts             Schema creation + runtime migrations
│   │   ├── query.ts            Query helpers (saveTriples, etc.)
│   │   └── connection.ts       SQLite connection singleton
│   ├── ipc/                    IPC handlers
│   │   ├── notes.ts            Note CRUD
│   │   ├── graph.ts            Knowledge graph queries
│   │   ├── ai.ts               AI enrichment triggers
│   │   ├── semantic.ts         Semantic search
│   │   └── relation.ts         Relation management
│   └── services/               Intelligence layer
│       ├── ai_service.ts       Summarization & tag extraction (GPT-4o-mini)
│       ├── embedding_service.ts Vector generation & cosine search
│       ├── relation_service.ts  Semantic relation building
│       └── ai_job_worker.ts    Background job queue & worker
│
├── src/                        React renderer (Vite)
│   ├── features/
│   │   ├── notes/              Note list, cards, input, search
│   │   ├── graph/              Graph page & visualization
│   │   ├── semantic/           Semantic search UI
│   │   ├── dashboard/          Dashboard overview
│   │   └── common/ui/          Design system components
│   ├── hooks/                  useNotes, useGraph, useAI, useSemanticNotes
│   ├── services/               IPC proxy & API clients
│   ├── types/                  TypeScript declarations (ElectronAPI, Note, etc.)
│   └── styles/                 Theme CSS tokens (light/dark)
│
├── db/                         SQLite data files
│   └── schema.sql              Schema reference
├── tests/                      Vitest + RTL unit tests
├── scripts/                    Utility scripts (db-exec.js, sql-reset.js)
├── docs/                       Additional documentation
├── .env.example                Environment variable template
└── package.json
```

---

## Architecture

### Data Flow: Adding a Note

```
User input
    │
    ▼
React renderer ──IPC──▶ Electron main process
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
               SQLite       GPT-4o    Embeddings
               (note)        mini     (1536-dim)
                         (summary)       │
                              │          ▼
                         tags/triples  cosine
                              │        search
                              ▼          │
                        concept_relations│
                              └──────────┘
                                   │
                                   ▼
                            Graph updated
                                   │
                    ──IPC──▶ React re-renders
```

### Key Architectural Decisions

- **HashRouter** — Electron serves the app over `file://`, so standard BrowserRouter history doesn't work
- **IPC boundary** — all renderer↔main communication flows through a validated preload bridge; `noteId` is always a string at the boundary and parsed to integer inside IPC handlers
- **Background job queue** — AI enrichment (`ai_job_worker.ts`) runs asynchronously so note saving is never blocked
- **Schema migrations** — applied at startup via `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` in `serialize()` — no migration framework needed
- **Canonical terms** — relations stored with `canonical_source` / `canonical_target` (trimmed, lowercased) for robust deduplication and matching

### Database Schema (Key Tables)

```sql
notes(id, content, summary, tags, pinned, color, type, created_at)
embeddings(note_id PRIMARY KEY, vector BLOB)          -- Float32Array 1536-dim
relations(from_note, to_note, score, updated_at)       -- cosine similarity
concept_relations(
  id, source, relation, target, note_id,
  canonical_source, canonical_target,
  support_count, last_seen_at
)
relation_evidence(relation_id, note_id, best_sentence, confidence)
```

---

## Testing

Tests use an in-memory SQLite database (`:memory:`) for full isolation. All `electronAPI` methods are stubbed in `tests/setup.ts`.

```bash
npm test              # headless, exits with pass/fail
npm run test:ui       # interactive Vitest UI in browser
```

Test files live in `tests/` and cover:
- AI job lifecycle
- Graph query params
- Semantic relation building
- UI components (modals, skeleton loading, focus rings, theme toggle)
- Related notes panel

---

## Development Notes

- Run `MOCK_OPENAI=1 npm run dev` to develop without an OpenAI key
- Logging prefixes: `[AI]` `[EMB]` `[REL]` `[DB]` `[KG]` — consistent across all services
- When adding a new IPC channel: update `electron/preload.ts`, `src/types/electron-api.d.ts`, and `tests/setup.ts` stubs
- When changing the DB schema: update both `electron/db/init.ts` and `db/manager.ts` (used by tests)

---

## License

MIT
