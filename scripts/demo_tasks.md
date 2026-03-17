# Knowledge Tasks — Demo Prompts

This repo includes a small, intentional seed dataset for a mini "AI knowledge assistant" feature-planning project. Use these prompts to demo the three task modes.

## 1) Brief (Primary)
- Prompt:
  Summarize the last two weeks of Knowledge Tasks work into a meeting brief
- Expected Value:
  Concise brief with:
  - Key Updates (e.g., tool layer, UI shipped)
  - Risks / Blockers (e.g., OpenAI quota, back-compat)
  - Next Steps (e.g., seed notes, provenance)
- Supported By Seed Categories:
  - weekly, blocker, decision, goal

## 2) Writing (Secondary)
- Prompt:
  Turn my notes about cloud cost optimization into a proposal draft
- Expected Value:
  - Optional Title
  - Outline
  - Draft body (short, readable markdown)
- Supported By Seed Categories:
  - design (writing cue), goal

## 3) Review (Supporting)
- Prompt:
  Review Knowledge Tasks specs for duplicate brief requirements and overlapping retrieval pipeline notes
- Expected Value:
  - Potential Duplicates: surface paraphrases of brief spec
  - Overlapping Notes: retrieval pipeline paraphrases with overlap %
  - Merge Suggestions: combine/clean suggestions
- Supported By Seed Categories:
  - review-target (duplicate/overlap), design (original specs)

## Notes
- Use `npm run seed:notes` to load the dataset (safe to re-run; duplicates skipped by content).
- For offline demos, set `MOCK_OPENAI=1` to avoid network.
- The runner is fixed-flow and deterministic: keyword → optional semantic expansion (multi-seed) → dedupe → context → mode-specific prompt.

