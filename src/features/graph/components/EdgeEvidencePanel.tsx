import React, { useEffect, useState } from "react";
import { Skeleton } from "@/features/common/ui/Skeleton";
import type { EvidenceItem } from "@/types/electron-api";

interface Props {
  /** Note-mode: fetch evidence by exact concept_relations.id */
  relationId?: string;
  /** Global-mode: fetch evidence by canonical source/target pair */
  canonical?: { source: string; target: string; relation?: string };
  fromLabel: string;
  toLabel: string;
  onClose: () => void;
}

export function EdgeEvidencePanel({
  relationId,
  canonical,
  fromLabel,
  toLabel,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  // Stable key to re-trigger the effect when the edge changes
  const queryKey = canonical
    ? JSON.stringify({ cs: canonical.source, ct: canonical.target, rel: canonical.relation ?? "" })
    : String(relationId ?? "");

  useEffect(() => {
    setLoading(true);
    const fetch = canonical
      ? window.electronAPI.getCanonicalEdgeEvidence({
          canonicalSource: canonical.source,
          canonicalTarget: canonical.target,
          relation: canonical.relation,
          limit: 5,
        })
      : window.electronAPI.getRelationEvidence({ relationId: relationId!, limit: 5 });

    fetch
      .then((res) => setEvidence(res.evidence || []))
      .catch(() => setEvidence([]))
      .finally(() => setLoading(false));
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleItemClick = (noteId: string) => {
    window.location.hash = `#/graph?noteId=${noteId}`;
    onClose();
  };

  return (
    <div data-testid="edge-evidence-panel" className="space-y-3">
      {/* Header */}
      <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
        <span className="text-indigo-400">{fromLabel}</span>
        <span className="text-gray-500">→</span>
        <span className="text-indigo-400">{toLabel}</span>
      </h3>

      {loading ? (
        <div data-testid="evidence-loading" className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ) : evidence.length === 0 ? (
        <div
          data-testid="evidence-empty"
          className="text-sm text-gray-400 py-4 text-center"
        >
          尚無證據片段（可能還在處理 triples）
        </div>
      ) : (
        <ul className="space-y-2">
          {evidence.map((item) => (
            <li
              key={item.noteId}
              data-testid={`evidence-item-${item.noteId}`}
              onClick={() => handleItemClick(item.noteId)}
              className="cursor-pointer rounded-lg border border-gray-700 bg-gray-800/60 p-3
                         hover:border-indigo-500/60 hover:bg-gray-800 transition-colors"
            >
              <p className="text-xs font-medium text-gray-200 mb-1 truncate">
                {item.title || `筆記 ${item.noteId}`}
              </p>
              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                {item.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default EdgeEvidencePanel;
