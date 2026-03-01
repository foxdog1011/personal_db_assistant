import { electronAPI } from "@/services/electronAPI";

export const noteService = {
  add: (content: string, tags: string, type: string = "text") =>
    electronAPI.addNote({ content, tags, type }),
  search: (query: string, orderBy?: string) => electronAPI.searchNote({ query, orderBy }),
  remove: (id: number) => electronAPI.deleteNote(id),
  update: (id: number, content: string, tags: string) =>
    electronAPI.updateNote({ id, content, tags }),
  togglePin: (id: number) => electronAPI.togglePin(id),
  updateColor: (id: number, color: string) => electronAPI.updateColor({ id, color }),
  summarize: (id: number, content: string) => electronAPI.generateSummary({ id, content }),
};
