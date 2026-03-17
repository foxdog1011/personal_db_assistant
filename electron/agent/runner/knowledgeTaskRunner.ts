import type { ToolContext, Note } from "../tools/types";
import { toolMap } from "../tools";
import { buildResearchContext } from "./buildResearchContext";
import { summarizeTask, type TaskSummaryResult, type TaskMode } from "./summarizeTask";

export interface KnowledgeTaskRunnerInput {
  task: string;
  mode: TaskMode;                // brief | writing | review
  maxNotes?: number;             // default 5
  expandSemantic?: boolean;      // default false
  saveAsNote?: boolean;          // default false
}

export interface SelectedNoteInfo {
  id: number;
  preview: string;
  source: "keyword" | "semantic";
}

export interface KnowledgeTaskRunnerResult {
  task: string;
  mode: TaskMode;
  selected: SelectedNoteInfo[];
  output: TaskSummaryResult;
  createdNoteId?: number;
  trace: {
    keywordHits: number[];
    semanticSeedIds?: number[];
    semanticAddedIds?: number[];
  };
}

function uniqueById<T extends { id: number }>(arr: T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const item of arr) {
    if (!seen.has(item.id)) { seen.add(item.id); out.push(item); }
  }
  return out;
}

export async function runKnowledgeTask(ctx: ToolContext, input: KnowledgeTaskRunnerInput): Promise<KnowledgeTaskRunnerResult> {
  const log = ctx.logger?.info?.bind(ctx.logger) ?? console.log;
  const { task, mode } = input;
  const maxNotes = Math.max(1, input.maxNotes ?? 5);
  const expandSemantic = !!input.expandSemantic;
  const saveAsNote = !!input.saveAsNote;

  log(`[KTask] start mode=${mode} task='${task}' maxNotes=${maxNotes} expand=${expandSemantic} save=${saveAsNote}`);

  // 1) Keyword retrieval
  const search = await toolMap.searchNotes.run(ctx, { query: task, limit: maxNotes });
  const keywordNotes: Note[] = (search.items as Note[]).slice(0, maxNotes);
  const keywordIds = keywordNotes.map((n) => n.id);
  type Sel = { note: Note; source: "keyword" | "semantic" };
  let selected: Sel[] = keywordNotes.map((n) => ({ note: n, source: "keyword" as const }));

  // 2) Optional multi-seed semantic expansion
  let semanticSeedIds: number[] | undefined;
  let semanticAddedIds: number[] | undefined;
  if (expandSemantic && selected.length > 0 && selected.length < maxNotes) {
    try {
      const seedCount = Math.min(3, Math.max(1, keywordNotes.length));
      const seeds = keywordNotes.slice(0, seedCount);
      semanticSeedIds = seeds.map((s) => s.id);

      const remaining = Math.max(0, maxNotes - selected.length);
      const perSeed = Math.max(1, Math.ceil(remaining / seedCount));

      const addedIds: number[] = [];
      for (const seed of seeds) {
        if (selected.length >= maxNotes) break;
        const want = Math.max(0, Math.min(perSeed, maxNotes - selected.length));
        if (want <= 0) break;
        const sem = await toolMap.semanticSearchNotes.run(ctx, { noteId: seed.id, k: want });
        const semIds = (sem.related || [])
          .map((r: { noteId: string }) => Number(r.noteId))
          .filter((n: number) => !Number.isNaN(n));
        for (const id of semIds) {
          if (selected.length >= maxNotes) break;
          if (keywordIds.includes(id)) continue;
          if (selected.some((s) => s.note.id === id)) continue;
          const row = await toolMap.getNoteById.run(ctx, { id });
          if (row) {
            selected.push({ note: row as unknown as Note, source: "semantic" });
            addedIds.push(id);
          }
        }
      }
      if (addedIds.length > 0) semanticAddedIds = addedIds;
    } catch (e) {
      ctx.logger?.warn?.("[KTask] semantic expansion failed", e);
    }
  }

  // 3) Deduplicate and cap (preserve first occurrence → ensures keyword precedence)
  const entries = selected.map((s) => ({ id: s.note.id, value: s }));
  const dedupEntries = uniqueById(entries);
  selected = dedupEntries.map((e) => e.value).slice(0, maxNotes);

  // 4) Build compact context and summarize per mode
  const built = buildResearchContext(selected.map((s) => s.note));
  const output = await summarizeTask(mode, task, built);

  // 5) Optionally save as a new note
  let createdNoteId: number | undefined;
  if (saveAsNote) {
    const sourceIds = selected.map((s) => s.note.id).join(", ");
    const header = `# Agent Knowledge Task\n\n` +
      `Task Mode: ${mode}\n` +
      `Task: ${task}\n` +
      `Source Note IDs: ${sourceIds}\n\n`;
    const content = header + output.markdown + "\n";
    const created = await toolMap.createNote.run(ctx, { content, tags: `agent-generated,task-${mode}` });
    createdNoteId = created.id;
  }

  const result: KnowledgeTaskRunnerResult = {
    task,
    mode,
    selected: built.map((b) => ({ id: b.id, preview: b.preview, source: selected.find((s) => s.note.id === b.id)?.source ?? "keyword" })),
    output,
    createdNoteId,
    trace: {
      keywordHits: keywordIds,
      semanticSeedIds,
      semanticAddedIds,
    },
  };

  log(`[KTask] done mode=${mode} selected=${result.selected.length} saved=${createdNoteId ? 1 : 0}`);
  return result;
}
