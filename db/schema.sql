import { app, BrowserWindow } from "electron";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

async function initDB() {
  const db = await open({
    filename: path.join(app.getPath("userData"), "notes.db"),
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS Notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      content TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS Notes_fts USING fts5(content, metadata);
  `);
  return db;
}

app.on("ready", async () => {
  const db = await initDB();
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL("http://localhost:3000");
});
