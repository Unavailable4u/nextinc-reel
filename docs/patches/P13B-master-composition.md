### PATCH 13B - Master composition: the film plays from the registry

**Needs:** 13A
**Parallel-safe with:** 13C
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/shots/index.ts`, `src/shots/types.ts`, `src/ReelFilm.tsx`, `src/stage.tsx`, `src/camera/CameraRig.tsx`, `src/camera/path.ts`, `src/scene/Pile.tsx`, `src/scene/Riser.tsx`, `src/scene/Dust.tsx`, `src/light/Rig.tsx`, `src/dev/DevPile.tsx`, `scripts/verify-plate.mjs`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/02-architecture.md` (Determinism, Architecture rules)

```
PATCH 13B - Master composition: the film plays from the registry.

GOAL: `ReelFilm` plays the whole film from the shot registry: the camera is the one the shots provide, the set (lights, shadow catcher, pile, riser, dust) is in the scene, the active shot's overlay is drawn above the scene, and the global grain and vignette exist as named, switchable layers.

CREATE / CHANGE:
- `src/ReelFilm.tsx`: the camera rig gets `keys={FILM_CAMERA_KEYFRAMES}`; inside the `Stage` the shadow catcher, `LightRig`, `Pile`, `Riser` and `Dust`, composed as `DevPile` does; above the canvas an overlay layer that renders `activeShot(frame).overlay` when the shot has one; then `Grain` and `Vignette`; then the readout. New props, all default true: `scene` (lights, set and dust), `grain`, `vignette`. `ReelFilm` never names a shot: it asks the registry
- `src/fx/Grain.tsx`, `src/fx/Vignette.tsx`: placeholder layers. The grain is a pure function of the frame number and a seed from `src/lib/prng.ts`; the vignette is a soft radial darkening. Both are faint, are tuned in Patch 22, and draw nothing when switched off
- `src/camera/path.ts`: the default `keys` of `cameraAt` become `FILM_CAMERA_KEYFRAMES`, so the dev sheets show the camera of the film (`CAMERA_KEYFRAMES` stays in `config/camera.ts` for the tests; S00-S03 give the same keys, so `tests/camera.test.ts` passes unchanged)
- `scripts/verify-plate.mjs`: renders frame 0 with `scene`, `grain` and `vignette` off (and `hud` off), so the comparison is still of the bare photo
- `docs/PATCH_NOTES.md`, `docs/DECISIONS.md`, `docs/patches/INDEX.md`

RULES THAT MATTER HERE:
- Frame 0 of the film is the original photo plus grain, vignette and dust only; `npm run plate:verify` passes (gate G0).
- Determinism: nothing reads a clock or `useFrame`; every layer is a pure function of the frame.
- A shot file only provides camera, poses, overlay and cues: `ReelFilm` does not change when a shot is filled in.

CHECK:
- `npx tsc --noEmit` and `npm test`
- `npm run plate:verify` passes
- `npm run motion` is unchanged
- Studio: scrub 0-5399. The camera moves as it did in Patch 05 (S00-S03), then holds; the pile is on the desk; no frame is black or blank
- Switch `grain`, `vignette` and `scene` off in the Studio props: each layer disappears and nothing else changes
```

**Acceptance (what you look at to say yes):** The Studio plays the whole film without an error; the opening is the photo, the walk and the pile as before, and the three layer switches work.
**Do not:** Author any shot content, write the stills tool, or build the shot strip.
