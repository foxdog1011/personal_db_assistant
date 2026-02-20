import '@testing-library/jest-dom';

// JSDOM does not implement scrollIntoView — stub it globally so any component
// that calls element.scrollIntoView() (e.g. keyboard-navigation auto-scroll)
// doesn't throw in tests.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = function () {};
}

// Minimal stub to avoid runtime errors if components touch electronAPI in tests
// Tests should mock calls explicitly when needed.
if (!(window as any).electronAPI) {
  (window as any).electronAPI = {
    generateSummary: async () => ({ success: true, summary: '' }),
    extractTriples: async () => ({ success: true, triples: [] }),
    getKnowledgeGraph: async () => ({ nodes: [], edges: [] }),
    getAiJobStats: async () => ({ pending: 0, running: 0, error: 0, done: 0 }),
    getNoteAiJobs: async (_noteId: string) => [],
    getWorkerStatus: async () => ({ paused: false }),
    pauseWorker: async () => ({ success: true }),
    resumeWorker: async () => ({ success: true }),
    getDiagnostics: async () => ({
      app: { version: '1.0.0', electron: '28.0.0', node: '22.0.0', platform: 'test', arch: 'x64' },
      dev: { VITE_DEV_SERVER_URL: null, port: null },
      db: { dbPath: ':memory:', notesCount: 0, lastError: null },
      ai: { mockMode: true, openaiConfigured: false, lastError: null },
      ipc: { ready: true },
    }),
    getRelatedNotes: async () => ({ related: [] }),
    getSemanticNotes: async () => ({ related: [] }),
    getRelationEvidence: async () => ({ evidence: [] }),
  };
}

