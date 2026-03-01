import { useEffect, useState } from "react";
import type { SimilarNote } from "@/types/semantic";

export function useSemanticNotes(noteId: number) {
  const [relatedNotes, setRelatedNotes] = useState<SimilarNote[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedNote, setSelectedNote] = useState<SimilarNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await window.electronAPI.getRelatedNotes({
        noteId: noteId.toString(),
      });
      // Adapt RelatedNote → SimilarNote shape for downstream consumers
      const notes: SimilarNote[] = (res.related || []).map((r) => ({
        id: parseInt(r.noteId, 10),
        content: r.title,
        score: r.score,
      }));
      const tagResp = await window.electronAPI.generateAIRelations({
        content: notes[0]?.content || "",
      });

      setRelatedNotes(notes);
      setTags(tagResp?.suggestions?.split("、") || []);
      setLoading(false);
    }
    fetchData();
  }, [noteId]);

  return { relatedNotes, tags, selectedNote, setSelectedNote, loading };
}
