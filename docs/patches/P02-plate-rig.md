### PATCH 02 - The plate rig, pillarbox and integrity test

**Needs:** 00
**Parallel-safe with:** 01
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/lib/ease.ts`, `package.json`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/02-architecture.md` (The plate rig, Magnification budget, Plate integrity test, Colour pipeline), `docs/reference/desk-plate-analysis.md`
**Before you start (you do this, not the assistant):** decide D-05 (use the original as is, or supply a bigger version of the same image). Never edit the original.

```
PATCH 02 - The plate rig, pillarbox and integrity test.

GOAL: the photograph appears in the 3D scene exactly as supplied, pillarboxed into its own edges, with plate-follow scaling and a provable integrity test.

CREATE / CHANGE:
- `src/config/plate.ts`: `PLATE_W=736`, `PLATE_H=672`, `EDGE_MARGIN=40`, the magnification table as data (thresholds 2.6 and 5, minimum blur radii), helper `plateMagnification(onScreenWidth)`
- `src/plate/Plate.tsx`: textured plane inside `<ThreeCanvas>`, unlit basic material, `toneMapped=false`, sRGB, mipmaps, anisotropy, loaded with `delayRender`; `src/plate/Pillarbox.tsx`: black bars joined with a 60 photo-px feather (parameters from `docs/reference/desk-plate-analysis.md`); `src/plate/PlateFollow.ts`: `plateTransform(cameraPose, match)` for scale + shift (first version uses placeholder match values; Patch 03 replaces them)
- `ReelFilm.tsx` shows the plate inside a `ThreeCanvas` with renderer settings: `NoToneMapping`, sRGB output
- `scripts/verify-plate.mjs` and `npm run plate:verify`: (1) SHA-256 of `public/plates/original/desk-plate.jpg` equals `docs/reference/.plate.sha256`; (2) renders frame 0 through the film with books hidden (use Remotion `renderStill`), crops the plate area, resizes the original to match, computes SSIM and max per-pixel difference in the lamp and LED regions; exits 1 unless SSIM >= 0.98 and max difference <= 3 levels
- `src/dev/DevPlate.tsx`: sliders for magnification and offset with a read-out of `M` and a colour band: green up to 2.6, amber 2.6-5, red above 5 (until defocus exists)

RULES THAT MATTER HERE:
- Plate rule: no filtering, no tone mapping, no colour change.
- No CSS blur anywhere; defocus will be done in-scene in Patch 04.
- Frame 0 must be the photo with only the pillarbox around it.

CHECK:
- `npm run plate:verify` passes (checksum and SSIM)
- In `DevPlate`, at M=1.607 the bars are invisible at normal viewing; at M=2.609 there are no bars
- `npx tsc --noEmit`
```

**Acceptance (what you look at to say yes):** Frame 0 looks like your photo, nothing else. Gate G0.
**Do not:** Add books, lights, depth of field or camera moves.
