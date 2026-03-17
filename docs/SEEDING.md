Knowledge Tasks — Seeding Notes

This project includes a small, intentional dataset to demo the Knowledge Tasks modes (Brief, Writing, Review).

Files
- scripts/seed_notes.json — seed data (~16 notes)
- electron/scripts/seedNotes.ts — importer using the existing notes service
- scripts/demo_tasks.md — recommended demo prompts and what to expect

Prerequisites
- Node.js 18+
- npm install
- If sqlite3 native module mismatches, run: npm rebuild sqlite3 --build-from-source
- Optional offline mode: set MOCK_OPENAI=1 to avoid network
  - Windows (PowerShell): $env:MOCK_OPENAI="1"
  - macOS/Linux: export MOCK_OPENAI=1

Import
- npm run seed:notes

What it does
- Initializes the app DB (db/notes.db)
- Inserts notes from scripts/seed_notes.json, skipping duplicates by content
- Enqueues AI jobs (summary/triples/embedding) — safe with MOCK_OPENAI=1

Verify
- The script logs inserted vs skipped counts
- Look for representative notes:
  - Product Goals: Knowledge Tasks MVP
  - Weekly Update: Week 1
  - Decision: Brief is Primary
  - Overlap: Brief Spec (duplicate)
- Start the app (npm run dev) and open “🧭 Knowledge Tasks”

Demo Prompts (see scripts/demo_tasks.md)
- Brief: Summarize the last two weeks of Knowledge Tasks work into a meeting brief
- Writing: Turn my notes about cloud cost optimization into a proposal draft
- Review: Review Knowledge Tasks specs for duplicate brief requirements and overlapping retrieval pipeline notes

