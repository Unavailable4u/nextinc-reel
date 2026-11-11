# Patch notes (the handoff log)

Every patch appends an entry here. Format:

```
## Patch NN - Title  (date)
Files created / changed:
PUBLIC API (exports, signatures, props with types):
Decisions and conventions later patches must follow:
Known issues:
Warnings for the next patch:
Checks run and results (paste the summary of `npm run motion` where relevant):
```

Versions pinned in Patch 00: Node >=20 (built and tested on 22.23; `.nvmrc` not used), Remotion 4.0.540 (same as `minilocker-film`; `@remotion/cli`, `bundler`, `renderer`, `three`, `zod-types` all 4.0.540), React 18.3.1, react-dom 18.3.1, three 0.170.0 (+ @types/three 0.170.0), @react-three/fiber 8.17.14 (the v8 line, which supports React 18), @react-three/drei 9.122.0, @react-three/postprocessing 2.19.1, postprocessing 6.39.6, sharp 0.35.5, zod 3.22.3 (what Remotion's schema props need), esbuild 0.25.12 (dev: tests and tools), TypeScript 5.9.3, ffmpeg 6.1.1 (the build machine's; yours may differ, nothing uses ffmpeg before Patch 24). `npm install` resolves with no peer-dependency conflicts; npm prints one deprecation notice for `three-mesh-bvh@0.7.8`, which comes from drei 9 and is harmless.

---

## Patch 00 - Scaffold, config, core math, prompt tool  (2026-11-09)

**Files created / changed:**
`package.json` (exact pins, scripts), `tsconfig.json` (strict), `remotion.config.ts` (OpenGL `angle`), `.vscode/extensions.json`, `src/index.ts`, `src/Root.tsx`, `src/ReelFilm.tsx`, `src/config/timeline.ts`, `src/lib/{ease,spring,prng,noise,units,hash,fonts}.ts`, `tools/make-prompt.mjs`, `tools/run-tests.mjs`, `tools/print-timeline.mjs`, `scripts/stub.mjs`, `scripts/lib/env.mjs`, `tests/harness.ts`, `tests/core.test.ts`.

**PUBLIC API:**
- `config/timeline.ts` (no imports, readable by plain `node`): `FPS=60`, `BEAT=30`, `BAR=120`, `TOTAL=5400`, `WIDTH=1920`, `HEIGHT=1080`; `sec(s)`, `beat(n)`, `bar(n)`, `f(n)`; `type Regime`; `interface Shot { id, name, from, to, regime }` (`to` inclusive); `SHOTS: readonly Shot[]` (S00..S25, copied from guide 01); `checkTimeline(shots?, total?)` (runs at import: throws unless contiguous, in order, whole bars, summing to 5400); `shotAt(frame): Shot`; `clockAt(frame): { beat, bar, beatInBar, frameInBeat }` (0-based); `timecode(frame): "m:ss.ss"`; `CUT_FRAMES: number[]`.
- `lib/ease.ts`: `cubicBezier(x1,y1,x2,y2)`, `signature`, `arrive`, `lift`, `linear`, `clamp`, `clamp01`, `lerp`, `progress(frame, from, to)`, `remap(v, inA, inB, outA, outB, ease?)`, `EASES`, `type EaseName`.
- `lib/spring.ts` (closed form, no loop): `interface SpringSpec { zeta, hz }`, `SPRINGS.{cover, settle, bookSway}`, `springAt(tSeconds, spec, from=0, to=1, v0=0)`, `springFrames(frame, startFrame, spec, fps, from, to, v0)`, `settleTime(spec, tol)`.
- `lib/prng.ts`: `prng(seed): () => number` (mulberry32), `range`, `int`, `gauss`. `lib/noise.ts`: `makeNoise(seed): { n1, n2, fbm1 }` in [-1, 1]. `lib/hash.ts`: `fnv1a`, `hashString`, `stableStringify`, `hashObject`. `lib/units.ts`: `CM`, `MM`, `INCH`, `deg`, `toDeg`, `mm`, `inch`, `BOOK_TRIM {w:15.2, h:22.9}`.
- `lib/fonts.ts`: `loadFonts(): Promise<void>` (FontFace + `delayRender`; a missing font logs a warning instead of hanging a render), `FONT_FACES`, `stacks.{serif, mono}`, `FAMILY_SERIF`, `FAMILY_MONO`.
- `tools/make-prompt.mjs`: `node tools/make-prompt.mjs <n> [--repo-site <path>] [--repo-film <path>]` writes `prompts-out/patch-NN.md`; `--all` checks that all 27 patch files assemble. Understands the header shorthand in your patch files ("sections 4-6", "Act 2-5", "(Master shot list)", bare file names after a path, globs like `src/book/rig/*.ts`); lists missing files; binary reference files (PNG) are not pasted as text, the tool tells you to attach them.
- Scripts: `studio`, `typecheck`, `test`, `timeline`, `prompt`; stubs that print "created by Patch NN": `bench`, `motion`, `stills`, `qr:check`, `audit`, `render`.

**Decisions and conventions later patches must follow:**
- Added `src/lib/fonts.ts` (the guide's architecture lists it, and Patch 08 pastes it as "existing", but no patch created it). Patch 08's `paint/typography.ts` can import `loadFonts`/`stacks` from it instead of writing a second loader.
- `timeline.ts` stays import-free so `node -e "import('./src/config/timeline.ts')..."` works on Node 22+; on Node 20 use `npm run timeline`.
- Test harness: `npm test` bundles `tests/*.test.ts` with esbuild and runs them under Node (no framework). Put pure-logic tests there; visual checks stay stills.
- All `.mjs` scripts share `scripts/lib/env.mjs` (arguments, bundle, `renderPng`, browser options). Unknown flags exit 2. `REMOTION_BROWSER_EXECUTABLE` and `REMOTION_GL` select the browser and the WebGL backend (`angle` default; `swangle` = software).
- `Composition` props use `type` aliases (not `interface`), because Remotion requires `Record<string, unknown>`.

**Known issues:** none in this patch's scope.

**Warnings for the next patch:** the shot table's regimes for S15, S21, S22 are copied as written (`R2`, `R3/2`, `R2/4`).

**Checks run and results** (build machine: Linux, Node 22.23, software WebGL, not your Windows/GPU machine; the Studio window itself was not opened, `remotion compositions` was used instead):
`npx tsc --noEmit` 0 errors. `npm test` 36/36. `npm run timeline` prints 5400 frames, 26 shots. `node -e` import prints `TOTAL 5400 | 26 shots`. `npx remotion compositions` lists `ReelFilm 60 fps 1920x1080 5400 frames (90.00 sec)` first, `DevPlate` second. Readout rendered at frames 0, 239, 240, 1080, 2760, 3960, 5399: S00, S00, S01, S05, S14, S22, S25 as expected. `node tools/make-prompt.mjs --all`: all 27 assemble, every guide section resolved.

---

## Patch 01 - Site data sync and typed selectors  (2026-11-09)

**Files created / changed:**
`scripts/sync-site.mjs`, `scripts/test-select.mjs`, `src/data/types.ts`, `src/data/select.ts`, `src/data/site-snapshot.json` (generated, commit it), `src/config/bookText.ts`, `tests/select.test.ts`; media copied by `--copy-media` into `public/site/` and `public/fonts/`.

**PUBLIC API:**
- `npm run sync [-- --site=PATH] [--check] [--copy-media]`. `SITE_REPO` defaults to `../nextinc`. The four data files run in a `vm` sandbox with a stub `window` (no `require`, no network). `--check` exits 1 and says what changed (`project "minilocker" changed: title`). Hashes use LF-normalised text, so Windows line endings do not matter.
- `src/data/site-snapshot.json`: `{ meta { tool, siteRepo, commit, dirty, syncedAt, files{path:sha256}, media{path:sha256} }, site, projects[], films[], team[], affiliation }`. `meta.dirty` is true when the website's `assets/data` had uncommitted changes.
- `src/data/select.ts`: `makeSelectors(snapshot)` and, bound to the committed snapshot: `getCompany(): Company { name, url, address, tagline, affiliation }`, `getAuthors(): { name }[]`, `getBooks(): Book[]` (site order, `volume` 1-4, `volumeNumeral`), `getBook(slug)`, `getFilmsFor(slug): Film[]` (can be empty), `getQrTargets(slug): QrTarget[]` (exactly two), `getColophon(slug)`, `getRiserLabel(slug)`, `getAbstractText(slug, maxWords=55)`; helpers `cutAtSentence(text, maxWords)`, `splitSentences`, `lastSentence`, `siteMedia(websiteRelPath)` (`assets/img/x.webp` -> `site/img/x.webp`), `class MissingDataError { path }`, `SNAPSHOT_META`. Errors read `missing data: projects.minilocker.films[0].duration`.
- `src/config/bookText.ts`: `BOOK_TEXT[slug] { title: TitlePart[], spine, coverLine?, backLine?, colophonLimit, screenshots: { file, caption, draft }[] }`.

**Decisions and conventions later patches must follow:**
- **QR rule** (reproduces the table in guide 07 exactly): QR 1 = live, else repo, else case study; QR 2 = the next of repo, film, case study. Mini Me = case study + film; SPHEREx and Immersive = live + repo; MiniLocker = repo + film.
- Optional fields (`brief`, `approach`, `outcome`, `links`, `gallery`) are really absent for some projects in your data (Mini Me has none of them). They are optional in the types; callers must handle absence, never fill it in.
- Riser labels use the **data's title** (`Mini Me`, `SPHEREx Blink Comparator`), as `content/books.md` says. Guide 04 section 7 and guide 01 S23 show shorter or brand spellings (`MiniMe`, `SPHEREx`). Pick one when you build Patch 19 and change `content/books.md` or the guides to match.
- **Fonts are copied to `public/fonts/`** (where Patch 08 expects them) and images to `public/site/`. Patch 01's text said everything goes to `public/site/`; the two patches disagreed.
- `--copy-media` also copies `scripts/brand/glyph-x.json` and `assets/img/icons/icon.svg` to `public/site/brand/` and `public/site/img/icons/` (needed by Patch 10's wordmark, S24). Small addition beyond the spec.
- **Not copied on purpose (D-17):** Mini Me's `cover.webp` AND its film poster `films/mini-me-chat-film.webp`. See the warning below.

**Known issues:** the editorial lines `Describe a task. Get a team.` (Mini Me) and `A showcase build of our website. Not our production site.` (Immersive) are not found in the data. `npm run select:test` lists them as NOTE (they are approved in `content/books.md`; keep them only while true).

**Warnings for the next patches:**
- **The Mini Me film poster shows "Try MiniMe" and `minime.app`**, the same as the cover. Guide 00 and `content/books.md` specify that poster for the film spread (S12). Using it would put the forbidden address on screen. Patch 09 should build the thumbnail from the laptop/app part of the website's copy (about x >= 590 px of the 1600 px width, which excludes the left text column) or use another real screenshot. Look at the result for any other text before approving.
- The MiniLocker film poster is its `cover.webp`, which carries a small "Vultr Agent Rush" pill. The film's own `sub` field in the data names the hackathon, so the name is in the data, but check the thumbnail against guide 07's third-party-mark rule.
- Mini Me needs your screenshots (`public/screens/mini-me/`) before Patch 09; `BOOK_TEXT["mini-me"].screenshots` is empty until you add them.

**Checks run and results:** `npm run sync` writes the snapshot (4 projects, 2 films, 3 people, website commit `dd4a90b4`). `npm run sync -- --check` exits 0; after editing a title in a copy of the website data it exits 1 and names the changed field; the real website repo was not modified. `node scripts/test-select.mjs` prints Mini Me, SPHEREx, MiniLocker, Immersive in that order with QR targets equal to guide 07's table, finds no `minime.app` anywhere. `npm test` includes tests where a deleted field throws an error naming its path. `npx tsc --noEmit` 0 errors.

---

## Patch 02 - The plate rig, pillarbox and integrity test  (2026-11-09; gate G0 passed on the build machine, run it once on yours)

**Files created / changed:**
`src/config/plate.ts`, `src/config/plateRegions.json`, `src/plate/{Plate,Pillarbox,PlateFollow}.ts(x)`, `src/stage.tsx`, `src/ReelFilm.tsx` (now shows the plate), `src/dev/DevPlate.tsx`, `src/Root.tsx` (registers `DevPlate` after the film), `scripts/verify-plate.mjs`, `tools/measure-plate.mjs`, `package.json` scripts `plate:verify`, `plate:measure`.

**PUBLIC API:**
- `config/plate.ts`: `PLATE_FILE`, `PLATE_W=736`, `PLATE_H=672`, `PLATE_SHA256`, `EDGE_MARGIN=40`, `PILLARBOX { color:"#000000", feather:60 }`, `INTEGRITY_REGIONS`, `M_FIT_HEIGHT` (1.607), `M_FIT_WIDTH` (2.609), `MAGNIFICATION` (thresholds 2.6 and 5; min blur 6 px at 2.6 rising to 25 px at 5 and above), `plateMagnification(onScreenWidth)`, `magnificationBand(M): "sharp"|"defocus"|"bokeh"`, `minBlurPx(M)`, `BAND_COLOR`.
- `plate/PlateFollow.ts`: `interface PlateView { M, cx, cy }` (photo px at the screen centre), `VIEW_FIT`, `interface PlateMatch { fovDeg, plateDistanceCm }`, `PLACEHOLDER_MATCH` (25 degrees, 600 cm; Patch 03 replaces it), `plateTransform(view, match?): { cmPerPx, width, height, position }`, `photoToScreen`, `screenToPhoto`, `plateScreenRect`, `clampView(view): { view, clamped, pillarbox }` (the 40 px margin rule of guide 05).
- `plate/Plate.tsx`: `<Plate view match? transform? />` (unlit `meshBasicMaterial`, `toneMapped={false}`, sRGB, mipmaps, anisotropy). `plate/Pillarbox.tsx`: `<Pillarbox transform feather? color? />`.
- `stage.tsx`: `<Stage view feather? match?>children</Stage>`: **the one `<ThreeCanvas>` of the film** (flat, `NoToneMapping`, sRGB output, black background). Later patches add the camera rig, lights, books and effects as children of `Stage`.
- `ReelFilm` props: `{ hud: boolean; feather: boolean; view?: PlateView }`. `DevPlate` (a `Still`) props: `{ M, cx, cy, feather, applyMargin, grid }` with sliders and the green/amber/red band.

**Decisions and conventions later patches must follow:**
- The photo plane faces a fixed scene camera at `plateDistanceCm`; one photo pixel covers exactly `M` screen pixels (a pure scale and shift). Patch 03 replaces `PLACEHOLDER_MATCH`; Patch 05 drives `PlateView` from the camera rig.
- **Pillarbox:** bars are pure black (`#000000`). The feather fades the photo's outer 60 photo px to black (smoothstep), drawn in the photo's own plane with no depth test, so alignment is exact. `EDGE_MARGIN = 40` is the camera's margin from the photo's edge (guide 05), not a feather width; the guide's text used both numbers.
- **Plate integrity** compares the render with what a perfect rendering must be (bilinear sampling in LINEAR light, which is what an sRGB texture does on the GPU), not with a resized copy, so the result does not depend on a resize filter. It runs twice: with the feather off (the bare photo, whole area) and on (outside the feathered strips, plus the strict lamp/LED regions). The right-hand regions stop at x = 670 because the outer 60 px are feathered on purpose.
- No CSS blur or filter on the plate anywhere. Defocus is Patch 04, in-scene.
- `preserveDrawingBuffer: true` is set on the canvas so stills read back reliably; Patch 04 may revisit it for speed.

**Known issues:** the plate magnified beyond 2.6 has no defocus yet (Patch 04), so `DevPlate` shows amber/red there on purpose. Gradient banding in the feather has not been seen at 8 bits (the photo carries noise) but was only checked by eye on stills.

**Warnings for the next patch (03):** a measured, tested starting point exists in `docs/reference/calibration-seed/` (read `docs/reference/measured-calibration.md` first). The key finding: the photo's depth lines converge at **y = 268**, above the image centre (336), so the match camera needs a downward pitch of about 3.1 degrees (or a vertical lens shift), vertical FOV about 29.8 degrees. The visible desk TOP is y 457-484 (not 455-492; 484-495 is the front apron face).

**Checks run and results:** `npm run plate:verify` PASSED (5 checks): SHA-256 `82aa3d3c...04b41`; bare photo SSIM 0.99993 (largest channel difference 2 levels); real frame 0 SSIM 0.99995 outside the feather, largest difference 1 level in 7 lamp/LED regions (limit 3); bars brightest pixel 0. **Negative tests:** appending one byte to the photo makes the checksum fail; enabling a film-style tone curve on the plate material drops SSIM to 0.63 and the script exits 1. A renderer-level tone curve alone does NOT change the photo (the plate material opts out), which is the intended protection. Frame 0, a `DevPlate` sheet at M=4 with the grid, and readouts were rendered and looked at. `npx tsc --noEmit` 0 errors. Not run: the Studio GUI, and anything on a GPU or on Windows (software WebGL was used).

---

## Patch 02a - New plate: 1536 x 864 (16:9), no pillarbox  (2026-11-11)

Replaces the 736 x 672 photo with a larger image. Patches 00 to 02 stay as they were; this patch changes the plate and everything measured on it.

**Files created / changed:**
`public/plates/original/desk-plate.png` (new plate, byte-identical to the supplied file), `public/plates/superseded/desk-plate-v1.jpg` (the first photo, moved with `git mv`, bytes unchanged), `docs/reference/.plate.sha256` (new checksum), `docs/reference/.plate-v1.sha256`, `.gitattributes` (superseded plates are plain blobs), `src/config/plate.ts`, `src/config/plateRegions.json`, `src/plate/PlateFollow.ts` and `src/ReelFilm.tsx` (comments), `scripts/verify-plate.mjs`, `tools/measure-plate.mjs`, `AGENTS.md` and `README.md` (the path), `docs/reference/calibration-seed/*` (re-fitted seed and a new overlay image), `tests/calibration-seed.test.ts`, `tests/plate.test.ts` (new), and the plan documents listed below.

**PUBLIC API changes:**
- `config/plate.ts`: `PLATE_FILE = "plates/original/desk-plate.png"`, `PLATE_W = 1536`, `PLATE_H = 864`, `PLATE_SHA256 = 3aa7af92...44af0`, `PILLARBOX.feather = 0`, `M_FIT_HEIGHT = M_FIT_WIDTH = 1.25`, new `DESK_M_RATIO = 629 / 869.7` (old M x this = new M for the same desk framing). `EDGE_MARGIN` (40), the `MAGNIFICATION` thresholds (2.6 and 5) and the component and function signatures are unchanged.
- `plateRegions.json`: 11 regions (the 7 old names with new boxes, plus `shelf_unit_led_a`, `shelf_unit_led_b`, `shelf_unit_lantern`, `corner_candle`) and `feather: 0`.
- `verify-plate.mjs` also checks that `config/plate.ts` names the same file and checksum; renders once when the feather is 0; and passes the bars check when the photo fills the frame.
- Calibration seed: `PLATE_REF = { w: 1536, h: 864 }`, `CALIB_SEED = { f: 1895, cx: 544.7, horizonY: 395.6, camHeightCm: 45.6, camDistCm: 508, desk: { xMin: -88.6, xMax: 144.4, depth: 65 } }`; the json key `measuredOnThePhoto` is now `measuredOnThePlate`.

**Decisions and conventions later patches must follow:**
- D-04 and D-21 are obsolete; D-05 is updated; D-24 to D-28 are new (`docs/DECISIONS.md`). D-25 (the horizon) and D-27 (rights) need your answer.
- At the opening view the plate fills the frame at M = 1.25: no bars, no feather, frame 0 is the plate untouched. The margin rule only restricts the camera from M = 1.319; below that the view is centred.
- **M conversion** (first plan x 0.7233): S00 1.607 to 1.65 becomes **1.25 to 1.28**; S01 end 3.4 becomes 2.46; S02 end 6.2 becomes 4.49; S03 end 6.4 becomes 4.63; S04 hidden handover 9 becomes 6.51; S15 9 to 6.4 becomes 6.51 to 4.63; S22 to 3.4 then 5.2 becomes 2.46 then 3.76 (truck +330 px becomes about +456 plate px); S23 5.2 to 5.5 becomes 3.76 to 3.98; S24 5.5 to 5.65 becomes 3.98 to 4.09; S25 4.09. Guide 05 holds the table.
- The new anchors are the pile at X = -35 cm (plate px 418, 561) and the riser at X = 118 cm (plate px 971, 561); both free zones are about 52 cm wide.
- Our books stay on the desk, never on the new right-hand bookshelf (D-26).

**Documents updated:** `DECISIONS.md`; guides 00, 01, 02, 05, 09, 12 and `context-header.md`; the prompts of Patches 02 (a note), 03, 04, 12, 14, 17 and 19; `patches/INDEX.md`; `README.md`; `reference/` (`desk-plate-analysis.md` and `measured-calibration.md` rewritten, `glossary.md`, `plate-licence.md`).

**Known issues:** the horizon is uncertain (desk edges y = 396, room lines y = 464), so the seed may need the lab's slider. The plate was not re-checked for banding at the edges. `plate:verify` was run on software WebGL, so run it once on your machine.

**Warnings for the next patch (03):** start from `docs/reference/measured-calibration.md` and the seed, not from the old numbers. The shelf in the plate holds a helmet that resembles a licensed character (D-27). The plate's right-hand bookshelf is bright; check S23's framing.

**Checks run and results:** `npx tsc --noEmit` clean. `npm test` 46 of 46 (it was 36 before, with the seed tests changed and `tests/plate.test.ts` added). `npm run plate:verify` PASSED (5 checks): SHA-256 `3aa7af92...44af0`; the bare plate SSIM 0.99991 (largest channel difference 1 level); strict pixel test in 11 lamp / LED regions, largest difference 1 level (limit 3); the photo spans x 0 to 1920, no bars. Negative tests: one byte appended to a copy of the plate fails the checksum; a plate material darkened in the render fails SSIM (0.918) and the region test (55 levels). Both were reverted and the plate is byte-identical to the supplied file.

---

## Patch 03 - Camera match lab and placement zones  (2026-11-11; gate G0b is yours to run, see "Checks")

**Files created / changed:**
`src/plate/plateCamera.ts` (new, pure), `src/plate/MatchCamera.tsx` (new), `src/plate/PlateFollow.ts` (the placeholder match is gone), `src/plate/Plate.tsx` (comment, default match), `src/stage.tsx` (camera and plate card), `src/config/plateMatch.json` (new, status `seed`), `src/config/placementZones.json` (new), `src/config/placement.ts` (new, typed access and checks), `src/dev/DevMatch.tsx` (new), `src/Root.tsx` (registers `DevMatch` after `DevPlate`), `tests/plate-match.test.ts` (new, 24 tests), `docs/reference/match-notes.md` (new), `docs/patches/INDEX.md`, `docs/DECISIONS.md`, `README.md`.

**PUBLIC API:**
- `plate/plateCamera.ts` (no React, no three.js; Node can import it): `interface MatchParams { camXCm, camHeightCm, camDistCm, fovDeg, pitchDeg, horizonY, principalX, deskXMinCm, deskXMaxCm, deskDepthCm, plateDepthCm }`; `focalPx(p)`, `principalY(p)`, `hfovDeg(p)`, `pxPerCm(p, Zd)`; `projectDesk(p, X, Y, Zd): { x, y, depth }` (plate px); `unprojectToDesk(p, px, py): { X, Zd } | null`; `deskRectPx(p, x0, x1, zd0, zd1, Y?)`; `deskEdgesPx(p)`; `MEASURED_DESK`; `HORIZON_RANGE {380, 470}`; `solveFromDeskEdges({ horizonY, principalX, deskWidthCm, deskDepthCm, camXCm, plateDepthCm? }): MatchParams`; `matchCameraRig(p, view): { fovDeg, aspect, position, rotationX, viewOffset }`; `cardTransform(p)`; `photoToOutput(view, x, y)`; `LAMP_PX`, `lampBulb(p)`; `buildMatchJson(p, { status, horizonChoice })`, `formatMatchJson(json)`, `parsePlateMatch(json)` (errors read `missing data: plateMatch.camera.heightCm`).
- `plate/PlateFollow.ts`: `type PlateMatch = MatchParams`, `PLATE_MATCH` (read from `plateMatch.json`), `plateTransform(view, match?)` (the card; it no longer depends on `view`), `plateCameraRig(view, match?)`. `PlateView`, `VIEW_FIT`, `photoToScreen`, `screenToPhoto`, `plateScreenRect`, `clampView` are unchanged. `PLACEHOLDER_MATCH` is removed.
- `plate/MatchCamera.tsx`: `<MatchCamera view match />` (sets the default camera every render), `<CameraSpace match>` (a group in camera space), `applyRig(camera, rig)`.
- `stage.tsx`: `<Stage view feather? match?>` now uses the match camera. **Children of `Stage` are in world space (cm), origin at the desk's front edge at the pile centre, the desk running away along -Z.** A box at `[0, 1, -16]` stands on the pile anchor at every view.
- `config/placement.ts`: `ZONES {L, R}`, `EXCLUSIONS`, `FOOTPRINTS {book, riser}`, `DESK_MARGIN_CM`, `footprintCorners(X, Zd, w, d, yawDeg)`, `footprintInZone(zone, X, Zd, w, d, yawDeg)`, `rectGapCm(a, b)`.
- `DevMatch` (a `Still`): props are the sliders (`preset`, `M`, `cx`, `cy`, `lockToDesk`, `camHeightCm`, `camDistCm`, `fovDeg`, `pitchDeg`, `horizonY`, `principalX`, `deskWidthCm`, `deskLeftCm`, `deskDepthCm`, `showGrid`, `showZones`, `showExclusions`, `showBox`, `showBar`, `showPanel`, `boxX`, `boxZd`, `boxYawDeg`, `barX`, `barZd`).

**Decisions and conventions later patches must follow:**
- **Coordinates:** desk point `(X, Y, Zd)` is world `(X, Y, -Zd)`. Origin = desk front edge at the pile centre. Pile anchor `(0, 16)`, riser anchor `(153, 16)`. The camera is at `(35, 45.57, 507.88)`. Zone L is X -24 to 24, zone R X 133 to 176, both Zd 3 to 34.
- **The scene camera is fixed and a view is a window of its sensor** (`setViewOffset`), not a moving card. The plate card is a child of a group carrying the camera's pose. Patch 05 drives `PlateView`; if it also needs a real camera dolly, move the group and the camera together.
- **Scale 3.73 px per cm, desk 233 x 65 cm** (a design assumption, `match-notes.md` section 3). The keyboard comes out about 33 cm wide; see there if you want another scale, and decide before Patch 04.
- **Horizon: 395.6 (the desk's edges) until you answer D-25.** Sliding it keeps the front edge exact and moves the back corners (25 px at 464); the numbers are in `match-notes.md` section 4.
- The lamp bulb for the key light is `landmarks.lampBulb` in `plateMatch.json` (X -35.33, Y 12.26, Zd 58.99), recomputed by the lab for any match. It is about 57 cm from the pile, not 20 to 40.
- The plate card stands at Zd 32.5 and writes depth like any mesh, so anything standing behind that depth is hidden by it. Patch 04 decides whether the card writes depth when it adds the depth of field.
- The right-hand object is a headset on a stand (`headset_stand`), not a webcam.
- The lab's test box and bar use flat colours and a two-layer contact patch. They are not lighting and not the shadow catcher of Patch 04.
- Guide 02's sentence "`plateTransform(cameraPose)`" describes the earlier idea (a card that moves). The code is as above; the guide text can be updated when Patch 05 lands.

**Known issues:**
- **Not run on the build machine:** the Studio window, the lab's rendering, the three stills, and the render half of `npm run plate:verify`. The sandbox had no browser (Remotion's Chrome download host was not reachable). Everything that can be proven without a browser is in `npm test`: three.js's own camera, set from the rig, projects desk points and the plate card's corners to the same pixel as the formulas, to 0.02 px, at random zoom, pan and pitch. The React side (`MatchCamera` setting the camera in a layout effect, `Stage` wrapping the card in `CameraSpace`) is straightforward but has not been seen drawing. If `plate:verify` fails on your machine, look at `Stage` and `MatchCamera` first; frame 0 must still be the plate at M 1.25, untouched.
- The match is still `status: seed`; D-25 (horizon) is open.
- The extents of the lamp, keyboard, speaker and headset are by eye, about +-10 px.
- `Copy JSON` relies on the browser's clipboard inside the Studio; the text is also selectable and `window.__plateMatchJson` holds it.

**Warnings for the next patch (04):**
- Stills and `plate:verify` first: run `npm run plate:verify`, open `DevMatch`, and answer G0b before building on this.
- Light the pile from `landmarks.lampBulb`; at the 233 cm scale it is far (57 cm), so the gradient across the pile will be gentler than guide 03 expects.
- The depth of field needs the plate card in the depth buffer at its depth (540.4 cm from the camera) while the books are about 508 to 532 cm away; check that the card's depth write does not hide anything standing deeper than Zd 32.5.
- Zone and exclusion numbers are tied to the desk size and the pile origin. If you change the scale, re-measure them.

**Checks run and results** (build machine: Linux, Node 22.23, no browser):
`npx tsc --noEmit` 0 errors. `npm test` 70 of 70 (46 before, 24 added). The tests cover: the file's derived numbers equal the code's; the desk's six measured corner values reproduced within 0.5 px (actually 0.02); horizon at y 395.6 and convergence for pitch 0, -2.5, 1.2 and 3 degrees; `unproject` inverts `project`; the three.js camera against the formulas (80 random cameras, views and pitches, 0.01 px); the plate card's corners and its centre land on `photoToScreen` (60 random, 0.02 px); a box's footprint at M 1.25, 2.46 and 4.49; the opening view fills the frame exactly; the horizon solver (front corners, front and back y exact from y 380 to 470; back corners fit only at 395.6, 25 px off at 464); the pile (to 12 degrees) in zone L and the 36 x 24 riser in zone R; zones 3 cm or more from every object on the desk and 26 px (test: 8) from the chair; the printed JSON is valid and reads back; a missing number is named by path. `npm run plate:verify` runs and passes the checksum step (`3aa7af92...44af0`); its render steps were not run. The plate file is unchanged (`git status` shows it untouched). A drawing of the projected grid, zones and test boxes over the real plate at M 1.25, 2.46, 3.98 and 4.49 was made with the same formulas and looked at: the grid lies on the desk strip, the box sits on it, the riser clears the chair.

---

## Patch 04 - Light rig, shadow catcher, depth of field, probe, benchmark  (2026-11-12; the stills, `plate:verify` and `bench` are yours to run, see "Known issues")

**Files created / changed:**
`src/config/lights.ts` (new), `src/light/Rig.tsx` (new), `src/light/PlateProbe.ts` (new, no DOM), `src/light/ProbeEnvironment.tsx` (new), `src/plate/ShadowCatcher.tsx` (new: `ShadowCatcher`, `ContactDecal`), `src/camera/focus.ts` (new, pure), `src/camera/ObjectDefocus.tsx` (new), `src/plate/Plate.tsx` (blur material; the card no longer writes or tests depth), `src/stage.tsx` (optional `lens`, shadow maps on), `src/dev/DevLighting.tsx`, `src/dev/DevBench.tsx`, `src/dev/PlaceholderPile.tsx`, `src/dev/benchScenes.ts` (all new), `src/Root.tsx` (registers `DevLighting` and `DevBench`), `scripts/make-probe.mjs` and `scripts/bench.mjs` (new), `package.json` (`probe`, `bench`), `tests/lights.test.ts` and `tests/focus.test.ts` (new), `README.md`, `docs/DECISIONS.md` (D-30 to D-32), `docs/patches/INDEX.md`.

**PUBLIC API:**
- `config/lights.ts`: `LIGHTS {key, rim, kicker, fill, probe, reflection, catcher, contact}` (every number the rig uses, with units in the header comment); `lampWorld(match?)` (world `[X, Y, -Zd]` of the bulb, from `lampBulb`), `deskToWorld(X, Y, Zd)`, `keyShimmer(frame)` (1 +- 0.4%, a pure function of the frame), `keyIrradianceAt(X, Y, Zd, match?)`, `type LightName`.
- `light/Rig.tsx`: `<LightRig frame? on? shadows? match? />`, children of `<Stage>`. `on` is `{ key, rim, kicker, fill }`, each default true. The probe is separate.
- `light/PlateProbe.ts` (Node can import it): `PROBE_FILE`, `PROBE_SIZE` (128), `FACE_ORDER`, `buildProbeFaces(front, size?)`, `buildProbeCube(front, size?)`. `light/ProbeEnvironment.tsx`: `<ProbeEnvironment intensity? />` sets `scene.environment`.
- `plate/ShadowCatcher.tsx`: `<ShadowCatcher match? color? opacity? />` (shadow-only plane at y = 0); `<ContactDecal X Zd w d yawDeg? reflection? />` (the two-layer contact patch and the warm reflection strip under one resting book; world space, children of `<Stage>`).
- `camera/focus.ts` (pure): `interface Lens { focusCm, focalMm, fNumber }`, `SENSOR_WIDTH_MM`, `PLATE_PX_PER_MM`, `NEUTRAL_BLUR_PX` (0.25), `matchFocalMm(p)` (44.4 mm), `plateDistanceCm(p)`, `defaultLens(p)` (focused on the pile, f/8), `cocRadiusPx(distCm, lens, M)`, `plateBlurPx(M, lens, p)`, `isBlurDrawn(r)`, `objectsNeedDefocus(lens, M, nearCm, farCm)`, `lensAt(frame, from, to, a, b)` (an eased focus pull, in 1/distance).
- `camera/ObjectDefocus.tsx`: `<ObjectDefocus lens M />` (child of `<Stage>`; mount it only when `objectsNeedDefocus` is true) and `ObjectDefocusEffect`.
- `stage.tsx`: `<Stage view feather? match? lens? />`. Without `lens` nothing is blurred (the film's opening view). With it the plate gets `plateBlurPx(view.M, lens, match)`.
- `Plate`: new prop `blurPx` (output px).
- `dev/benchScenes.ts`: `SCENES` (S02, S05, S10, S11, S23: placeholder boxes with the right footprints), `BENCH_FRAMES` (12), `SHOT_PROXY` (which scene stands in for each of the 26 shots), `sceneLens`, `sceneDepthRange`.
- `DevLighting` (a `Still`): props `preset`, `M`, `cx`, `cy`, `scene`, `key`, `rim`, `kicker`, `fill`, `probe`, `shadows`, `catcher`, `contact`, `plateDefocus`, `objectDefocus`, `focusCm`, `fNumber`, `falseColour`, `showPanel`. `DevBench` (a 12-frame composition) is what `npm run bench` renders.

**Decisions and conventions later patches must follow:**
- **The plate card draws first and neither writes nor tests depth (D-30).** This answers Patch 03's question: nothing deeper than Zd 32.5 is hidden by it. Books and decals are ordinary depth-tested meshes drawn after it.
- **Defocus lives in two places (D-31).** The plate is blurred in its own material, radius = max(thin lens, `minBlurPx(M)`). A real lens at 5 m blurs the flat card by less than 1 px at every M in the film, so the table decides; only a close focus (R3, 100 cm, f/2) goes above it (about 149 px at M 6.51). Books use the thin lens in `ObjectDefocus`, mounted only when a book would blur by 0.5 px or more. Neither is a CSS filter.
- **The lamp is behind and to the left of the pile (D-32).** The key lights tops and left sides; its shadows fall towards the camera and to the right (guide 03 says "slightly back"; the geometry says forward). The faces the camera sees are lit by the kicker, the rim and the fill. If the pile looks flat, tune `kicker` and `rim` in `config/lights.ts` before touching the key.
- **Units:** one world unit is 1 cm; point lights in candela (decay 2), the rim in nits, the fill in irradiance. The numbers are starting values, set by arithmetic for an albedo-0.35 cover (a lamp-facing cover at the pile comes out near 0.2 linear), not by eye.
- Shadows: PCF, one 1024 map per cube face of the lamp, radius 8 texels (a penumbra of about 0.9 cm at the pile; guide 03 asks for 1 to 2 cm, raise it by looking). Fixed sizes, no randomness; the lamp's shimmer is a function of the frame.
- Contact: the tight line under a book is the baked `ContactDecal` (0.25 cm and 1.3 cm layers), not the shadow map. Every resting book gets one; a book that is lifted does not.
- The probe's front face is the plate blurred in linear light (`npm run probe`); the lamp is a bright disc painted on it (12 nits, brighter than the 8-bit photo can hold) so foil can flare. The other faces are dark. The matt placeholder boxes ignore it; it is off by default in `DevLighting` so the first look needs no probe file.
- Focus model: a thin lens on a 36 mm sensor that spans the plate's 1536 px (so the match camera is a 44.4 mm lens), and a zoom is a window of that sensor, so blur on screen scales with M.

**Known issues:**
- **Not run on the build machine:** `npx tsc --noEmit`, `npm test`, `npm run plate:verify`, `npm run probe`, `npm run bench`, the Studio, and every still. The session that wrote this patch could not execute anything from the repository (running repository code was blocked), so none of it has been compiled or seen drawing. What was checked without running the repository: every number the new tests assert was recomputed by hand and by a standalone script (the shimmer stays within +-0.4% over 600 frames; the penumbra is 0.87 cm; the fill is 8.2% of the key at the pile; the lens is 44.43 mm; the pile blurs by 0.3 px at M 4.49 while the plate gets 21 px). **Run `npx tsc --noEmit` and `npm test` first; expect to fix a typing slip or two.**
- **Everything visual is a starting value.** The check stills (the pile at M 2.46 and 4.49 with a warm gradient toward the lamp, an amber rim, a tight contact line and a soft cast shadow) have not been looked at. Open `DevLighting`, tune `config/lights.ts`, and use the false-colour view to keep the pile out of the red.
- **`ObjectDefocus` and `FalseColourEffect` are custom effects for the `postprocessing` package and rely on its depth helpers (`readDepth`, `getViewZ`) as that package documents them for version 6.39.6. If a shader fails to compile, only compositions that mount them break (`DevLighting` with `objectDefocus` or `falseColour` on, and a `DevBench` frame whose lens needs it); the film, `plate:verify` and the plain `DevLighting` do not use them.** The object blur also does not spread a blurred book onto the plate behind it (the plate has no depth); that matters for R3 and is for Patch 10 or 11 to judge.
- `plate:verify` should still pass: with no `lens` the plate is the plain material, drawn exactly as before, now with depth write and test off. Run it before anything else.
- The shadow-map type is set in `Stage` (`PCFShadowMap`); the `radius` of a point light's shadow is a 5-tap PCF, so a large radius bands. If it does, lower the map size instead.
- A point light draws six shadow faces per frame, so the lamp is the most expensive thing in the frame. `npm run bench` will say how much.
- `make-probe.mjs` blurs after averaging down to 128 x 128 (the plate is stretched to the square face); the amber strips survive as soft warm bars. It was not run.
- The match is still `status: seed` and D-25 is still open; if the horizon moves, `lampWorld` follows it automatically and the probe's lamp spot (plate px) does not need to change.

**Warnings for the next patch (05):**
- Drive `lens` per frame with `lensAt` and the `focus` column of guide 05 (S02 120 to 38 cm, S04 36 to 30, ...). `config/camera.ts` is yours to create; `defaultLens(PLATE_MATCH)` is the S00 lens.
- The `DEEP` audit can now compute the blur a frame really gets: `plateBlurPx(M, lens, match)` against `minBlurPx(M)`.
- Run `npm run bench` before planning render time and paste its tables below.

**Checks run and results:**
The patch applies cleanly (`git apply --check`) to a fresh clone of the repository at the commit it was made on. The tests added (`tests/lights.test.ts`, 10 cases; `tests/focus.test.ts`, 10 cases) are written to pass but have not been executed; their expected values were verified by hand and by script as listed under "Known issues". The plate file is unchanged.

**Benchmark table:** not run yet. After `npm run bench`, paste its "Sample frames", "Seconds per frame, by scene" and "Shot-by-shot estimate" tables here, and say what `REMOTION_GL` was.
