import { ipcMain } from "electron";
import type sqlite3 from "sqlite3";
import { runKnowledgeTask, type KnowledgeTaskRunnerInput, type KnowledgeTaskRunnerResult } from "../agent/runner/knowledgeTaskRunner";
import { logger as appLogger } from "../utils/logger";

export interface IpcContext {
  db: sqlite3.Database;
}

export function registerResearchIpc(ctx: IpcContext) {
  const { db } = ctx;

  // Back-compat: map old endpoint to brief mode
  ipcMain.handle("run-research", async (_event, args: any): Promise<any> => {
    const logger = {
      info: (msg: string, meta?: unknown) => appLogger.info(msg, meta),
      warn: (msg: string, meta?: unknown) => appLogger.warn(msg, meta),
      error: (msg: string, meta?: unknown) => appLogger.error(msg, meta),
    };
    const input: KnowledgeTaskRunnerInput = { task: String(args?.task ?? ""), mode: "brief", maxNotes: args?.maxNotes, expandSemantic: args?.expandSemantic, saveAsNote: args?.saveAsNote };
    return runKnowledgeTask({ db, logger }, input);
  });

  ipcMain.handle("run-knowledge-task", async (_event, args: KnowledgeTaskRunnerInput): Promise<KnowledgeTaskRunnerResult> => {
    const logger = {
      info: (msg: string, meta?: unknown) => appLogger.info(msg, meta),
      warn: (msg: string, meta?: unknown) => appLogger.warn(msg, meta),
      error: (msg: string, meta?: unknown) => appLogger.error(msg, meta),
    };
    return runKnowledgeTask({ db, logger }, args);
  });

  console.log("[IPC] ✅ Research IPC registered (run-research)");
}
