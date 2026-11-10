### PATCH 14 - Shots S00-S04: plate, approach, pile, lift

**Needs:** 13
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`, `src/scene/Pile.tsx`, `src/scene/Dust.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (the acts for these shots), `docs/guide/05-camera-and-motion.md` section 4 (rows S00-S04), `docs/guide/03-realism-bible.md` section 4

```
PATCH 14 - Shots S00-S04: plate, approach, pile, lift.

GOAL: the opening: the photo, the walk to the desk, the focus pull onto the pile, and the lift into regime R3.

CREATE / CHANGE:
- `src/shots/S00.tsx` ... `S04.tsx`: keyframes from guide 05 section 4; there is no pillarbox (the plate fills the frame); the sharp budget ends at M = 2.6, which S01 no longer reaches; dust visible from frame 0; walk bob fading 440-480; focus pull to the pile; pile hold with 1.5 cm drift and 3% push; the press-lift-rotate of MiniMe; the R2-to-R3 handover hidden behind the book
- sound cues listed in `src/shots/*.cues` for later wiring (frame, name)

RULES THAT MATTER HERE:
- Frame 0 is the original photo (plus grain, vignette, dust only).
- The plate magnification budget holds at every frame (`npm run motion` DEEP).
- Handover pop under 2%.

CHECK:
- `npm run motion` for frames 0-1079 clean
- Contact sheet every 30 frames of S00-S04
- Frame-by-frame look at 940-1080 (the handover)
```

**Acceptance (what you look at to say yes):** A viewer sees a photograph, walks to the desk, finds three books and one is lifted; nothing pops.
**Do not:** Cover painting changes or later shots.
