# Repository Guidelines

## Project Structure & Module Organization
- `src/` – React + TypeScript renderer (Vite). Features under `src/features/`; shared types in `src/types/`; IPC helpers in `src/services/`.
- `electron/` – Main process (`main.ts`) and secured preload bridge (`preload.ts`). IPC handlers in `electron/ipc/`; AI/semantic services in `electron/services/`.
- `db/` – SQLite files (`notes.db`). Schema is ensured via `electron/db/init.ts` at runtime. Do not edit `dist-electron/` outputs.
- `tests/` – Vitest + RTL unit tests (e.g., `tests/NoteInput.test.tsx`). Setup in `tests/setup.ts`.

## Build, Test, and Development Commands
- `npm run dev` – Start Vite and launch Electron for live development.
- `npm run electron-dev` – Type-check/build Electron then run it against the dev server.
- `npm run build` – Build Electron (tsc) and the Vite production bundle.
- `npm test` / `npm run test:ui` – Run Vitest headless/UI.

Tips: set `VITE_DEV_SERVER_URL` automatically via scripts; ensure `OPENAI_API_KEY` when using AI.

## Coding Style & Naming Conventions
- TypeScript, 2-space indentation, functional React + Hooks.
- Names: components `PascalCase.tsx`, utilities `camelCase.ts`, types `*.d.ts`.
- Separation of concerns: UI in `src/`, system/AI/DB in `electron/`. Use preload IPC—no direct Node APIs in renderer.

## Testing Guidelines
- Framework: Vitest + @testing-library/react (jsdom). Configure globals in `tests/setup.ts`.
- Location: `tests/**/*.{test,spec}.ts(x)`.
- Run: `npm test` (CI-friendly) or `npm run test:ui` locally.
- Prefer user-centric tests; stub `window.electronAPI` as needed (see `tests/setup.ts`).

## Commit & Pull Request Guidelines
- Commit style: Conventional Commits encouraged (e.g., `feat:`, `fix:`, `docs:`). Example from history: `docs: add initial architecture documentation`.
- PRs: include a concise summary, linked issues, screenshots or logs for UI/IPC changes, and reproduction steps. Note any schema or IPC contract changes.

## Security & Configuration
- Env: set `OPENAI_API_KEY` for AI features. For offline/CI, set `MOCK_OPENAI=1` to return zero embeddings and skip network calls where supported.
- Data: SQLite at `db/notes.db`. Back up before migrations. Avoid committing local databases unless deliberately providing fixtures.

## Architecture Overview
- AI services: `gpt-4o-mini` for summaries/insights; `text-embedding-3-small` (1536-dim) for similarity. Relations persisted in `relations` and `embeddings` tables. All AI/DB work is initiated by IPC from the renderer.
