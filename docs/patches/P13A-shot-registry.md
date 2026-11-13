### PATCH 13A - Shot registry: shot types, stubs S00-S25, checks

**Needs:** 05, 12
**Parallel-safe with:** none
**Size:** S
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `tools/audit-motion.mjs`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (Master shot list), `docs/guide/02-architecture.md` (Architecture rules)

```
PATCH 13A - Shot registry: shot types, stubs S00-S25, checks.

GOAL: every shot is a file with its frame range, its camera keyframes and its cues, the registry puts them together and checks them against the shot table, and `npm run motion` says so. Nothing is drawn yet.

CREATE / CHANGE:
- `src/shots/types.ts`: `SfxCue { frame, name }` and `Shot { id, from, to, camera: readonly CameraKeyframe[], overlay?: FC, cues: readonly SfxCue[] }`
- `src/shots/define.ts`: `defineShot(id, { camera?, overlay?, cues? })` takes the frame range from the SHOTS table (a shot file never types a frame range); `checkShot`, `checkShots`, `tableRow`; every error names the shot and the number
- `src/shots/S00.tsx` ... `S25.tsx`: each exports its shot. S00-S03 provide the keyframes that already exist (`SHOT_KEYFRAMES` in `src/config/camera.ts`); S04-S25 are empty
- `src/shots/index.ts`: `SHOT_REGISTRY`, `shotById`, `activeShot(frame)`, `FILM_CAMERA_KEYFRAMES`, `FILM_CUES`; the registry checks itself when it loads
- `src/config/camera.ts`: `SHOT_KEYFRAMES` (S00-S03, one array per shot); `CAMERA_KEYFRAMES` is built from it and does not change
- `tools/audit-motion.mjs`: audits `FILM_CAMERA_KEYFRAMES` and prints the registry line; an invalid registry exits 1
- `tests/shots.test.ts`: the registry against the table and against the storyboard's own table, the active shot at every boundary, every error case
- `docs/PATCH_NOTES.md`, `docs/DECISIONS.md`, `docs/patches/INDEX.md`, this file and 13B-13D

RULES THAT MATTER HERE:
- A shot file only provides camera, poses or rig references, overlay and cues.
- The film is still 5400 frames; every shot boundary equals the storyboard table.
- The camera of the film does not change: S00-S03 give back the same 13 keyframes.

CHECK:
- `npx tsc --noEmit` and `npm test` (shots tests pass; nothing else changes)
- `npm run motion`: the same findings as before and `shot registry: VALID, 26 shot files`
- Break a shot file on purpose (a keyframe outside its shot): `npm run motion` exits 1 and names the shot
```

**Acceptance (what you look at to say yes):** `npm run motion` prints the registry as valid and its other lines are the ones it printed before this patch.
**Do not:** Draw anything, change the camera, or fill in any shot.
