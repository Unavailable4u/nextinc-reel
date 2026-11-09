### PATCH 05 - Camera rig, operator model, audits

**Needs:** 04
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/lib/ease.ts`, `src/lib/spring.ts`, `src/lib/noise.ts`, `src/camera/focus.ts`, `src/plate/PlateFollow.ts`, `src/config/plate.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/05-camera-and-motion.md` (all)

```
PATCH 05 - Camera rig, operator model, audits.

GOAL: authored camera keyframes with an operator model on top, focus and aperture keyframes, and an audit that catches camera mistakes.

CREATE / CHANGE:
- `src/config/camera.ts`: types `CameraKeyframe { frame, M, panX, panY, tiltDeg, rollDeg, focusCm, aperture, focalMm, ease, regime }`; the helper `holdShot()` (ease in, then a 3-5% linear push); a placeholder keyframe array for S00-S03 taken from guide 05 section 4
- `src/camera/CameraRig.tsx` (applies keyframes + operator model to the 3D camera and the plate), `src/camera/operator.ts` (the layers table in guide 05 section 3, seeded)
- `tools/audit-motion.mjs` and `npm run motion`: reports STILL, FAST, DEEP, EDGE, POP, LATE with frame numbers and a summary; also checks that SHOTS sum to 5400
- `scripts/make-sheets.mjs`: contact sheets from stills (`--from A --to B --every N`)
- `src/dev/DevCamera.tsx`: shows the camera path numerically (M, pan, focus) for a frame range

RULES THAT MATTER HERE:
- No camera move shorter than 48 frames; 20 frames between moves; all authored events on multiples of 30.
- The camera window never leaves the plate margin.
- All noise seeded.

CHECK:
- `npm run motion` on S00-S03 prints a summary with zero FAST/EDGE
- Deliberately break a keyframe (a 20-frame move): the audit reports it
- Render stills every 30 frames of S00-S03 and view the contact sheet
```

**Acceptance (what you look at to say yes):** S00-S03 camera plays smoothly in the Studio with the walking bob fading at arrival.
**Do not:** Build any book.
