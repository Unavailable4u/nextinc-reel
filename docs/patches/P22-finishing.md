### PATCH 22 - Finishing layers and motion blur decision

**Needs:** 20
**Parallel-safe with:** 21
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/ReelFilm.tsx`, `src/plate/Plate.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/03-realism-bible.md` section 8, `docs/guide/09-render-and-delivery.md` section 1

```
PATCH 22 - Finishing layers and motion blur decision.

GOAL: bloom, halation, chromatic aberration, vignette, re-seeded grain, grade, soft clip as switchable layers; decide D-15.

CREATE / CHANGE:
- `src/fx/Grain.tsx` (re-seeded every frame), `Vignette.tsx`, `Bloom`/`Halation`/`CA` config, `Grade.tsx` (match the books' black point to the plate's), soft clip; each layer has an on/off flag in `config/finishing.ts`
- motion-blur test on S10 and S04: option 2 (Remotion helper with the 3D canvas) and option 3 (240 fps supersample + `tmix`); record the result and set D-15; `scripts/render-supersample.mjs` if option 3 wins

RULES THAT MATTER HERE:
- Finishing layers come after the plate integrity frame; with them off the plate still passes the integrity test.
- No fixed-pattern grain.

CHECK:
- `npm run plate:verify` with finishing off passes; with it on, differences are only grain/vignette
- Side-by-side stills before and after finishing
```

**Acceptance (what you look at to say yes):** The books and photo feel like one image; D-15 decided and logged.
**Do not:** Re-light the scene.
