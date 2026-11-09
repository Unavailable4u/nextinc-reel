### PATCH 17 - Shots S14-S15: close and set down

**Needs:** 16
**Parallel-safe with:** none
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (the acts for these shots), `docs/guide/05-camera-and-motion.md` section 4 (rows S14-S15), `docs/guide/03-realism-bible.md` section 4

```
PATCH 17 - Shots S14-S15: close and set down.

GOAL: the book closes, is set down beside the pile with weight, and the camera returns to the pile.

CREATE / CHANGE:
- `S14.tsx`, `S15.tsx`: pages flip back, the board closes with a six-frame air puff, the back cover glimpse; set-down with the contact shadow tightening and the settle; R3 back to R2 (M from 9 to 6.4); the ledger puts MiniMe "beside"

RULES THAT MATTER HERE:
- The set-down contacts the desk on a beat (frame 2940) and its sound cue starts two frames earlier.
- The plate comes back without a pop.

CHECK:
- `npm run motion` 2760-2999 clean
- Stills every 20 frames of S15
```

**Acceptance (what you look at to say yes):** The book lands softly and the pile now shows MiniLocker on top.
**Do not:** Start book 2.
