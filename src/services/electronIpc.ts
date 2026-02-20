import type { ElectronAPI, GraphQueryParams, RelatedNote, SemanticNote, EvidenceResult } from "@/types/electron-api";

type Win = Window & { electronAPI?: ElectronAPI };

function getAPI(): ElectronAPI {
  const api = (window as unknown as Win).electronAPI;
  if (!api) throw new Error("❌ electronAPI is not available in window");
  return api;
}

export const ipc = {
  /* =====================================================
   * 💭 AI 功能
   * ===================================================== */
  generateSummary: (args: { id: number; content: string }) =>
    getAPI().generateSummary(args),

  generateInsight: (args: {
    id: number;
    content: string;
    summary?: string;
    insight?: string;
  }) => getAPI().generateInsight(args),

  aiQuery: (args: { prompt: string }) => getAPI().aiQuery(args),

  extractTriples: (noteId: number) => getAPI().extractTriples(noteId),


  /* =====================================================
   * 🗂 筆記 CRUD
   * ===================================================== */
  addNote: (note: { content: string; tags: string; type?: string }) =>
    getAPI().addNote(note),

  searchNote: (params: { query: string; orderBy?: string }) =>
    getAPI().searchNote(params),

  deleteNote: (id: number) => getAPI().deleteNote(id),

  updateNote: (note: {
    id: number;
    content: string;
    tags: string;
    insight?: string;
  }) => getAPI().updateNote(note),

  togglePin: (id: number) => getAPI().togglePin(id),

  updateColor: (args: { id: number; color: string }) =>
    getAPI().updateColor(args),

  /* =====================================================
   * 🧠 知識圖譜 / 關聯操作
   * ===================================================== */
  getKnowledgeGraph: (params?: GraphQueryParams) =>
    getAPI().getKnowledgeGraph(params),

  rebuildRelations: () => getAPI().rebuildRelations(),

  getRelatedNotes: (args: { noteId: string; k?: number }) => getAPI().getRelatedNotes(args),
  getSemanticNotes: (args: { noteId: string; k?: number }) => getAPI().getSemanticNotes(args),

  getNoteByNode: (nodeLabel: string) => getAPI().getNoteByNode(nodeLabel),

  generateAIRelations: (args: { content: string }) =>
    getAPI().generateAIRelations(args),

  /* =====================================================
   * 🧘‍♀️ 反思問答 / Graph 演化
   * ===================================================== */
  generateReflectionQuestions: (content: string) =>
    getAPI().generateReflectionQuestions(content),

  getGraphEvolution: () => getAPI().getGraphEvolution(),

  insertTriple: (triple: { head: string; relation: string; tail: string }) =>
    getAPI().insertTriple(triple),

  // 🧠 AI Job Queue
  getAiJobStats: () => getAPI().getAiJobStats(),
  getNoteAiJobs: (noteId: string) => getAPI().getNoteAiJobs(noteId),
  getWorkerStatus: () => getAPI().getWorkerStatus(),
  pauseWorker: () => getAPI().pauseWorker(),
  resumeWorker: () => getAPI().resumeWorker(),

  // 🔍 Relation Evidence
  getRelationEvidence: (params: { relationId: string; limit?: number }): Promise<EvidenceResult> =>
    getAPI().getRelationEvidence(params),

  // 🧪 Dev utilities
  getDiagnostics: () => getAPI().getDiagnostics(),
  resetDatabase: () => getAPI().resetDatabase(),
  clearGraphData: () => getAPI().clearGraphData(),
  getNoteContent: async ({ id }: { id: number }) =>
    window.electronAPI.getNoteContent?.({ id }),
};

export default ipc;
