import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import * as path from "path";
import type sqlite3 from "sqlite3";
import { logger } from "./utils/logger";

// 🌐 OpenAI / DB / IPC
import { getOpenAI } from "./ai/client";
import { initDatabase, getDb } from "./db/init";
import { registerNoteIpc } from "./ipc/notes";
import { registerAiIpc } from "./ipc/ai";
import { registerGraphIpc } from "./ipc/graph";
import { registerReflectionIpc } from "./ipc/aiReflection";
import {
  registerGraphEvolutionIpc,
  registerInsertTripleIpc,
} from "./ipc/graphEvolution";
import { registerSemanticIpc } from "./ipc/semantic";
import { registerDevIpc } from "./ipc/dev";
import { enqueueJob } from "./services/ai_job_queue";
import { startAiJobWorker } from "./services/ai_job_worker";

let db: sqlite3.Database;
let quickAddWin: BrowserWindow | null = null;

/* ====================================================
   🧩 防止主進程重複啟動（關鍵修正）
==================================================== */
if (!app.requestSingleInstanceLock()) {
  logger.warn("[App] 第二個 Electron 實例被阻止");
  app.quit();
  process.exit(0);
}

/* ====================================================
   ✅ 初始化資料庫
==================================================== */
function initDb() {
  initDatabase();
  db = getDb();
  logger.info("[DB] SQLite 初始化完成");
}

/* ====================================================
   ✅ 建立主視窗
==================================================== */
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devServerURL = process.env.VITE_DEV_SERVER_URL;
  if (devServerURL) win.loadURL(devServerURL);
  else win.loadFile(path.join(__dirname, "../dist/index.html"));

  logger.info("[UI] 主視窗建立完成");
}

/* ====================================================
   💡 Quick Add Modal
==================================================== */
function createQuickAddWindow() {
  if (quickAddWin) {
    quickAddWin.focus();
    return;
  }

  quickAddWin = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devServerURL = process.env.VITE_DEV_SERVER_URL;
  if (devServerURL) quickAddWin.loadURL(`${devServerURL}/#/quick-add`);
  else
    quickAddWin.loadFile(path.join(__dirname, "../dist/index.html"), {
      hash: "quick-add",
    });

  quickAddWin.on("closed", () => (quickAddWin = null));
  logger.info("[QuickAdd] Quick Add 視窗已開啟");
}

/* ====================================================
   ✅ 啟動應用程式
==================================================== */
app.whenReady().then(() => {
  try {
    initDb();
    const openai = getOpenAI();
    logger.info("[AI] OpenAI 初始化成功");

    /* 📡 註冊所有 IPC handlers */
    registerNoteIpc({ db, openai });
    registerAiIpc({ db });
    registerGraphIpc({ db, openai });
    registerReflectionIpc(openai);
    registerGraphEvolutionIpc(db);
    registerInsertTripleIpc(db);
    registerDevIpc(db);

    // 🧠 防止 Semantic IPC 重複註冊（熱重載保護）
    if (!(global as any).__SEMANTIC_IPC_INITIALIZED__) {
      registerSemanticIpc({ db, openai });
      (global as any).__SEMANTIC_IPC_INITIALIZED__ = true;
      logger.info("[IPC] Semantic IPC 已註冊");
    } else {
      logger.warn("[MAIN] Semantic IPC 已初始化，跳過重複註冊");
    }

    logger.info("[IPC] 所有 IPC handlers 已註冊完成");

    createWindow();
    startAiJobWorker(db);

    const shortcut =
      process.platform === "darwin"
        ? "CommandOrControl+Shift+K"
        : "Control+Shift+K";

    globalShortcut.register(shortcut, () => {
      logger.info("[Shortcut] Quick Add Triggered");
      createQuickAddWindow();
    });
  } catch (err) {
    logger.error("[FATAL] App 啟動失敗", err);
  }
});

/* ====================================================
   ✅ IPC：Quick Add 筆記寫入
==================================================== */
ipcMain.handle("quick-add-note", async (_event, note) => {
  return new Promise((resolve, reject) => {
    const { content, tags } = note;
    const createdAt = new Date().toISOString().replace("T", " ").split(".")[0];

    db.run(
      `INSERT INTO notes (content, tags, created_at) VALUES (?, ?, ?)`,
      [content, tags || "", createdAt],
      async function (err) {
        if (err) {
          logger.error("[QuickAdd] 新增筆記失敗", err);
          return reject(err);
        }
        const noteId = this.lastID;
        logger.info("[QuickAdd] 筆記已成功寫入", { noteId });

        try {
          await enqueueJob(db, noteId, "summary");
          await enqueueJob(db, noteId, "triples");
          await enqueueJob(db, noteId, "embedding");
        } catch (e: any) {
          logger.error("[QUEUE] enqueue failed after quick-add", { noteId, error: e?.message });
        }

        resolve({ success: true, id: noteId });
      }
    );
  });
});

/* ====================================================
   🧹 應用關閉
==================================================== */
app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") app.quit();
});

/* ====================================================
   ⚠️ 全域例外攔截
==================================================== */
process.on("uncaughtException", (err) => {
  logger.error("[FATAL] 未捕捉例外", err);
});

process.on("unhandledRejection", (reason) => {
  logger.error("[FATAL] Promise 未處理拒絕", reason);
});
