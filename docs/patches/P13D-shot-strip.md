### PATCH 13D - Shot strip and the scrub check

**Needs:** 13A, 13B, 13C
**Parallel-safe with:** none
**Size:** S
**Paste existing:** `docs/PATCH_NOTES.md`, `src/Root.tsx`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/dev/DevPile.tsx`, `src/dev/DevBookMotion.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/02-architecture.md` (Dev compositions)

```
PATCH 13D - Shot strip and the scrub check.

GOAL: a dev composition that shows one frame per shot start in a strip, and the check that the right shot is active at every boundary. This closes Patch 13.

CREATE / CHANGE:
- `src/dev/DevShotStrip.tsx`: a still with a strip of 26 cells, one per shot, each showing the film at that shot's first frame (a scaled-down copy of the film, drawn the way the film is: through `ReelFilm` or the same stage and set), labelled with the shot id and its first frame; props (zod schema, like the other dev sheets): the cell frame offset within the shot (default 0), `hud`, and the columns
- `src/Root.tsx`: register `DevShotStrip` after the film and the other dev sheets, so `ReelFilm` stays the default
- `docs/PATCH_NOTES.md`: close Patch 13 (one entry for 13D listing what 13A-13D added together), `docs/patches/INDEX.md`: mark 13 done

RULES THAT MATTER HERE:
- Registered after `ReelFilm`; no new dependency; one WebGL canvas per cell is too heavy, so draw the cells from stills of the film or from one canvas, and say in the notes which and why.
- Every cell is a pure function of its frame.

CHECK:
- `npx tsc --noEmit`, `npm test`, `npm run motion`, `npm run plate:verify`
- Studio, `DevShotStrip`: 26 labelled cells, S00 to S25, the first frame of each shot
- Studio, `ReelFilm`: scrub across every shot boundary (239/240, 479/480, ..., 5279/5280) and read the shot id in the readout: it is right on both sides of every boundary
- `npm run stills -- --every 120` still renders the contact sheet
```

**Acceptance (what you look at to say yes):** You can scrub the whole film and the right shot is active everywhere, and the strip shows all 26 shots in order.
**Do not:** Author any shot content.
