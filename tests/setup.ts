import '@testing-library/jest-dom';

// Minimal stub to avoid runtime errors if components touch electronAPI in tests
// Tests should mock calls explicitly when needed.
if (!(window as any).electronAPI) {
  (window as any).electronAPI = {
    generateSummary: async () => ({ success: true, summary: '' }),
    extractTriples: async () => ({ success: true, triples: [] }),
    getKnowledgeGraph: async () => ({ nodes: [], edges: [] }),
  };
}

