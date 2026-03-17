import type { Tool } from "./types";
import searchNotes from "./searchNotes";
import getNoteById from "./getNoteById";
import createNote from "./createNote";
import updateNote from "./updateNote";
import semanticSearchNotes from "./semanticSearchNotes";

export const tools: Tool<any, any>[] = [
  searchNotes,
  getNoteById,
  createNote,
  updateNote,
  semanticSearchNotes,
];

export const toolMap = Object.fromEntries(tools.map((t) => [t.name, t] as const));

export * from "./types";

