import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // --- Notes ---
  addNote: (note: { content: string; tags?: string; type?: string }) =>
    ipcRenderer.invoke("add-note", note),

  updateNote: (note: { id: number; content: string; tags?: string; insight?: string }) =>
    ipcRenderer.invoke("update-note", note),

  searchNote: (args: { query: string; orderBy?: string }) =>
    ipcRenderer.invoke("search-note", args),

  deleteNote: (id: number) => ipcRenderer.invoke("delete-note", id),

  togglePin: (id: number) => ipcRenderer.invoke("toggle-pin", id),

  updateColor: (args: { id: number; color: string }) =>
    ipcRenderer.invoke("update-color", args),

  // --- AI ---
  generateSummary: (args: { id: number; content: string }) =>
    ipcRenderer.invoke("generateSummary", args),

  generateInsight: (args: { id: number; content: string; summary?: string }) =>
    ipcRenderer.invoke("generateInsight", args),

  aiQuery: (args: { prompt: string }) =>
    ipcRenderer.invoke("ai-query", args),

  // --- Knowledge Graph ---
  getKnowledgeGraph: (params?: {
    mode?: string; noteId?: string; depth?: number; limit?: number;
    minSupportCount?: number; minSupportingNotes?: number; minWeight?: number;
  }) => ipcRenderer.invoke("get-knowledge-graph", params),
  rebuildRelations: () => ipcRenderer.invoke("rebuild-relations"),
  extractTriples: (noteId: number) => ipcRenderer.invoke("extract-triples", noteId),
  getNoteByNode: (label: string) => ipcRenderer.invoke("get-note-by-node", label),

  // --- Graph Evolution ---
  getGraphEvolution: () => ipcRenderer.invoke("get-graph-evolution"),
  insertTriple: (triple: { head: string; relation: string; tail: string }) =>
    ipcRenderer.invoke("insert-triple", triple),

  // --- Semantic / Relation ---
  getRelatedNotes: (args: { noteId: string; k?: number }) =>
    ipcRenderer.invoke("get-related-notes", args),

  getSemanticNotes: (args: { noteId: string; k?: number }) =>
    ipcRenderer.invoke("get-semantic-notes", args),

  generateAIRelations: (args: { content: string }) =>
    ipcRenderer.invoke("generate-ai-relations", args),

  generateReflectionQuestions: (content: string) =>
    ipcRenderer.invoke("generate-reflection-questions", content),

  // --- AI Job Queue ---
  getAiJobStats: () => ipcRenderer.invoke("get-ai-job-stats"),
  getNoteAiJobs: (noteId: string) => ipcRenderer.invoke("get-note-ai-jobs", noteId),
  getWorkerStatus: () => ipcRenderer.invoke("get-worker-status"),
  pauseWorker: () => ipcRenderer.invoke("pause-worker"),
  resumeWorker: () => ipcRenderer.invoke("resume-worker"),

  // --- Dev Utilities ---
  getDiagnostics: () => ipcRenderer.invoke("get-diagnostics"),
  resetDatabase: () => ipcRenderer.invoke("reset-database"),
  clearGraphData: () => ipcRenderer.invoke("clear-graph-data"),

  // --- Agent Runner ---
  runResearch: (args: { task: string; maxNotes?: number; expandSemantic?: boolean; saveAsNote?: boolean }) =>
    ipcRenderer.invoke("run-research", args),
  runKnowledgeTask: (args: { task: string; mode: "brief"|"writing"|"review"; maxNotes?: number; expandSemantic?: boolean; saveAsNote?: boolean }) =>
    ipcRenderer.invoke("run-knowledge-task", args),

  // --- Quick Add & Single Note ---
  quickAddNote: (note: { content: string; tags?: string }) =>
    ipcRenderer.invoke("quick-add-note", note),

  getNoteContent: (args: { id: number }) =>
    ipcRenderer.invoke("get-note-content", args),

  // --- Relation Evidence ---
  getRelationEvidence: (params: { relationId: string; limit?: number }) =>
    ipcRenderer.invoke("get-relation-evidence", params),

  getCanonicalEdgeEvidence: (params: {
    canonicalSource: string;
    canonicalTarget: string;
    relation?: string;
    limit?: number;
  }) => ipcRenderer.invoke("get-canonical-edge-evidence", params),
});
