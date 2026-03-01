# Smoke Test — End-to-End Verification

Minimum steps to confirm the app works after a fresh clone or major change.

---

## Prerequisites

```bash
node -v   # >= 18
npm -v
cp .env.example .env   # fill in OPENAI_API_KEY (or set MOCK_OPENAI=1)
npm install
```

---

## 1. Unit Tests

```bash
npm test
```

- **Pass criteria**: All tests pass (0 failures).

---

## 2. Dev Mode (Vite + Electron live reload)

```bash
npm run dev
```

- Vite starts on `http://localhost:5199`
- Electron window opens with the KeepInMind UI
- **Pass criteria**: Main window renders with header, navigation, and dashboard.

---

## 3. CRUD Verification (in running app)

1. Navigate to **📝 筆記** page.
2. **Create**: Type a note in the textarea, add a tag, press Enter or click 💾 儲存.
   - Expect: Note appears in the list below.
3. **Read**: Verify the note content and tags display correctly.
4. **Update**: (If edit UI is available) Modify content/tags.
5. **Delete**: Click the delete button on a note.
   - Expect: Note is removed from the list.
6. **Pin/Color**: Toggle pin or change color on a note.
   - Expect: State updates reflect immediately.

---

## 4. Persistence (restart test)

1. Create a note in step 3.
2. Close the Electron window.
3. Run `npm run dev` again.
4. **Pass criteria**: Previously created notes are still present in the list.

---

## 5. AI / Mock Mode

### With real API key

- Create a note with substantial content (2+ sentences).
- After saving (with noteId assigned), click **✨ AI 摘要**.
- **Pass criteria**: Summary is generated and saved.

### With `MOCK_OPENAI=1` (offline/CI)

- Set `MOCK_OPENAI=1` in `.env`.
- Restart the app; create a note.
- Embedding operations should succeed with zero vectors (check console for `[EMBED]` logs).
- **Pass criteria**: No crash; embedding logs show mock behavior.

---

## 6. Production Build + Smoke Launch

```bash
npm run smoke
```

This runs `npm run build` (tsc + vite) then `npm run start` (electron).

- **Pass criteria**: Electron window opens, DB initializes, IPC handlers register.
- Console should show:
  ```
  [DB] ✅ SQLite 初始化完成
  [AI] ✅ OpenAI 初始化成功
  [IPC] ✅ 所有 IPC handlers 已註冊完成
  [UI] ✅ 主視窗建立完成
  ```
- Close the window manually to exit.

---

## 7. Related Notes Panel — 🧩 (concept + semantic tabs)

1. Create 3+ notes with overlapping topics, wait for worker to finish triples.
2. Hover over a note card → click the **🧩** button in the action toolbar.
3. **Graph tab** (default):
   - Should list related notes with shared concept tags and 共現 score.
   - Empty state: 🕸️ "尚無相關筆記 / Worker 處理完三元組後即可顯示".
4. **Switch to 語意 tab**:
   - Click "語意" tab → shows notes by similarity score (相似 0.XXX).
   - `MOCK_OPENAI=1`: uses token-overlap; real mode: cosine on stored embeddings.
   - Empty state: "需要 embedding 向量或更多筆記".
5. **Search**: Type in the 搜尋筆記… input → list filters instantly (no API call); type "zzz" → 找不到 message.
6. **TopK**: Change dropdown Top 5 → Top 3 → new fetch fires (check `[RECOMMEND]` / `[SEMANTIC]` log with returned=3).
7. **Sort**: Switch 高→低 / 低→高 → item order reverses instantly without re-fetch.
8. **Copy (📋)**: Hover an item → click 📋 → paste elsewhere to verify `筆記 #N: title（共享：...）` text.
9. **Refresh (🔄)**: Click 🔄 → re-fetches current tab; console shows `[RECOMMEND]` / `[SEMANTIC]` log.
10. **Click item**: Modal closes + URL changes to `#/graph?noteId=X`.
11. **Close**: Click 關閉, ×, or grey backdrop.

### UI-3 — Keyboard navigation, highlight & pin

12. **↑↓ Navigation**: With 2+ results loaded, press **↓** → first card gets a blue highlight border (`data-active`). Press **↓** again → second card highlighted. Press **↑** → returns to first card.
13. **Enter to open**: With a card highlighted (via ↑↓), press **Enter** → modal closes + URL changes to `#/graph?noteId=X`. No mouse click needed.
14. **Esc precedence**:
    - With text in the search box, press **Esc** → search is cleared, modal stays open.
    - With empty search, press **Esc** → modal closes.
15. **Highlight**: Type part of a note title (e.g. "知識") in the search box → matching substring appears wrapped in a yellow `<mark>` highlight within the card snippet.
16. **📌 Pin**: Hover a card → click the **📌** button → header shows `📌 #<noteId>` indicator and the panel re-fetches using that note's ID as the new source. Click **×** next to the indicator to clear the pin and restore the original source.

---

## 8. Knowledge Graph (optional)

1. Create 3+ notes with overlapping topics.
2. Navigate to **🧩 知識圖譜**.
3. **Pass criteria**: Graph renders with nodes and edges.

---

## Quick Reference

| Command | What it does |
|---|---|
| `npm test` | Run all unit tests (Vitest, headless) |
| `npm run dev` | Vite dev server (5199) + Electron live |
| `npm run build` | Compile Electron + Vite production bundle |
| `npm run start` | Launch Electron from built output |
| `npm run smoke` | Build + launch (minimal production test) |
| `bash scripts/doctor.sh` | Full environment health check |
