### PATCH 23 - QA: audits, rubric, fixes

**Needs:** 20, 21, 22
**Parallel-safe with:** none
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/data/select.ts`, `src/shots/index.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/13-qa-and-acceptance.md` (all), `docs/guide/07-content-and-assets.md`

```
PATCH 23 - QA: audits, rubric, fixes.

GOAL: prove the film is true, legible, scannable and consistent before rendering.

CREATE / CHANGE:
- `scripts/audit-truth.mjs` and `npm run audit`: every string drawn by a painter or label is recorded with its source path (the painters log them in a debug mode); fails on any string not traceable to the snapshot or `content/books.md` wording; fails on `minime.app`, "lorem", "TODO"
- golden stills in `docs/reference/golden/` (ten frames) and `--golden` comparison (SSIM)
- a frame-time audit of S05, S10, S11, S23 from `npm run bench`
- a fix list: every issue found, fixed or recorded

RULES THAT MATTER HERE:
- No fix outside the issue list.

CHECK:
- `npm run audit` passes
- The release checklist items for content and legibility are ticked
- Choose the poster frame by viewing the three candidates at thumbnail size
```

**Acceptance (what you look at to say yes):** A clean audit and a short signed-off issue list.
**Do not:** Add features.
