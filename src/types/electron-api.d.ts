// ── Relation Evidence ─────────────────────────────────────────────────────────
export interface EvidenceItem {
  noteId: string;
  title: string;
  snippet: string;
  createdAt: string;
  /** concept_relations.id — present in canonical query results */
  relationId?: string;
}

export interface EvidenceResult {
  evidence: EvidenceItem[];
}

// ── Semantic similarity recommendation ───────────────────────────────────────
export interface SemanticNote {
  noteId: string;
  title: string;
  score: number; // 0.0–1.0 cosine or overlap
}

// ── Concept-graph recommendation ──────────────────────────────────────────────
export interface RelatedNote {
  noteId: string;
  title: string;
  score: number;
  sharedTerms: string[];
  sharedCount: number;
}

// ── Graph query shared types ──────────────────────────────────────────────────
export type GraphQueryMode = "note" | "global";

export interface GraphQueryParams {
  mode?: GraphQueryMode;
  noteId?: string;
  depth?: 1 | 2;
  limit?: number;
  minSupportCount?: number;
  minSupportingNotes?: number;
  /** @deprecated use minSupportCount (note) or minSupportingNotes (global) */
  minWeight?: number;
}

export interface GraphResult {
  nodes: any[];
  links: any[];
}

// ─────────────────────────────────────────────────────────────────────────────
export interface AiJobStats {
  pending: number;
  running: number;
  error: number;
  done: number;
}

export interface AiJob {
  id: number;
  note_id: number;
  job_type: string;
  status: "pending" | "running" | "done" | "error";
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticsResult {
  app: { version: string; electron: string; node: string; platform: string; arch: string };
  dev: { VITE_DEV_SERVER_URL: string | null; port: number | null };
  db: { dbPath: string | null; notesCount: number; lastError: string | null };
  ai: { mockMode: boolean; openaiConfigured: boolean; lastError: string | null };
  ipc: { ready: boolean };
}

export interface ElectronAPI {
  // --- CRUD ---
  addNote: (note: { content: string; tags: string; type?: string }) => Promise<any>;
  searchNote: (args: { query: string; orderBy?: string }) => Promise<any>;
  deleteNote: (id: number) => Promise<any>;
  updateNote: (note: { id: number; content: string; tags: string; insight?: string }) => Promise<any>;
  togglePin: (id: number) => Promise<{ success: boolean; pinned: number }>;
  updateColor: (args: { id: number; color: string }) => Promise<{ success: boolean }>;

  // --- AI ---
  generateSummary: (args: { id: number; content: string }) => Promise<any>;
  generateInsight: (args: { id: number; content: string; summary?: string }) => Promise<any>;
  extractTriples: (noteId: number) => Promise<{ success: boolean; triples: any[] }>;

  // --- Graph ---
  getKnowledgeGraph: (params?: GraphQueryParams) => Promise<GraphResult>;
  rebuildRelations: () => Promise<{ success: boolean; totalNotes: number; totalRelations: number }>;
  getRelatedNotes: (args: { noteId: string; k?: number }) => Promise<{ related: RelatedNote[] }>;
  getSemanticNotes: (args: { noteId: string; k?: number }) => Promise<{ related: SemanticNote[] }>;
  getNoteByNode: (nodeLabel: string) => Promise<any>;
  generateAIRelations: (args: { content: string }) => Promise<any>;
  generateReflectionQuestions: (content: string) => Promise<string[]>;
  getGraphEvolution: () => Promise<{ success: boolean; steps: any[] }>;
  insertTriple: (triple: { head: string; relation: string; tail: string }) => Promise<{ success: boolean; id?: number }>;
  aiQuery: (args: { prompt: string }) => Promise<string>;

  // --- AI Job Queue ---
  getAiJobStats: () => Promise<AiJobStats>;
  getNoteAiJobs: (noteId: string) => Promise<AiJob[]>;
  getWorkerStatus: () => Promise<{ paused: boolean }>;
  pauseWorker: () => Promise<{ success: boolean }>;
  resumeWorker: () => Promise<{ success: boolean }>;

  // --- Quick Add ---
  quickAddNote: (note: { content: string; tags?: string }) => Promise<{ success: boolean; id?: number }>;

  // --- Relation Evidence ---
  getRelationEvidence: (params: { relationId: string; limit?: number }) => Promise<EvidenceResult>;
  getCanonicalEdgeEvidence: (params: {
    canonicalSource: string;
    canonicalTarget: string;
    relation?: string;
    limit?: number;
  }) => Promise<EvidenceResult>;

  // --- Dev Utilities ---
  getDiagnostics: () => Promise<DiagnosticsResult>;
  resetDatabase: () => Promise<{ success: boolean; error?: string }>;
  clearGraphData: () => Promise<{ success: boolean; error?: string }>;
  getNoteContent: (args: { id: number }) => Promise<{ success: boolean; note?: any; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
