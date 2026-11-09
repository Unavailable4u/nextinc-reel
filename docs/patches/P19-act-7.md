### PATCH 19 - Shots S22-S23: truck right, chair wipe, riser reveal, labels

**Needs:** 18
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`, `src/scene/Riser.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (the acts for these shots), `docs/guide/05-camera-and-motion.md` section 4 (rows S22-S23), `docs/guide/03-realism-bible.md` section 4, `docs/guide/04-book-design.md` section 7

```
PATCH 19 - Shots S22-S23: truck right, chair wipe, riser reveal, labels.

GOAL: the travel to the right, the chair as an occluder hiding the set swap, and the labelled riser.

CREATE / CHANGE:
- `S22.tsx` (pull back to M = 3.4, truck right about +330 photo px, the chair covers the whole frame during 4140-4199 while the ledger swaps; margin 40 px respected)
- `S23.tsx` and `src/fx/Labels.tsx`: hairline leader, 5 px dot, name in CMU Serif Italic 26 px, mono sub-line 18 px (`year - status`), one label per beat from frame 4380, a soft highlight sweep per book; all text from `getRiserLabel`

RULES THAT MATTER HERE:
- No frame shows the swap.
- Labels never cover the book they mark.
- Beat-aligned events only.

CHECK:
- `npm run motion` 3960-4799 clean (watch EDGE)
- Stills every 10 frames from 4120 to 4220 prove the occluder covers the frame
- Label text equals the snapshot
```

**Acceptance (what you look at to say yes):** The chair wipe is invisible; four labelled books stand on the riser.
**Do not:** The ending.
