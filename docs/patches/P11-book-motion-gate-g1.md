### PATCH 11 - Book motion rigs and Gate G1

**Needs:** 06, 07, 09, 10
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/book/Book.tsx`, `src/book/Sheet.tsx`, `src/book/rig/turn.ts`, `src/lib/spring.ts`, `src/lib/noise.ts`, `src/config/books.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/03-realism-bible.md` sections 5, 9, 10, `docs/guide/05-camera-and-motion.md` section 5, `docs/guide/01-storyboard.md` Act 2-5

```
PATCH 11 - Book motion rigs and Gate G1.

GOAL: analytic rigs for opening, closing, lifting and setting down a book, with weight and sway, and a still-image review of realism.

CREATE / CHANGE:
- `src/book/rig/cover.ts`: cover open/close (spring `cover`, ratio 0.6, about 3 degree overshoot, 30 frames of settle)
- `src/book/rig/lift.ts`: press (6 f, 1 mm), rise, rotate to reading pose with weight-dependent spring and sway (two noise layers, guide 03 section 5); `setDown.ts` with a 4-6 frame settle; `hold.ts` reading pose
- `src/config/ledger.ts` skeleton and `getBookPose(bookId, frame)` returning pose from rig functions (locations come in Patch 12)
- `src/dev/DevBookMotion.tsx`: a timeline scrubber for one book through lift, cover open, two turns, close, set down
- **Gate G1:** render the ten stills listed in the acceptance, score each with the Reality Rubric (guide 03 section 10) and record the scores in `PATCH_NOTES.md`

RULES THAT MATTER HERE:
- No instant starts or stops; nothing shorter than 6 frames.
- Heavier books move slower with less sway (weights in `books.ts`).

CHECK:
- The ten G1 stills: pile; lifted mid-rise; cover hero; cover opening; open spread; page mid-turn; riffle; gallery spread; QR spread; set down
- Average rubric score at least 4.0, none below 3
- If it fails twice: read guide 15
```

**Acceptance (what you look at to say yes):** Gate G1 passed with written scores.
**Do not:** Build shots.
