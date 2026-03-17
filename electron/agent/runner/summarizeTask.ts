import { generalQuery } from "../../services/ai_service";
import { buildResearchContext } from "./buildResearchContext";
import { buildBriefPrompt } from "../prompts/briefPrompt";
import { buildWritingPrompt } from "../prompts/writingPrompt";
import { buildReviewPrompt } from "../prompts/reviewPrompt";
import type { ResearchNoteItem } from "../prompts/researchSummaryPrompt";

export type TaskMode = "brief" | "writing" | "review";

export interface BriefJSON { keyUpdates: string[]; risks: string[]; nextSteps: string[] }
export interface WritingJSON { title?: string; outline: string[]; draft: string }
export interface ReviewJSON { potentialDuplicates: number[]; overlapNotes: Array<{ id: number; overlap: number }>; mergeSuggestions: string[] }

export type ModeJSON = BriefJSON | WritingJSON | ReviewJSON;

export interface TaskSummaryResult<M extends TaskMode = TaskMode> {
  mode: M;
  markdown: string;
  json?: M extends "brief" ? BriefJSON : M extends "writing" ? WritingJSON : ReviewJSON;
}

export function buildPrompt(mode: TaskMode, task: string, items: ResearchNoteItem[]): string {
  if (mode === "brief") return buildBriefPrompt(task, items);
  if (mode === "writing") return buildWritingPrompt(task, items);
  return buildReviewPrompt(task, items);
}

export async function summarizeTask(mode: TaskMode, task: string, items: ResearchNoteItem[]): Promise<TaskSummaryResult> {
  const prompt = buildPrompt(mode, task, items);
  const raw = await generalQuery(prompt);
  let json: any | undefined;
  let markdown = raw || "";
  try {
    // Try to extract a leading JSON block
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      json = JSON.parse(match[0]);
      markdown = raw.slice(raw.indexOf(match[0]) + match[0].length).trim();
    }
  } catch {
    // ignore parse errors; fallback to markdown only
  }
  return { mode, markdown: markdown.trim(), json } as TaskSummaryResult;
}

