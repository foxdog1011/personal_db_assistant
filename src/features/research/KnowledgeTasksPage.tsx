import React, { useMemo, useState } from "react";
import { electronAPI } from "@/services/electronAPI";
import { Button } from "@/features/common/ui/Button";
import { Input } from "@/features/common/ui/Input";
import type { KnowledgeTaskRunnerInput, KnowledgeTaskRunnerResult, KnowledgeTaskMode } from "@/types/electron-api";
import { useNavigate } from "react-router-dom";

function escapeHtml(s: string) {
  return s
    .replaceAll(/&/g, "&amp;")
    .replaceAll(/</g, "&lt;")
    .replaceAll(/>/g, "&gt;")
    .replaceAll(/"/g, "&quot;")
    .replaceAll(/'/g, "&#39;");
}

function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (let raw of lines) {
    const line = raw.trimEnd();
    if (line.length === 0) { flushList(); out.push("<br/>"); continue; }
    if (line.startsWith("### ")) { flushList(); out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("## "))  { flushList(); out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# "))   { flushList(); out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`); continue; }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) { inList = true; out.push("<ul class=\"list-disc pl-5 my-2\">"); }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    flushList();
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  flushList();
  return out.join("\n");
}

const modeTitle: Record<KnowledgeTaskMode, string> = {
  brief: "Brief",
  writing: "Draft",
  review: "Review",
};

const modeHelper: Record<KnowledgeTaskMode, string> = {
  brief: "Turn scattered notes into a concise, actionable brief.",
  writing: "Turn notes into a draft or structured output.",
  review: "Find overlap and cleanup opportunities in your notes.",
};

function placeholderFor(mode: KnowledgeTaskMode): string {
  if (mode === "brief") return "Summarize this week's project notes into a meeting brief";
  if (mode === "writing") return "Turn my notes about cloud cost optimization into a proposal draft";
  return "Review my notes on knowledge graphs for duplicates and overlap";
}

export default function KnowledgeTasksPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<KnowledgeTaskMode>("brief");
  const [task, setTask] = useState("");
  const [maxNotes, setMaxNotes] = useState(5);
  const [expandSemantic, setExpandSemantic] = useState(true);
  const [saveAsNote, setSaveAsNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KnowledgeTaskRunnerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const args: KnowledgeTaskRunnerInput = { task, mode, maxNotes, expandSemantic, saveAsNote };
      const res = await electronAPI.runKnowledgeTask(args);
      setResult(res);
      setHasRun(true);
    } catch (e: any) {
      setError(e?.message || String(e));
      setHasRun(true);
    } finally {
      setLoading(false);
    }
  };

  const summaryHtml = useMemo(() => (result?.output?.markdown ? markdownToHtml(result.output.markdown) : ""), [result?.output?.markdown]);

  // Mode-aware success text
  const successText = mode === "brief" ? "Brief saved to Notes" : mode === "writing" ? "Draft saved to Notes" : "Review saved to Notes";

  const json = result?.output?.json as any | undefined;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">🧭 Knowledge Tasks</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Brief is the primary workflow. Writing turns notes into drafts. Review helps maintain note quality.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-300">Mode</label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as KnowledgeTaskMode)}
            >
              <option value="brief">Brief — main</option>
              <option value="writing">Writing — draft</option>
              <option value="review">Review — cleanup</option>
            </select>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{modeHelper[mode]}</div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <Input
              placeholder={placeholderFor(mode)}
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 dark:text-gray-300">Max Notes</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxNotes}
              onChange={(e) => setMaxNotes(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="expSem" type="checkbox" checked={expandSemantic} onChange={(e) => setExpandSemantic(e.target.checked)} />
            <label htmlFor="expSem" className="text-sm">Expand semantic</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="saveNote" type="checkbox" checked={saveAsNote} onChange={(e) => setSaveAsNote(e.target.checked)} />
            <label htmlFor="saveNote" className="text-sm">Save as note</label>
          </div>
        </div>
        <div>
          <Button variant="primary" size="sm" onClick={run} disabled={loading || !task.trim()}>
            {loading ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {!hasRun && (
        <div className="p-6 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-sm text-gray-600 dark:text-gray-300">
          Enter a task and click Run to transform your notes into usable outputs.
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          Running task…
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5">
            <h3 className="text-md font-semibold mb-2">{modeTitle[result.mode]}</h3>
            {/* Structured JSON blocks (supplement) */}
            {result.mode === "brief" && json && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-sm">
                <div>
                  <div className="font-medium">Key Updates</div>
                  <ul className="list-disc pl-4 mt-1">
                    {(json.keyUpdates || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Risks / Blockers</div>
                  <ul className="list-disc pl-4 mt-1">
                    {(json.risks || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Next Steps</div>
                  <ul className="list-disc pl-4 mt-1">
                    {(json.nextSteps || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {result.mode === "writing" && json && (
              <div className="mb-3 text-sm space-y-2">
                {json.title && <div><span className="font-medium">Title:</span> {json.title}</div>}
                <div>
                  <div className="font-medium">Outline</div>
                  <ul className="list-disc pl-4 mt-1">
                    {(json.outline || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {result.mode === "review" && json && (
              <div className="mb-3 text-sm grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="font-medium">Potential Duplicates</div>
                  <div className="mt-1 font-mono text-xs">{Array.isArray(json.potentialDuplicates) ? json.potentialDuplicates.join(", ") : "-"}</div>
                </div>
                <div>
                  <div className="font-medium">Overlapping Notes</div>
                  <ul className="list-disc pl-4 mt-1">
                    {(json.overlapNotes || []).map((o: any, i: number) => <li key={i}>#{o.id} — {(o.overlap * 100).toFixed(0)}%</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Merge Suggestions</div>
                  <ul className="list-disc pl-4 mt-1">
                    {(json.mergeSuggestions || []).map((x: string, i: number) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>
            )}

            {/* Primary markdown output */}
            <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
          </div>

          {result.createdNoteId && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-2xl p-4">
              <div className="text-green-800 dark:text-green-200 text-sm">
                ✅ {successText}: <span className="font-mono">{result.createdNoteId}</span>
              </div>
              <div className="mt-2">
                <Button size="sm" variant="ghost" onClick={() => navigate("/notes")}>Go to Notes</Button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5">
            <h3 className="text-md font-semibold mb-2">Selected Notes</h3>
            <ul className="text-sm space-y-2">
              {result.selected.map((s) => (
                <li key={s.id} className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">ID: {s.id}</span>
                    <span className={"text-xs px-2 py-0.5 rounded " + (s.source === "keyword" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}>{s.source}</span>
                  </div>
                  <div className="mt-2 text-gray-800 dark:text-gray-200 leading-snug line-clamp-4">{s.preview}</div>
                </li>
              ))}
            </ul>
          </div>

          {result.trace && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5">
              <h3 className="text-md font-semibold mb-2">Trace</h3>
              <div className="text-sm">
                <div>
                  <span className="font-medium">keywordHits:</span> {JSON.stringify(result.trace.keywordHits)}
                </div>
                {result.trace.semanticSeedIds && (
                  <div>
                    <span className="font-medium">semanticSeedIds:</span> {JSON.stringify(result.trace.semanticSeedIds)}
                  </div>
                )}
                {result.trace.semanticAddedIds && (
                  <div>
                    <span className="font-medium">semanticAddedIds:</span> {JSON.stringify(result.trace.semanticAddedIds)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

