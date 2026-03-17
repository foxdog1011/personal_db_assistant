import type sqlite3 from "sqlite3";
import type OpenAI from "openai";

export interface ToolContext {
  db: sqlite3.Database;
  openai?: OpenAI;
  logger?: {
    info?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    error?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
  };
  now?: () => Date;
}

export interface Tool<Input, Output> {
  name: string;
  description: string;
  examples?: Array<{ input: Input; description?: string }>;
  run(ctx: ToolContext, input: Input): Promise<Output>;
}

// Re-export a stable Note type for tools
export interface Note {
  id: number;
  content: string;
  tags: string | null;
  summary: string | null;
  insight: string | null;
  created_at: string;
  pinned: number;
  color: string | null;
  type: string | null;
}
