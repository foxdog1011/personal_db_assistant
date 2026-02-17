# Agent Sync — STATUS.md

**Date**: 2026-02-17
**Branch**: main
**Agent**: Claude Opus 4.6

---

## Environment

| Item | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26200 |
| Node.js | v22.16.0 |
| npm | 10.9.2 |
| Python | 3.13.3 |
| venv | Not present (not needed) |
| .env | Present (contains `OPENAI_API_KEY`) |
| Lockfile | `package-lock.json` present |
| node_modules | Installed |

---

## Issues Found & Fixes Applied

### Issue 1: `index.html` — Malformed `<title>` Tag

- **Symptom**: Browser tab shows garbled title; HTML validators would reject the page.
- **Root cause**: `<title><KeepInMind</Keygen></title>` uses invalid nested HTML tags (`<Keygen>` is a deprecated element, and `<KeepInMind` is not a valid tag).
- **Reproduce**: Open `dist/index.html` in browser, inspect the `<title>` element.
- **Fix**: Changed to `<title>KeepInMind</title>`.
- **File**: `index.html:6`

### Issue 2: Vitest Missing Test Configuration

- **Symptom**: All 9 NoteInput tests fail with `document is not defined` and `Cannot read properties of undefined (reading 'Symbol(Node prepared with document state workarounds)')`.
- **Root cause**: `vite.config.ts` had no `test` section — Vitest ran without jsdom environment, so `document`, `window` etc. were unavailable. The `tests/setup.ts` file existed but was never referenced.
- **Reproduce**: `npm test` → 9/13 tests fail.
- **Fix**: Added `test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"] }` to `vite.config.ts`.
- **File**: `vite.config.ts`

### Issue 3: NoteInput AI Button Rendered as `<span>` Instead of `<button>`

- **Symptom**: After fixing Issue 2, 4 tests still fail — tests look for `role="button"` with name "AI 摘要", but component renders a `<span>` when `noteId` is absent.
- **Root cause**: The component had two separate render paths: `<button>` (when `noteId` exists) and `<span>` (when no `noteId`). Tests expected a single `<button>` element that toggles `disabled` state.
- **Reproduce**: `npm test` → 4 tests fail on `getByRole('button', { name: /AI 摘要/ })`.
- **Fix**: Unified rendering to always use a `<button>` element. Added `hasNoteId` flag for enabled/disabled state. AI button now shows when content exists OR noteId exists, and is disabled when no noteId.
- **File**: `src/features/notes/components/NoteInput.tsx`

### Issue 4: Test Setup Missing IPC Stubs

- **Symptom**: After save, `handleSubmit` calls `ipc.extractTriples()` and `ipc.getKnowledgeGraph()`, which throw in test environment.
- **Root cause**: `tests/setup.ts` only stubbed `generateSummary`, missing other IPC methods used during submit flow.
- **Fix**: Added `extractTriples` and `getKnowledgeGraph` stubs to `tests/setup.ts`.
- **File**: `tests/setup.ts`

---

## Verification

### Commands & Results

```bash
# 1. Build Electron (TypeScript)
npx tsc --project tsconfig.electron.json  # ✅ Clean, no errors

# 2. Build Vite (production)
npx vite build  # ✅ Built in ~5s, outputs dist/

# 3. Run all tests
npm test  # ✅ 13/13 passed (2 test files)

# 4. Launch Electron (production mode)
npx electron dist-electron/main.js
# ✅ DB initialized, all IPC handlers registered, window created
# Output:
#   [DB] ✅ SQLite 初始化完成
#   [AI] ✅ OpenAI 初始化成功
#   [IPC] ✅ 所有 IPC handlers 已註冊完成
#   [UI] ✅ 主視窗建立完成
#   [EMBED] 🧩 Embedding rebuild complete ✅
```

---

## Remaining Risks / TODOs

1. **OpenAI API Key**: `.env` contains a key that may be expired/revoked. AI features (summary, embeddings, triples extraction) will fail at runtime if the key is invalid. Set `MOCK_OPENAI=1` for offline testing.
2. **Bundle size**: Vite warns that the JS bundle exceeds 500 kB (1012 kB). Consider code-splitting with dynamic imports for graph/semantic features.
3. **`alert()` usage**: NoteInput uses `window.alert()` for user feedback — not ideal UX. Consider migrating to `react-hot-toast` (already a dependency).
4. **No `.gitignore`**: `node_modules/`, `dist/`, `dist-electron/`, `.env`, `db/notes.db` are all untracked. A `.gitignore` should be added to prevent accidental commits of secrets/binaries.
5. **Electron version**: Using Electron 28 — consider upgrading for security patches.
