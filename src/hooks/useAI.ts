import { useCallback } from "react";
import { noteService } from "@/features/notes/services/noteService";
import { ipc } from "@/services/electronIpc";

export function useAI() {
  const summarize = useCallback(async (id: number, content: string) => {
    return await noteService.summarize(id, content);
  }, []);

  const extractKnowledge = useCallback(async () => {
    return await ipc.rebuildRelations();
  }, []);

  return { summarize, extractKnowledge };
}
