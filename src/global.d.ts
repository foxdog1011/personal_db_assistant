export interface ElectronAPI {
  // --- CRUD ---
  addNote: (note: { content: string; tags?: string; type?: string }) => Promise<any>;
  searchNote: (args: { query: string; orderBy?: string }) => Promise<any>;
  deleteNote: (id: number) => Promise<any>;
  updateNote: (note: { id: number; content: string; tags?: string; insight?: string }) => Promise<any>;
  togglePin: (id: number) => Promise<{ success: boolean; pinned: number }>;
  updateColor: (args: { id: number; color: string }) => Promise<{ success: boolean }>;

  // --- AI ---
  generateSummary: (args: { id: number; content: string }) => Promise<{ success: boolean; summary?: string }>;
  generateInsight: (args: { id: number; content: string; summary?: string }) => Promise<{ success: boolean; insight?: string }>;
  extractTriples: (noteId: number) => Promise<{ success: boolean; triples: any[] }>;
  aiQuery: (args: { prompt: string }) => Promise<string>;

  // --- Graph ---
  getKnowledgeGraph: () => Promise<{ nodes: any[]; links: any[] }>;
  rebuildRelations: () => Promise<{ success: boolean; totalNotes: number; totalRelations: number }>;
  getRelatedNotes: (noteId: number) => Promise<Array<{ id: number; content: string; score: number }>>;
  getNoteByNode: (nodeLabel: string) => Promise<any>;
  generateAIRelations: (args: { content: string }) => Promise<{ suggestions: string[] }>;
  generateReflectionQuestions: (content: string) => Promise<string[]>;
  getGraphEvolution: () => Promise<{ success: boolean; steps: any[] }>;
  insertTriple: (triple: { head: string; relation: string; tail: string }) => Promise<{ success: boolean; id?: number }>;

  // --- Dev Utilities ---
  resetDatabase: () => Promise<{ success: boolean; error?: string }>;
  clearGraphData: () => Promise<{ success: boolean; error?: string }>;

  // --- Note Detail ---
  getNoteContent: (args: {
    id: number;
  }) => Promise<{
    success: boolean;
    note?: {
      id: number;
      content: string;
      tags: string;
      summary?: string;
      insight?: string;
      color?: string;
      pinned?: number;
      created_at?: string;
    };
    error?: string;
  }>;

  // --- Quick Add ---
  quickAddNote: (note: { content: string; tags?: string }) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
