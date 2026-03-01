import React, { useState, useCallback } from "react";
import type { DiagnosticsResult, AiJobStats } from "@/types/electron-api";
import { ipc } from "@/services/electronIpc";
import { Button } from "@/features/common/ui/Button";

const Row: React.FC<{ label: string; value: React.ReactNode; error?: boolean }> = ({
  label,
  value,
  error,
}) => (
  <div className="flex justify-between py-1 text-sm">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className={error ? "text-red-500 font-medium" : "text-gray-800 dark:text-gray-200"}>
      {value}
    </span>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-3">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
      {title}
    </h4>
    <div className="border-t border-gray-200 dark:border-gray-700 pt-1">{children}</div>
  </div>
);

export default function DiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DiagnosticsResult | null>(null);
  const [jobStats, setJobStats] = useState<AiJobStats | null>(null);
  const [workerPaused, setWorkerPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, stats, wStatus] = await Promise.all([
        ipc.getDiagnostics(),
        ipc.getAiJobStats(),
        ipc.getWorkerStatus(),
      ]);
      setData(res);
      setJobStats(stats);
      setWorkerPaused(wStatus.paused);
    } catch (e: any) {
      setError(e?.message || "IPC call failed");
      setData(null);
      setJobStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleWorker = useCallback(async () => {
    if (workerPaused) {
      await ipc.resumeWorker();
      setWorkerPaused(false);
    } else {
      await ipc.pauseWorker();
      setWorkerPaused(true);
    }
    // Refresh stats after a short delay so the UI reflects the change
    setTimeout(load, 500);
  }, [workerPaused, load]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={toggle}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        title="Diagnostics"
        aria-label="Diagnostics"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Panel overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={toggle} />

          {/* Panel */}
          <div className="relative mt-12 w-80 max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                Diagnostics
              </h3>
              <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                {loading ? "..." : "Refresh"}
              </Button>
            </div>

            {error && (
              <div className="mb-3 p-2 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs">
                IPC Error: {error}
              </div>
            )}

            {data && (
              <>
                <Section title="App">
                  <Row label="Version" value={data.app.version} />
                  <Row label="Electron" value={data.app.electron} />
                  <Row label="Node" value={data.app.node} />
                  <Row label="Platform" value={`${data.app.platform} / ${data.app.arch}`} />
                </Section>

                {data.dev.VITE_DEV_SERVER_URL && (
                  <Section title="Dev Server">
                    <Row label="URL" value={data.dev.VITE_DEV_SERVER_URL} />
                    <Row label="Port" value={data.dev.port ?? "—"} />
                  </Section>
                )}

                <Section title="Database">
                  <Row label="Path" value={data.db.dbPath || "unknown"} />
                  <Row label="Notes" value={data.db.notesCount} />
                  {data.db.lastError && (
                    <Row label="Error" value={data.db.lastError} error />
                  )}
                </Section>

                <Section title="AI">
                  <Row
                    label="OpenAI Key"
                    value={data.ai.openaiConfigured ? "Configured" : "Missing"}
                    error={!data.ai.openaiConfigured}
                  />
                  <Row
                    label="Mock Mode"
                    value={data.ai.mockMode ? "ON" : "OFF"}
                  />
                  {data.ai.lastError && (
                    <Row label="Error" value={data.ai.lastError} error />
                  )}
                </Section>

                <Section title="IPC">
                  <Row
                    label="Status"
                    value={data.ipc.ready ? "Ready" : "Not ready"}
                    error={!data.ipc.ready}
                  />
                </Section>

                {jobStats && (
                  <Section title="AI Job Queue">
                    <Row label="Worker" value={workerPaused ? "Paused" : "Running"} error={workerPaused} />
                    <Row label="Pending" value={jobStats.pending} />
                    <Row label="Running" value={jobStats.running} />
                    <Row label="Done" value={jobStats.done} />
                    <Row
                      label="Error"
                      value={jobStats.error}
                      error={jobStats.error > 0}
                    />
                    <div className="mt-1">
                      <Button
                        variant={workerPaused ? "success" : "neutral"}
                        size="sm"
                        onClick={handleToggleWorker}
                      >
                        {workerPaused ? "Resume Worker" : "Pause Worker"}
                      </Button>
                    </div>
                  </Section>
                )}
              </>
            )}

            {!data && !error && !loading && (
              <p className="text-sm text-gray-400">Loading...</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
