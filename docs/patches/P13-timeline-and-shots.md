### PATCH 13 - Master composition, shot registry, stills tool

> **Split into four patches** because one session cannot hold all of it (guide 14, section 5). Do them in this order; the prompt below stays as the whole of Patch 13 and the four files carry its parts:
> **13A** `P13A-shot-registry.md` (shot types, stubs S00-S25, the registry and its checks, the audit line) - **13B** `P13B-master-composition.md` (the film plays from the registry, the set, the overlay layer, grain and vignette) - **13C** `P13C-stills-tool.md` (`npm run stills`) - **13D** `P13D-shot-strip.md` (`DevShotStrip` and the scrub check). 13B and 13C may swap. Patch 14 needs all four.
> Assemble a part's prompt with `node tools/make-prompt.mjs 13a` (or 13b, 13c, 13d).

**Needs:** 05, 12
**Parallel-safe with:** none
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/ReelFilm.tsx`, `src/scene/Pile.tsx`, `src/scene/Riser.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (Master shot list), `docs/guide/02-architecture.md` (Architecture rules)

```
PATCH 13 - Master composition, shot registry, stills tool.

GOAL: the master composition that plays the whole scene from shot files, with empty-but-correct shot stubs S00-S25 and the stills tool.

CREATE / CHANGE:
- `src/shots/types.ts`: `Shot { id, from, to, camera: CameraKeyframe[], overlay?: React.FC, cues: SfxCue[] }`; `src/shots/index.ts` registry from `SHOTS`; stub files `S00.tsx` ... `S25.tsx` each exporting the shot with its frame range and an empty keyframe list
- `ReelFilm.tsx`: plate + pillarbox + scene inside `ThreeCanvas`, camera rig driven by the active shot, overlays layer, global grain/vignette layers (placeholders)
- `scripts/make-stills.mjs` and `npm run stills`: `--frames 0,600,...`, `--shot Sxx`, `--every N`, `--golden` (the ten golden frames of guide 11)
- `src/dev/DevShotStrip.tsx`: a strip of one frame per shot start

RULES THAT MATTER HERE:
- A shot file only provides camera, poses/rig references, overlay and cues.
- The film is still 5400 frames; every shot boundary equals the storyboard table.

CHECK:
- `npm run motion` reports the shot table valid
- `npm run stills -- --every 120` renders a contact sheet of the (mostly empty) film
- Scrub the Studio: the active shot id is correct at every boundary
```

**Acceptance (what you look at to say yes):** You can scrub the whole film and the right shot is active everywhere.
**Do not:** Author any shot content.
