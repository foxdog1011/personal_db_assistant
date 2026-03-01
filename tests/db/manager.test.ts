import { describe, it, beforeAll, afterAll, expect } from "vitest";
import {
  initDatabase,
  insertNote,
  searchNotes,
  updateNote,
  deleteNote,
  closeDatabase,
} from "../../db/manager";

describe("db/manager", () => {
  beforeAll(() => {
    // Use in-memory database to avoid touching real files
    initDatabase(":memory:");
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("initializes schema and allows empty search", async () => {
    const rows = await searchNotes("");
    expect(Array.isArray(rows)).toBe(true);
  });

  it("inserts a note and finds it via search", async () => {
    const created = await insertNote("hello world", "greeting", "short summary", "text");
    expect(created.id).toBeGreaterThan(0);
    const found = await searchNotes("hello");
    expect(found.some((r) => r.id === created.id && r.content.includes("hello"))).toBe(true);
  });

  it("updates a note's content and tags", async () => {
    const created = await insertNote("to update", "tag1", "", "text");
    const res = await updateNote(created.id, "updated content", "tag2");
    expect(res.success).toBe(true);
    const found = await searchNotes("updated content");
    expect(found.some((r) => r.id === created.id && r.tags?.includes("tag2"))).toBe(true);
  });

  it("deletes a note", async () => {
    const created = await insertNote("to delete", "tmp", "", "text");
    const del = await deleteNote(created.id);
    expect(del.success).toBe(true);
    const found = await searchNotes("to delete");
    expect(found.some((r) => r.id === created.id)).toBe(false);
  });
});

