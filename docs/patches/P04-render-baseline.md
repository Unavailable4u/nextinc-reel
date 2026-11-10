### PATCH 04 - Light rig, shadow catcher, depth of field, probe, benchmark

**Needs:** 03
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/plate.ts`, `src/config/plateMatch.json`, `src/config/placementZones.json`, `src/plate/Plate.tsx`, `src/ReelFilm.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/03-realism-bible.md` sections 1, 2, 4, 7, 8, `docs/guide/02-architecture.md` (Budgets, Colour pipeline)

```
PATCH 04 - Light rig, shadow catcher, depth of field, probe, benchmark.

GOAL: motivated lights, contact and cast shadows, an in-scene depth of field that defocuses the plate by the magnification table, a plate-derived environment probe, and a benchmark that tells you how long the render will take.

CREATE / CHANGE:
- `src/config/lights.ts`: lamp (position from the match, colour `#F0CEA0`), rim strip (`#EBAF7B`), under-desk kicker, cool fill, with intensities and falloff as data
- `src/light/Rig.tsx` (the lights; soft shadow from the lamp), `src/plate/ShadowCatcher.tsx` (shadow-only plane at y=0 plus a faint warm reflection)
- `scripts/make-probe.mjs` (sharp): writes `public/plates/derived/probe-front.png` (blurred, about 128 x 128, strips preserved); `src/light/PlateProbe.ts` builds the cube environment per guide 03 section 7
- `src/camera/focus.ts` and the depth-of-field effect (postprocessing bokeh) with per-frame focus distance, focal length and aperture; a rule that raises minimum blur with plate magnification per `config/plate.ts`
- `scripts/bench.mjs` and `npm run bench`: renders 12 sample frames (shots S02, S05, S10, S11, S23 scenes with placeholder boxes), prints seconds per frame and the estimated full-film time and shot-by-shot table; writes `out/bench.json`
- `src/dev/DevLighting.tsx`: three placeholder books (boxes with the right sizes) in a pile, toggles per light, a false-colour exposure view, a focus slider

RULES THAT MATTER HERE:
- Tone mapping stays off; the plate material stays `toneMapped=false`.
- Defocus is in-scene, never a CSS filter.
- All shadows and noise are deterministic (fixed seeds, fixed shadow map size).

CHECK:
- Stills of the placeholder pile at M = 2.46 and 4.49: warm gradient toward the lamp, amber rim, tight contact line, soft cast shadow
- At M = 4.49 the wall and monitors are soft, the pile is sharp
- `npm run plate:verify` passes (books hidden, DOF at neutral)
- `npm run bench` prints a table; paste it into `PATCH_NOTES.md`
```

**Acceptance (what you look at to say yes):** The placeholder boxes already look lit by that lamp. The bench result tells you the render budget.
**Do not:** Model real books or add page textures.
