### PATCH 10 - Sheets, bending, translucency, riffle

**Needs:** 06, 07
**Parallel-safe with:** 08, 09
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/book/Book.tsx`, `src/book/PageBlock.tsx`, `src/book/materials.ts`, `src/lib/spring.ts`, `src/lib/prng.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/06-page-turn-physics.md` (all)

```
PATCH 10 - Sheets, bending, translucency, riffle.

GOAL: a paper sheet that turns like real paper, as a closed-form function, with translucency, shadows, flutter and a riffle sequencer.

CREATE / CHANGE:
- `src/book/Sheet.tsx`: mesh about 24 x 36 segments; bending function per guide 06 section 2 (inextensible polyline integration, lag, corner lift, flutter); choose skinned mesh or vertex shader and write the reason in the notes
- translucency term from the back light, ghost of the other side at 8%, gutter shading, blob-shadow decal that follows the sheet; real depth 0.012 cm and 0.004 cm offsets with polygon offset
- `src/book/rig/turn.ts`: `turnProgress(frame, start, durationFrames, ease)`; `src/book/rig/riffle.ts`: `riffleSheets(frame, params)` for 10-14 sheets with start offsets 6 -> 10 frames
- `PageBlock` heights follow the number of turned sheets
- `src/dev/DevPageTurn.tsx`: a scrubber, mesh and hinge toggles, a length-preservation read-out (polyline length at five values of progress), test textures (a checker and a page of text)

RULES THAT MATTER HERE:
- No live physics engine; all closed-form and seeded.
- The sheet never stretches (within 0.5%).
- The lag must be visible: the outer edge arrives late.

CHECK:
- Length-preservation read-out within 0.5% at p = 0, 0.25, 0.5, 0.75, 1
- A turn passes guide 06 section 6 acceptance; take a 12-frame strip of stills (every 4 frames) and look at it
- `npm run bench` on a riffle frame is under 4 s
```

**Acceptance (what you look at to say yes):** A slow-motion turn looks like paper: curl, lag, glow when vertical, two or three small wiggles on landing.
**Do not:** Wire the sheets to the shots.
