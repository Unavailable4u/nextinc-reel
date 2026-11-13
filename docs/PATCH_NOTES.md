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

**Benchmark table:** see "Patch 04a" below (the first run on your machine).

---

## Patch 04a - Results of the first run on your machine, and the two fixes  (2026-11-12)

You ran Patch 04 on Windows (Node 24.18, AMD Ryzen 7 7730U, 16 threads, `REMOTION_GL=angle`). Two things failed; both are fixed in the fix patch that was applied before Patch 05:

- **`npx tsc --noEmit`: one error** in `src/light/PlateProbe.ts` (TS2345): `new Uint16Array(n)` is typed `Uint16Array<ArrayBufferLike>`, which could be a `SharedArrayBuffer`, and `THREE.DataTexture` only takes an `ArrayBuffer`. `half()` and `ProbeFace.data` are now `Uint16Array<ArrayBuffer>`, built from an explicit `new ArrayBuffer(...)`. Same numbers.
- **`npm test`: 89 of 90**, the case "the boxes of the pile and the riser stand inside their zones ..." (`S23 depth range 506..542`). The test was right: `sceneDepthRange` in `src/dev/benchScenes.ts` took `max(w, d) / 2` as every box's half depth, so the riser (36 x 24 cm) counted as 36 cm deep and reached in front of the camera's distance. It now uses the real extent along the camera axis, `(|w sin yaw| + |d cos yaw|) / 2`. S23 is now about 512 to 536 cm.

**Checks that passed on your machine:** `npm run plate:verify` PASSED (5 checks): SHA-256 `3aa7af92...44af0`; bare plate SSIM 0.99979 over 1914 x 1074 px (largest channel difference 1 level); strict pixel test in 11 lamp / LED regions, largest difference 1 level (limit 3); the photo spans x 0 to 1920. `npm run probe` made the probe image; `npm run bench` ran.

**Benchmark** (`npm run bench`, one worker, `REMOTION_GL=angle`; written to `out/bench.json`; estimates only, shots lighter than their stand-in are over-counted):

```
Sample frames
  frame  scene  seconds        frame  scene  seconds
      0  S02      0.88             6  S10      0.98
      1  S02      1.02             7  S11      2.02
      2  S02      0.34             8  S11      1.03
      3  S05      1.02             9  S23      2.02
      4  S05      1.00            10  S23      0.97
      5  S10      1.03            11  S23      1.00

Seconds per frame, by scene
  S02 0.75   S05 1.01   S10 1.00   S11 1.53   S23 1.33

Shot-by-shot estimate (minutes): S00 3.0, S01 3.0, S02 4.5, S03 1.5, S04 2.0, S05 6.1, S06-S09 2.0 each,
  S10 2.0, S11-S13 6.1 each, S14-S16 2.0 each, S17 4.0, S18 2.0, S19 4.0, S20 3.1, S21 2.0,
  S22 8.0, S23 10.6, S24 10.6, S25 2.7

WHOLE FILM: 5400 frames, about 1.7 hours with one worker (1.13 s per frame on average).
```

Reading it: the first frame of S11 and of S23 cost 2.0 s each (the first use of a scene, a texture or a shader on that frame) and the second and third cost 1.0 s, so the averages for S11 and S23 are probably 0.3 to 0.5 s too high; the real figure will come from Patch 13's master composition. The film is about 1.7 hours of rendering on one worker; with several concurrent workers (Remotion's `--concurrency`) it is shorter, but each browser tab needs its own GPU context, so test 2 and 4 before assuming it scales. The warning `X3595: gradient instruction used in a loop with varying iteration` printed once while frame 3 loaded; it comes from a shader in a bench scene, is only a warning and was not investigated.

**Known issues carried over from Patch 04, still open:** the stills of `DevLighting` (the pile at M 2.46 and 4.49) have not been looked at; the lamp's look is a starting value. `D-25` (horizon) and `D-27` (rights of the plate) still need your answer. `docs/DECISIONS.md` has two rows numbered D-30 (Patch 03's scale and Patch 04's plate card); they are different decisions, the Patch 05 rows start at D-33.

---

## Patch 05 - Camera rig, operator model, audits  (2026-11-12; the Studio and `npm run sheets -- --render` are yours to run, see "Known issues")

**Files created / changed:**
`src/config/camera.ts` (new), `src/camera/operator.ts` (new), `src/camera/path.ts` (new), `src/camera/audit.ts` (new), `src/camera/CameraRig.tsx` (new), `src/dev/DevCamera.tsx` (new), `tools/audit-motion.mjs` (new), `scripts/make-sheets.mjs` (new), `tests/camera.test.ts` (new, 36 cases), `src/lib/ease.ts` (`signatureIn`, `signatureOut`, `SIGNATURE_PEAK_SLOPE`), `src/plate/plateCamera.ts` (roll), `src/plate/PlateFollow.ts` (roll in `plateCameraRig`, `photoToScreen`, `clampView`; new `windowBox`), `src/plate/MatchCamera.tsx` (roll), `src/stage.tsx` (`rollDeg`), `src/ReelFilm.tsx` (the film now uses `CameraRig`), `src/Root.tsx` (registers `DevCamera`), `package.json` (`motion` is real, new `sheets`), `README.md`, `docs/DECISIONS.md` (D-33 to D-35), `docs/patches/INDEX.md`, `docs/guide/02-architecture.md` and `docs/guide/05-camera-and-motion.md` (text brought in line with the code).

**PUBLIC API:**
- `config/camera.ts` (Node can import it): `interface CameraKeyframe { frame, M, panX, panY, tiltDeg, rollDeg, focusCm, aperture, focalMm, ease, regime }` (a keyframe is the camera's state at its frame; `ease` and `regime` describe the segment that STARTS there); `CAMERA_KEYFRAMES` (S00-S03, frames 0 to 960); `holdShot(from, to, base, opts)` (ease in over 60 frames, then a 2 to 5 percent linear push, optional slide and focus pull; returns 3 or 4 keys); `glideShot(from, to, a, b, opts)` (ease in, straight run, ease out; the speeds meet exactly; returns 4 keys); `mixState(a, b, p)` (the one place that says how two keys mix: M and focus in 1 / x, the rest linearly); `checkKeyframes`; the limits `MIN_MOVE_FRAMES` 48, `MIN_GAP_FRAMES` 20, `STILL_FRAMES` 60, `STILL_MOVEMENT` 0.005, `MAX_M_RATE_PER_SEC` 1.5, `POP_FRACTION` 0.02, `REGIME_LIMITS`, `limitFor(regime)`; `FOCAL_MM`, `FOCUS_PILE_GUIDE_CM` (36), `PILE_DISTANCE_CM`; `KNOWN_EXCEPTIONS`; `VIEW_ARRIVED`, `VIEW_PILE`.
- `camera/path.ts`: `cameraAt(frame, { keys?, match?, operator? }): CameraFrame { frame, regime, authored, authoredView, operator, view, clamped, rollDeg, lens, slidePx }` (the one function the film, the dev sheet and the audit all read), `authoredAt(frame, keys?)`, `lensOf(guideFocusCm, aperture, focalMm, match?)`, `turnShiftPx(deg, match?)`.
- `camera/operator.ts`: `operatorAt(frame, regime): { rightCm, upCm, forwardCm, tiltDownDeg }`, `OPERATOR` (the table of guide 05 section 3), `LEAN_INS`, `REACH`, `STEADY_RANGES`, `OPERATOR_EVENT_FRAMES`, `OPERATOR_SEEDS`, `walkEnvelope(frame)`, `steadyGain(frame)`, `MIN_LAYER_FRAMES` (6).
- `camera/audit.ts`: `auditMotion({ keys?, from?, to?, match?, exceptions? }): { range, findings, counts, unexplained, stats, timeline }`; findings are `{ code, from, to, detail, value?, limit?, known? }` with `code` one of `STILL FAST DEEP EDGE POP LATE`.
- `camera/CameraRig.tsx`: `<CameraRig feather? match? keys? operator? frame?>children</CameraRig>`, a `<Stage>` driven by `cameraAt` (children are in world space, as in `Stage`).
- `stage.tsx`: `<Stage ... rollDeg? />`. `plateCameraRig(view, match?, rollDeg?)`, `matchCameraRig(p, view, rollDeg?)` (new field `rotationZ`), `photoToOutput` / `photoToScreen(view, x, y, rollDeg?)`, `clampView(view, rollDeg?)`, `windowBox(M, rollDeg?)`. With `rollDeg` 0 everything is as before.
- `ReelFilm` still takes `view?`: an explicit view bypasses the rig (no lens, no operator).
- `DevCamera` (a `Still`): props `from`, `to`, `every`, `operator`. It prints the path (frame, shot, regime, M, window centre, clamp, focus, f-number, plate blur against the table, operator offsets), three plots and the audit's verdict for the range.
- `npm run motion [-- --from=N --to=N --all --break]`; `npm run sheets -- --from=0 --to=959 --every=30 [--dir --render --scale --cols --rows --out]` (stills are `out/stills/f0000.png` ..., the names Patch 13's `npm run stills` will also use).

**Decisions and conventions later patches must follow:**
- **The camera is data plus one pure function.** Add shots by appending keyframes to `CAMERA_KEYFRAMES` (Patches 14-20); never move the camera from inside a shot component. Every keyframe is on a multiple of 30. Use `holdShot` for a hold, `glideShot` for a long move, or plain keys. A single `signature` ease over a long move peaks at 2.86 x its mean speed and breaks the limits (the S01 walk did); `glideShot` keeps the peak at 2.3 x for S01.
- **A camera movement is a movement of the window (D-34).** Slides and the operator's cm become `cm x 3.508 photo px` at the plate; turns become `focalPx x tan(angle)`; the lean-in multiplies M by `D / (D - z)`; roll turns the picture about the centre of the frame and the margin rule counts the rolled corners. The plate and everything on the desk share the one camera, so a box on the desk stays on the desk at every zoom, slide, tilt and roll (tested with three.js's own camera).
- **The guide's focus column is rescaled (D-33):** 36 is the pile at 524 cm; 260 is far behind it, 38 is just behind it. Keyframes keep the guide's numbers; `lensOf` turns them into the lens of `focus.ts`. Without this the pile would be 185 px out of focus at the end of S02.
- **The operator is added to the authored path, never instead of it.** STILL and EDGE are judged on the authored path; FAST, POP and DEEP on what the viewer sees. The sideways speed is the speed of the slide (authored pan plus the operator's cm) and does not count turns (the 0.25 degree bob alone is 8 photo px, which is 2.4 cm of "speed" at the plate).
- **Operator events in the table are placed now, for later shots:** lean-ins at 480 to 840 and 960 to 1080, the reach at 990 (settle 1020), steady ranges on S13 and S20. Patch 14 moves the S04 ones if its shot needs it. A lean-in is `from` (rises over 60 frames), `until` (eases back over 60).
- **Frame 0 is the bare plate.** The camera at frame 0 is M 1.25, centred, f/8 on the pile: the margin rule leaves the operator no room below M 1.319, and the lens draws no blur. `plate:verify` renders through `CameraRig` now and must still pass.

**Deviations from guide 05's table (all found with `npm run motion`, all recorded in `config/camera.ts` and in guide 05):**
- S00's push is 3% (M 1.2875 at frame 240), not 2.5% (1.28): with 2.5% the walking bob reached the margin just as the window opened and the sideways speed hit 48 cm/s (limit 40).
- S02 does not come to rest at frame 810. It glides into S03's push, so the camera never stops dead at the pile (it was a 66 frame STILL). The table's end values (M 4.49 at 840, 4.63 at 960, focus 38 then 36) are met exactly.
- S01 and S02 are `glideShot`s (90 + 120 and 60 + 120 frames of easing) instead of one `signature` each; S01's peak change of M is 1.48 x per second (limit 1.5) and its peak sideways speed 36.7 cm/s (limit 40), so there is little room left: if you lengthen the walk's amplitude or shorten S01, expect FAST.
- The focus in the last second of S00 pulls from the opening lens to the S01 lens (260, f/4), so the focus does not jump at the cut; the plate is untouched until frame 180 and at most about 2 px soft at frame 240.
- Pan is where the window is centred (photo px), not a turn in degrees: the margin rule is the real limit on it. Tilt and roll are limited per regime (`REGIME_LIMITS`).

**ONE deliberate exception, `STILL` at frames 0-65:** the film opens from rest. The ease-in of a hold is 60 frames (a multiple of 30, at least 48) and R1 may only change M, so the picture moves less than 0.5% for the first 66 frames. It is listed in `KNOWN_EXCEPTIONS` with its reason; `npm run motion` prints it as a known exception and passes, `npm run motion -- --all` shows it as a failure.

**Known issues:**
- **Not run on the build machine:** the Studio, `npm run plate:verify` through the new `CameraRig`, `DevCamera` drawn in the Studio, and `npm run sheets -- --render` (no browser was available, Remotion's browser download host was not reachable). What was checked instead: `tsc` clean; `npm test` 126 of 126; the whole Remotion entry bundles with esbuild (no import cycle or missing export); `npm run motion` runs; `scripts/make-sheets.mjs` was run on synthetic stills and on windows cut from the real plate with the exact views `cameraAt` returns (the sheet shows the walk to the lamp side, the pile at the end of S02, and the push of S03 as planned, without blur).
- **Run `npm run plate:verify` first.** Frame 0 now goes through `CameraRig`: view `VIEW_FIT` exactly (a test asserts it), lens f/8 on the pile (a test asserts that no blur is drawn), roll 0, so the render should be identical to Patch 04's. If it fails, look at `CameraRig` and `Stage` first.
- **Everything visual is a starting value.** Measured over S01 (frames 270-440): the walking bob moves the window up to 13.6 photo px vertically (about 33 output px at M 2.4) and the sway 1.9 photo px. That is strong: in `walking()` the camera tilts UP as it rises (`tiltDownDeg: -w.deg * bob`), so the 0.9 cm (3.2 px) and the 0.25 degrees (8.3 px) add. If it reads as too much in the Studio, flip the sign of that one term (the head nods down as the body rises): the two then partly cancel and the peak falls to about 5 photo px (`tests/camera.test.ts` does not depend on the sign; `npm run motion` is unaffected because turns do not count toward the sideways speed). The operator's cm amplitudes follow the crop model of D-29 (a slide of x cm is `x x 3.508` photo px at any M), so they feel larger at higher M, as on a real lens.
- The rolled view (`rollDeg`) is tested but no keyframe uses roll yet (S00-S03 have none); the R3 shots will. The tremor and the R3 limits are only exercised by the tests, because no R3 keyframes exist yet.
- `DevCamera` runs the audit for its frame range on every render (it takes a moment on a long range).
- `docs/guide/03-realism-bible.md` says "35 mm for R2"; the match camera is 44 mm. Left as the realism guide's intent (a different "look"); nothing reads it.

**Warnings for the next patch (06, or 13):**
- Patch 13 (master composition) must put the scene INSIDE `<CameraRig>` as children; do not nest another `Stage`.
- `ObjectDefocus` mounts only when `objectsNeedDefocus(lens, M, near, far)` is true; `cameraAt(frame).lens` is the lens to pass it. Measured through S02-S03 with the rescaled focus (D-33): the pile (524 cm) is 3.5 px soft at frame 510, 0.7 px at the end of S02 (frame 840) and sharp (0.01 px) at the end of S03; the plate gets the table's blur from M 2.6 (21 px at M 4.5).
- The S04 handover (M from 4.63 to about 6.51, hidden behind the book) is not authored yet; the audit's POP check (2% per frame) is what will catch a visible pop. Author it as a keyframe pair whose second key lands while the book covers the frame, and check `npm run motion`.
- Patches 14-20 add keyframes to the same array; run `npm run motion -- --from=A --to=B` for the new shots and paste the summary into their notes.

**Checks run and results** (build machine: Linux, Node 22.23, no browser):
`npx tsc --noEmit` 0 errors. `npm test` 126 of 126 (90 before, 36 added: easings, keyframes and builders, the path, the operator, roll with three.js's own camera, and the audit with deliberately broken keyframes for every code). The new tests include: the guide's table values at the shot boundaries; `glideShot` has no jump in speed at its joins; frame 0 equals `VIEW_FIT`; the view never leaves the 40 px margin from frame 0 to 1200; `cameraAt` is a pure function of the frame; the walk is S01 only, fades in over 30 frames and out over 440-480, and bobs at 1.8 Hz (power at 1.8 Hz against its neighbours); tremor is R3 only and off in the steady ranges; the lean-in is 3 cm and 0.6 degrees over 60 frames; the reach dips 2 cm and settles with 0.7 cm of overshoot; a rolled camera projects desk points and plate pixels exactly like `photoToOutput` (0.02 px) and a positive roll is clockwise; a 20-frame move, two moves 10 frames apart, M changing faster than 1.5 x per second, a slide above 40 (R2) or 10 (R3) cm/s, a hold over 60 frames without a drift, an off-beat key, M above the regime budget, a window outside the margin (also pan below M 1.319), tilt and roll above the budget, and a one-frame jump are each reported as FAST, STILL, LATE, DEEP, EDGE or POP.

`npm run motion` (frames 0-959, S00-S03):

```
camera moves: 0-480 (480 f), 510-960 (450 f)
Findings
  STILL f0000-f0065  the camera holds for 66 frames and moves less than 0.5% (a hold over 60 needs a drift)
        known exception: the film opens from rest: ...
Summary
  STILL 1   FAST 0   DEEP 0   EDGE 0   POP 0   LATE 0
  peak sideways speed 36.7 cm/s (R2 limit 40), peak change of M 1.477 x per second (limit 1.5), largest jump 0.65% (limit 2%), largest M 4.628
  shot table: 26 shots, 5400 frames
MOTION AUDIT: PASSED (1 documented exception).
```

`npm run motion -- --break` (a still beat after frame 960, then a 20-frame move) reports FAST (`a camera move of 20 frames`), LATE at f1040 and f1130, DEEP (M 4.935 above the R2 budget 4.7) and two more STILLs, and exits 1. The plate file is unchanged (`git status`).

---

## Patch 06 - Book geometry  (2026-11-12; the Studio is yours to run, see "Known issues")

**Files created / changed:**
`src/config/books.ts`, `src/book/geometry.ts`, `src/book/Book.tsx`, `src/book/PageBlock.tsx`, `src/book/Ribbon.tsx`, `src/dev/DevBook.tsx`, `tests/book.test.ts`, `src/Root.tsx` (registers the `DevBook` still), `docs/DECISIONS.md` (D-36), this file.

**PUBLIC API:**
- `config/books.ts` (Node can import it): `BookId`, `BOOK_IDS` (site order, Vol. I to IV), `interface BookSpec { id, volume, trimW, trimH, board, square, spine, weightG, pages, colors, seeds }`, `BOOKS`, `getBookSpec(id)`, `BOOK_GEOMETRY` (bevel 0.8 mm, corner radius, cloth, spine radius 3 cm, hinge position and minimum groove, endpaper, bands, bow and fore-edge dent, ribbon), `closedThickness(spec)`, `sheetCount(spec)`, `interface BookPose { position, yawDeg?, pitchDeg?, rollDeg? }`, `SPINE_TO_CAMERA_YAW_DEG` (90), `PILE` (bottom to top: SPHEREx +3 deg, MiniLocker -2, Mini Me +1, offsets 3 to 8 mm), `pilePoses(anchor)`.
- `book/geometry.ts` (pure, no React): `layoutOf(spec)`, `splitOf(spec, turned)`, `coverMatrix(spec, coverAngle)`, `staticGeometries(spec)`, `blockSlabGeometry`, `blockGeometries(spec, turned)`, `bowAmplitude(split)`, `bandGeometries(spec, turned)`, `ribbonPath` / `ribbonGeometry(spec, { yTop, swing?, sag? })`, `bookBounds(spec, state, { ribbon? })`, `anchorFrames` / `anchorsInBookFrame(spec, state, opts?)`, `ANCHOR_NAMES`, `poseEuler(pose)`.
- `book/Book.tsx`: `<Book id coverAngle? turned? pose? ribbonSwing? ribbonSag? castShadow? receiveShadow? slots? ref?>children</Book>`; `BookHandle { spec, anchors }` through `ref` (live three.js objects named `anchor-spine`, `anchor-front-board`, `anchor-back-board`, `anchor-block-top`, `anchor-ribbon`). `PageBlock` and `Ribbon` are the two parts it is built from.
- `DevBook` (a `Still`): props `view` (`single` or `pile`), `id`, `coverAngle`, `turned`, `yawDeg`, `pitchDeg`, `rollDeg`, orbit and zoom, `ribbonSwing`, `bounds`, `grid`, `lamp`. It prints the bounding box in cm (closed, now, and with the ribbon tail) and, for the pile, each book's thickness, base height, yaw and offset.

**Decisions and conventions later patches must follow:**
- **The book frame (guide 02 and `geometry.ts`):** cm; X from the spine (-W/2) to the fore-edge (+W/2), Y up from the underside of the back board, Z from head to tail. Closed, a book is W x H x (spine + 2 x board): Mini Me 15.2 x 22.9 x 3.0, SPHEREx 2.4, MiniLocker 2.6, Immersive 2.2.
- **Trim is the outer size of the boards (D-36).** The page block is smaller by the 3 mm square on the head, tail and fore-edge.
- **The cover is one group.** The front board, its half of the spine, its hinge strip, its endpaper, the turned sheets and their bands rotate together about the hinge axis (x = -W/2 + cloth/2, y = T/2). `coverAngle` 1 is 180 degrees; a spring may overshoot a little past 1 and the geometry follows. Patch 11 drives `coverAngle`; it never moves a board by hand.
- **`turned` only changes block heights.** The page block is two slabs that tile it exactly (right stack on the back board, left stack on the cover) and the bands and the ribbon follow the split. Patch 10 puts the moving sheet between the two stacks.
- **Every deformation goes inward and is seeded** (`seeds.block`, `seeds.ribbon`): the block bows by at most 0.5 mm (never more than half the thinner stack, so a thin stack cannot fold over) and its fore-edge is uneven by up to 0.3 mm, so nothing pokes through a board and the same book gives the same vertices on every render.
- **Texture slots are the five named anchors.** Local +Z is the outward normal, +X reads left to right, +Y is up on the face as a reader holds it, so a plane with no rotation lies on the surface. Patch 08 fills `frontBoard`, `backBoard` and `spine`; Patch 10 fills `blockTop`. `frontBoard` lives on the cover group, the others on the base.
- **Pose order is Y, X, Z** (`poseEuler`). A yaw of 90 degrees turns the spine to the camera; the pile uses 90 plus the slot's offset.
- **Geometry is read back from float32 buffers**, so a bound is only good to about 1e-6 cm. Tests that compare a bound with a nominal number use 1e-5, not 1e-9.

**Known issues:**
- **Not run on the build machine:** the Studio and `DevBook` drawn in it (no browser was available). The acceptance test ("from any angle it reads as a hardback, with bevelled edges catching the lamp") is yours: open `DevBook`, try both views, turn the orbit, set `coverAngle` 0.5 and 1 and `turned` 40, and look at the spine, the hinge groove and the ribbon tail.
- Everything visual is a starting value: flat colours, flat roughness, the lamp in `DevBook` is not the film's rig. Materials are Patch 07, covers Patch 08.
- The board plate is the same shape for every book (only the thickness of the spine differs), as intended.
- The pile's footprint test uses the book's trim footprint turned by the pile yaw; the three books fit zone L with the offsets in `books.ts`.
- `DevBook`'s `turned` slider goes to 128, which is Mini Me's sheet count; the other books have fewer sheets and the value is clamped to the book's own count.

**Warnings for the next patch (07):**
- Replace the flat `meshStandardMaterial`s in `Book.tsx` and `PageBlock.tsx` through `spec.colors`; do not add a second set of colours elsewhere.
- Patch 11 should read the anchors from the `ref` (`BookHandle.anchors`) rather than recompute them, and call `anchorFrames` only in tests.

**Checks run and results** (build machine: Linux, Node 22, no browser):
`npx tsc --noEmit` 0 errors. `npm test` 143 of 143 (126 before, 17 added in `tests/book.test.ts`). The whole Remotion entry bundles with esbuild.

Closed bounding boxes (width x height x thickness, cm), measured from the real geometry:

```
mini-me             15.20 x 22.90 x 3.00   with ribbon tail 15.20 x 25.84   open flat 30.30 x 22.90 x 2.68
spherex-blink       15.20 x 22.90 x 2.40   with ribbon tail 15.20 x 25.84   open flat 30.30 x 22.90 x 2.08
minilocker          15.20 x 22.90 x 2.60   with ribbon tail 15.20 x 25.85   open flat 30.30 x 22.90 x 2.28
next-inc-immersive  15.20 x 22.90 x 2.20   with ribbon tail 15.20 x 25.85   open flat 30.30 x 22.90 x 1.88
pile of three: 2.4 + 2.6 + 3.0 = 8.0 cm
```

## Patch 07 - Materials: cloth, foil, paper, edges  (2026-11-12; the Studio is yours to run, see "Known issues")

**What was built:**
- `src/config/materials.ts`: every number of how a surface looks (guide 03 section 3), the seven textures and their budget, `CLOTH_VARIANTS` (MiniLocker's stronger weave), `PALETTE_TOKENS`.
- `src/paint/textures.ts`: the seven pictures as pure functions of integer hashes (no `Math.random`, no trigonometry). `scripts/make-textures.mjs` (`npm run textures`) writes them to `public/textures/` as PNG (greyscale for one channel, no colour chunks) and `manifest.json` (SHA-256 of the pixels). `-- --check` compares only.
- `src/book/materials.ts`: `clothMaterial`, `foilMaterial`, `paperMaterial`, `edgeMaterial`, `stainedEdge`, `ribbonMaterial`, `bandMaterial`, `wearMaterial`, `dustMaterial`, and `bookMaterials(spec, textures, { wear, dust })` with `disposeBookMaterials`. Without textures every one still returns a correct material.
- `src/book/surfaceUV.ts`: UV in centimetres (a box projection per triangle for boards, spine, hinge strips and pastedowns; by face for the page block, with the sheet lines at v = y), and the yellowing of the page edges as a vertex colour that fades over `edge.reachCm` from a corner.
- `src/book/useBookTextures.ts` loads the seven pictures inside `<ThreeCanvas>`. `Book` takes `textured` (default true), `wear` (default 1) and `dust` (default 0); `PageBlock` and `Ribbon` take their material. The wear and dust decals lie on the front board a few steps above the cloth, inside the bevel.
- `src/config/books.ts`: `colors.foil` and `colors.headStain` (Mini Me's rose-red top edge). `src/lib/color.ts`: `mixHex`, `desaturateHex`.
- `src/paint/patterns.ts`: the endpaper patterns from a project's slug, motif (`rings`, `orbits`, `nodes`, `waves`, `bars`, `tiles`) and palette token, and `paintPattern` for a 2D canvas (Patch 09 paints the real endpaper page with it).
- `src/dev/DevMaterials.tsx` (a Still): lighting presets (lamp only, strips only, all), probe on/off, textures on/off, wear and dust, a book turn (`yawDeg`) and a cover lift (`rollDeg`), five camera targets, foil test shapes (a ring, a dot, rules and a block, no text or logos) and the four books' endpaper patterns.

**Decisions:** D-37 and D-38 in `docs/DECISIONS.md`.

**Things worth knowing:**
- **A flat book cannot flare under a yaw.** Turning a book that lies flat about the vertical axis leaves its normal, and so the mirror direction, unchanged. The lab therefore has `rollDeg` (the cover lifted towards the camera, as in S05); yaw only means something once the cover is lifted.
- The page edges' yellowing is a per-vertex value, so it spreads over a cell: about 0.5 cm along the head and tail and 1.8 cm across the top, wider than `reachCm` (0.5).
- The head is face 5 (-z) of the slab; Mini Me's dye goes there.
- `surfaceUV` returns a non-indexed copy of an indexed geometry (it disposes the old one), so `staticGeometries` now returns non-indexed hinge strips and pastedowns.

**Known issues:**
- **Foil does not visibly flare yet.** Rendered on the build machine with a Chrome and software GL: for `lighting` all, `look` foil, the brightest 1 percent of the foil region measured 17, 18, 18, 18, 19 for yaw -12, -6, 0, 6, 12 with the cover lifted 35 degrees, and 4, 4, 4, 6, 7 at 65 degrees. The probe's lamp spot is just below the horizon in its front face, so only a steeply raised cover can mirror it. The probe's values are marked as starting values for Patch 10; the acceptance test "foil flares across a 5 degree yaw" is open until then.
- Foil colours of MiniLocker, SPHEREx and Immersive and the forest palette token are guesses (D-38).
- The weave, wear and dust were looked at in `DevMaterials` renders but not tuned; use the sliders.
- The benchmark (`npm run bench`) was not re-run, so "within 15 percent of Patch 06" is unchecked.

**Checks run and results** (build machine: Linux, Node 22, a Chrome with software GL):
`npx tsc --noEmit` 0 errors. `npm test` 185 of 185 (143 before, 42 added: `tests/textures.test.ts`, `tests/materials.test.ts`, `tests/patterns.test.ts`). `npm run textures -- --check` matches. The whole Remotion entry bundles with esbuild. `DevMaterials` rendered with `remotion still` (textures load, 3.92 MB on the GPU, no errors).


---

## Patch 08 - Cover painter for the four books  (2026-11-13; the Studio is yours to run, see "Known issues")

**What was built:**
- `src/config/covers.ts`: every number of the covers (guide 04 sections 2 and 3): pixels per cm, the safe areas, the clip inset, the title, line, author and spine numbers, the QR slot, per-book styles (`COVER_STYLE`: what is foil and what is print) and art (`COVER_ART`), `COVER_FILES`. Added in this patch beyond the first draft: `COVER.depth` (foil 1, blind 0.8), `spine.numeralGapCm`, `COVER_ART["spherex-blink"].lineCm` and the globe's `tiltDeg`, `turnDeg`, `blindAlpha`.
- `src/paint/svgPath.ts`: an SVG path in, absolute M, L, C, Z out (relative commands, H, V, Q, S, T and arcs converted), exact bounds, transforms, `parseSvgPaths` for a traced file, circles, ellipses and rounded rectangles as paths.
- `src/paint/typography.ts`: the measure (`Measure`, `measureWith`), tracking, small caps, wrapping, `balancedWrap` (the same number of lines, evened out, so a blurb never ends on one short word), justification, `fitSize`, `layoutTitle`, `fontsReady` (throws, naming the fix, when a face is missing).
- `src/paint/covers/`: `types.ts` (the plan: operations on three surfaces, layers `ink`, `foil` and `blind`), `brand.ts` (the dial's `CX`, `CY`, `RADII`, `arcPath` copied word for word from `minilocker-film/src/ui/RadiusDial.tsx`, and the Mark's five circles from `minilocker-film/docs/bible/appendix-A.md`), `common.ts` (the shared grammar: title block, line, authors, spine top to bottom, back with the QR slot, the publisher's x, the traced mark), `miniMe.ts`, `spherex.ts` (the Patch 07 `orbits` pattern as foil), `miniLocker.ts`, `immersive.ts` (the blind-stamped globe), `render.ts` (a plan drawn on a colour, a foil and a height canvas, and `normalFromHeight`), `data.ts` (`coverDataFor`: selectors and `bookText.ts`), `index.ts` (`planFor`, `coverKey`, `paintCover` cached by content hash, `loadArtwork` for the browser).
- `src/book/coverMaterials.ts` and `src/book/CoverSlots.tsx`: the painted covers on the Book. `Book` takes `covers` (default true; needs `textured`) and puts the print and foil overlays in the `frontBoard`, `backBoard` and `spine` slots, holding the render with `delayRender` until they are painted.
- `src/dev/DevCovers.tsx` (a Still, registered in `Root.tsx`): `flat` (one book's back, spine and front), `fronts`, `spines`, `backs` (all four), each with an overlay of the safe area, the clip inset and the QR slot; `book` (one cover on its Book under the film's rig and probe, from the front, spine or back, with the cover liftable and openable). The painter's notes are printed in red.
- `src/lib/color.ts`: `relativeLuminance`, `contrastRatio`. `DevMaterials` passes `covers={false}` (its foil test shapes stay as they were); `DevBook` now shows the covers (and its pile view the three spines).

**PUBLIC API:**
- `coverDataFor(id): CoverData`; `planFor(id, tokens, data?): CoverPlan` (pure); `coverKey(data, tokens): string`; `paintCover(id, data, tokens, make?): Artwork` (`{ id, key, plan, layers, normals }`, cached); `loadArtwork(id): Promise<Artwork>`; each book's `paintCover(data, tokens)` (and `plan...`) in its own file; `clearCoverCache()`.
- `CoverTokens = { spec, measure, miniMeMarkSvg: string | null }`. `useArtwork(id, enabled)` and `useCoverSlots(id, enabled)` in `src/book/CoverSlots.tsx`.
- `<Book covers>`; `normalFromHeight(rgba, w, h, depthPx)`; `coverTextureBytes(plan)`; `spineHalfGeometry(spec, "back" | "front", lift)`.

**Decisions:** D-39 to D-42 in `docs/DECISIONS.md`.

**Decisions and conventions later patches must follow:**
- **A cover is planned, then drawn.** A planner is pure (data and tokens in, operations out); only `render.ts` touches a canvas. A test or a tool can plan in Node with a fixed-width `Measure`.
- **Surfaces are read the way the anchor frames say** (+X right, head up): the front's hinge is on its left, the back (turned over like a reader turns a book) has it on its right, the spine reads top to bottom with the front board on its right. Sizes: the board face is `W/2 - hingeX` by `H` (14.65 x 22.9 on Mini Me), the spine is the ARC of the rounded back (3.14 cm on Mini Me), painted at 100, 100 and 70 px/cm.
- **The cover's facts are the data's.** Titles of the data, summaries, names and numerals come through `select.ts`; how a title is set, the spine text and the lines come from `bookText.ts`. `tests/covers.test.ts` checks that every printed text is one of them and that `minime.app`, "Try" and a NASA logo appear nowhere.
- **The QR slot is reserved, not painted.** The back plan carries `qrSlot` (4.4 cm square, 3.9 cm above the bottom, centred). Patch 09 prints its code and its light quiet zone there.
- **The cache key carries `COVER.version`.** Bump it when a number in `config/covers.ts` is meant to change every cover; the key also hashes the data, the colours, the seeds and the mark file's text.
- **Foil is metal and has no alpha.** Its colour comes from the canvas, so one surface can hold two foils; `foilMaterial` is built white. Translucent things (the MiniLocker Mark) are print.
- **The front half of the spine is in the `frontBoard` slot** (it follows the cover); the back half is in `spine`. `CoverSlots.tsx` carries the spine anchor's frame into the front board's with the two closed-pose anchors.

**Known issues:**
- **Not run on the build machine: the Studio and every 3D view** (no browser was available). The flat 2D painting WAS looked at: the four covers were drawn with the same planners on a Node canvas with the site's own CMU faces and checked by eye (the layouts, the dial, the orbits, the globe, the spine top to bottom, the x colours). What is yours to do: open `DevCovers` in each view; `book` view with the cover lifted 35 degrees, face front, spine and back; and `DevBook` (single and pile). Things to look for: the foil overlay standing cleanly on the cloth (no flicker at the board's edge, no z-fighting under the corner wear), the spine overlay meeting the boards, and the foil's flare (the probe is Patch 10's).
- **`public/brand/mini-me-mark.svg` does not exist yet (you vectorise it).** Until it does the Mini Me cover has no mark (front and spine head) and `DevCovers` prints the note. When you add it check its size, that its holes are cut with opposite winding (the nonzero rule), and that there is no background path in it (every `<path>` is drawn).
- **The foil colours are still the starting values of D-38.** The three project cover images in `public/site/img` are dark web art, not book cloth, so sampling them gave nothing to improve on; the hexes of `config/books.ts` stand. Sample real swatches when you have them.
- The spine's front half rides the cover when the book opens, but the page block's bow and the hinge groove are Patch 06's and were not changed; open the cover in `DevCovers` to see that the spine sheet does not tear at the hinge.
- Wear and dust lie over the covers (the lifts are print 0.002, foil 0.003, wear 0.004, dust 0.008 cm). If a lamp raking the cloth shows the steps, tune `PRINT_LIFT_CM` and `FOIL_LIFT_CM` in `coverMaterials.ts`.
- The print overlay is flat paint over the cloth: where ink is opaque the weave is hidden (translucent print keeps some). If that reads as plastic, lower the opacity of the print material or give it the weave normal map.
- The dial of Vol. III reaches within 0.85 cm of the board's top edge and 1.0 cm of the fore-edge with the guide's 11.6 cm and (0.52, 0.31); it is art, not text, so it may leave the safe area, but look at it near the corner wear.

**Warnings for the next patch (09):**
- Fonts: `fontsReady()` (in `typography.ts`) is what to call before painting a page; it checks that every declared face is loaded and throws otherwise. `paintCover` is not what to reuse for pages, but `layoutTitle`, `balancedWrap`, `justify`, `smallCapsLayout` and the `Measure` are.
- The back cover's `qrSlot` is in px of the back surface; its cm numbers are in `COVER.back`.
- `Book` now waits for covers (`delayRender`). A scene that mounts a `Book` outside `<ThreeCanvas>` or with `textured={false}` is not affected; one that wants the bare cloth passes `covers={false}`.

**Checks run and results** (build machine: Linux, Node 22, no browser):
`npx tsc --noEmit` 0 errors. `npm test` 217 of 217 (185 before, 32 added in `tests/covers.test.ts`: the SVG parser, typography, the dial and the Mark against the source's numbers, the x and its colour on every cloth, the plan of every cover (sizes, the guide's placements, nothing outside the safe area, the spine's order, the QR slot, layers), the cache key, the drawing through a recorder, the normal map, the memory budget, the curved spine). The whole Remotion entry bundles with esbuild.

Measured: textures per book 87.2 MB (Mini Me), 85.2 (SPHEREx), 85.9 (MiniLocker), 84.4 (Immersive), 343 MB for the four, budget 400 MB (the first estimate in `config/covers.ts` said 91 and 365; the board face is a little narrower than the trim). Contrast of the crimson x against the cloth: Mini Me 3.10, MiniLocker 3.25, SPHEREx 1.88, Immersive 1.73.

---

## Patch 09 - Interior page painters, QR codes, spreads  (2026-11-13; the Studio and a phone scan are yours to run, see "Known issues")

**What was built:**
- `src/config/pages.ts`, `src/config/pageSpecs.ts`, `src/paint/qr.ts` (from your sample files, extended): every number of the pages (`PAGE`: margins, the type scale, each page type's layout, the print, the film frame, the codes), the page list of each book (`BOOK_PAGES`: Mini Me 13 pages, MiniLocker 7, SPHEREx 11 and Immersive 10 for the riser and `DevPages`), the acts in which each book's pages are alive, and the QR rules (level M, 4-module quiet zone, 3.4 cm minimum, vector squares). `PAGE_BACK_TEXT` says which editorial lines the back page prints (the same choice as each back cover).
- `src/paint/pages/`: `types.ts` (`PagePlan` and its operations), `data.ts` (`pageDataFor`: selectors and `bookText.ts`, the film frame, the figure), `common.ts` (frame, text lines, tracked and small-cap lines, justified paragraphs with a drop cap, whole-sentence flow, shapes), `print.ts` (the mounted print: shadow, white border, hairline, picture, four corner mounts, a turn of 0.4 to 0.8 degrees from a hash), `planners.ts` (the eleven page types and `planPageOf`), `render.ts` (`paintPage`: paper, grain, endpaper pattern, text, shapes, pictures; recorder-friendly), `index.ts` (`planPage`, `planBook`, `pageKey`, `loadBookPages`, `releaseBook`, `spreadOf`).
- `src/paint/spread.ts`: `paintSpread(bookId, leftIndex)`, `prepareAct(act)` and `disposeAct(act)` (one book's pages alive at once, by `BOOKS_OPEN_IN_ACT`).
- `src/paint/covers/`: the back cover now prints its QR and its light quiet zone in the reserved slot (`qrOps` in `common.ts`; the plan carries `surfaces.back.qr`; `CoverData.qr` is target 1).
- `src/dev/DevPages.tsx` (a Still, registered in `Root.tsx`): `spread`, `sheet`, `types` (one of every page type the book uses) and `page` (one page, for the QR check), a margin overlay, the codes' light squares, a "readable only" toggle (green box: passes the 8-word and 7 to 1 rules; red: breaks one), and the painters' notes in red.
- `scripts/check-qr.mjs` (`npm run qr:check`): renders each page that carries a code through `DevPages` at 40 px per cm, decodes each code with jsQR and compares with `getQrTargets`; exit code 1 on any failure.
- `scripts/crop-screens.mjs` (`npm run screens`): crops your raw captures to the app content (guide 07). It writes `public/screens/mini-me/01-chat.png ... 06-build.png` and `public/screens/next-inc-immersive/01-hero.webp, 02-globe.webp, 03-intro.webp`; your originals are not touched.
- `src/config/bookText.ts`: `figure` and `filmFrame`, and the screenshots and draft captions of Mini Me and Immersive.
- New dependencies: `qrcode-generator` 2.0.4, `jsqr` 1.4.0 (dev).

**PUBLIC API:**
- `pagesData(id): PageData`; `planPage(id, index, tokens, data?): PagePlan`; `planBook(id, tokens, data?): PagePlan[]` (pure); `pageKey(plan, data, tokens): string`; `loadBookPages(id): Promise<BookPages>` (`{ id, data, pages: { plan, key, canvas }[], bytes }`, cached, refuses a book over the budget); `paintBook(id, tokens, pictures, make?)`; `releaseBook(id)`; `spreadOf(book, leftIndex)`; `paintPage(plan, make, images)`.
- `PageTokens = { spec, measure, imageSize(file) }`. `paintSpread(id, leftIndex)`, `prepareAct(act)`, `disposeAct(act)`.
- `qrMatrix(text)`, `qrBox(m, cx, cy, codeSide)`, `qrCmds(m, x, y, module)`.

**Decisions:** D-43 to D-46 in `docs/DECISIONS.md`.

**Decisions and conventions later patches must follow:**
- **A page is planned, then drawn** (as a cover is). Read the plan in Node, draw it in the browser. `PAGE.version` is in every cache key.
- **Left and right pages**: the index decides the side (even is left); the inner margin (2.0 cm) is on the right of a left page. A leaf's front is an odd index and its back the next even one, so P-BLANK (index 2) is the back of P-HALF (index 1): it shows the half-title through, mirrored, at 5 percent.
- **Read strings and texture** (D-44). A string at most 8 words long is read and has 7 to 1 contrast; anything longer is texture of real sentences. Add a string to a page and the tests check both.
- **Pictures**: a print is never cropped (the film frame, 16:9, is); a picture that is missing is drawn as an empty frame and the plan carries a note (red in `DevPages`). Pictures come from the `ImageLookup` given to `paintPage`.
- **Codes** are drawn only by `qrCmds` with `qrBox`'s quiet zone, and tagged `qr-quiet` and `qr-modules`, so `qr:check` and the tests can find them. Never draw a code from a picture.
- **Texture memory**: 13 pages of Mini Me are 13 x 32 MB = 416 MB, under the 512 MB budget of one book. MiniLocker's 7 pages are 224 MB. Patch 11 must drop one book before it loads another (`disposeAct`).

**Known issues:**
- **Your pictures are missing for MiniLocker and SPHEREx.** `public/screens/minilocker/` and `public/screens/spherex-blink/` hold nothing yet (the MiniLocker files come from `minilocker-film/public/deck/*.png`). Until then those books' gallery pages show empty mounted frames and `DevPages` prints a red note for each. SPHEREx's figure and the Immersive figure read from `public/site/img/...` (run `npm run sync -- --copy-media`).
- **All captions are drafts** (`draft: true` in `bookText.ts`). They say only what the picture shows. Check each Mini Me tab is a feature the project's guide marks Available before you approve them; `content/books.md` has the approved wording to compare.
- **The Studio and a phone scan were not done by hand.** `qr:check` and the stills were rendered with Remotion in headless Chromium on the build machine (software GL): all 12 codes decode and the 11 page types look right by eye. Point a real phone at `DevPages` (`page` view, any QR page) on your monitor, as the patch asks.
- Small type is small: body text is 11 pt on a 15.2 cm page (4.75 px per point at 2048 px). The abstract, colophon and gallery text are texture; the captions, names, labels and addresses are the read strings. If the sheet at 100 percent is hard to read, raise `PAGE.type` and `PAGE.colo` numbers; every number is in `config/pages.ts`.
- Patch 10 bends these canvases; they are flat 2048 x 3072 RGBA with no mip maps made yet (the budget counts them).

**Warnings for the next patch (10):**
- A page texture is `PaintedPage.canvas` (HTMLCanvasElement) in the book's `loadBookPages` result; do not repaint it per frame. A spread's two canvases come from `spreadOf` or `paintSpread`.
- The texture covers the whole leaf face, 2048 x 3072 for 15.2 x 22.8 cm of the 22.9 cm trim (D-36 and `PAGE_PX_PER_CM`): map the page's UV to the leaf so the text does not swim.

**Checks run and results** (build machine: Linux, Node 22, headless Chromium):
`npx tsc --noEmit` 0 errors. `npm test` 241 of 241 (217 before, 24 added in `tests/pages.test.ts`: the page lists and parity, the margins and nothing outside them, no notes on any page, the read rules, real words only, whole sentences, D-17 and D-20, each page type, every code decoded from its own squares with jsQR, its size and quiet zone, the budget, determinism, and the drawing through a recorder). `npm run qr:check` 12 of 12 codes decode from rendered stills at 40 px per cm. `DevPages` rendered and looked at: `types`, `spread` and `sheet`.

---

## Patch 10 - Sheets, bending, translucency, riffle  (2026-11-13; the Studio, the bench and the strip of stills are yours to run, see "Known issues")

**What was built:**
- `src/config/sheets.ts`: every number of a loose sheet (`SHEET`): the 24 x 36 mesh, the bend (curl 38 degrees, lag 0.12, edge weight power 1.6), the finger's corner, the landing's flutter, the real depth (0.012 cm) and the offset between neighbours (0.004 cm), the light through the paper, the printed-in gutter, the blob shadow, the page faces, the per-sheet variation, the turn (54 frames, 36 quick) and the riffle (13 sheets of 30 frames, starts 6 to 10 frames apart), and the length read-out's progress values and tolerance.
- `src/book/sheetShape.ts`: the maths, pure. `sheetLayout`, `shapeOf`, `sheetVariation`, `sheetAngle`, `sheetRow` (a polyline of unit segments, so a row is exactly W long), `sheetPivot` (the gutter travels on an arc about the hinge axis), `restOffsets`, `restWeightAt`, `sheetMesh` (the CPU twin of the shader), `lengthReadout`, `sheetBlob`.
- `src/book/sheetShader.ts`: the vertex shader (`shAngle`, `shEval`, line for line the twin of `sheetAngle` and `sheetMesh`), the fragment additions (the page, the other side's ink at 8 percent, the gutter, the light that reaches the far side of the face and passes through), and the colour, depth, distance, page-face and wire materials. `uCpu` makes the shader draw the grid's own positions so the two can be compared by eye.
- `src/book/sheetGeometry.ts`: the grid (two layers, `aGrid` = u, v, layer), `writeSheetMesh`, the page printed on a stack's face (`pageFaceGeometry`) and the blob's alpha bytes.
- `src/book/sheetUniforms.ts`: which number goes into which uniform, as a pure function (`sheetUniformValues`) and the copy into the real uniforms.
- `src/book/Sheet.tsx`: `<Sheet>` (one sheet) and `<PageFaces>` (the next page on each stack's face, so a lifting sheet never shows a hole).
- `src/book/pageTextures.ts`: a painted page's canvas as a texture (made once, sRGB, mip maps, 16x anisotropy), `releasePageTexture`, a white texture and the marked checker used by `DevPageTurn`.
- `src/book/rig/turn.ts` (`turnProgress`, `landSeconds`, `turnState`, `turnFrames`, `turnedDuring`) and `src/book/rig/riffle.ts` (`riffleStarts`, `riffleFrames`, `riffleSheets`, `riffleTurned`).
- `src/dev/DevPageTurn.tsx` (a Still, registered in `Root.tsx`): a scrubber (`frame`), single and riffle modes, a checker or the painted pages, three lamp setups (the "behind" one is the glow test), orbit and zoom, toggles for the mesh, the hinge, the blob, the page faces and the CPU twin, and the length read-out printed green or red against the tolerance.
- `tests/sheets.test.ts`: 16 tests.
- `src/book/geometry.ts`: `blockBackX` is exported (it was private; the sheets need the same rounded back as the block). Nothing else in the file changed.

**PUBLIC API:**
- `turnProgress(frame, start, durationFrames, ease?)`, `turnState(...)`, `landSeconds(...)`, `turnFrames(quick?)`, `turnedDuring(baseTurned, P)`.
- `riffleSheets(frame, { start, count?, turnFrames?, gapFrom?, gapTo?, ease?, first?, baseTurned? })` gives each sheet's `rank`, `index`, `P`, `landSec` and `place`; `riffleTurned(frame, params)` is the number to give the Book as `turned`.
- `<Sheet id coverAngle turned baseTurned progress landSec place index front back />` inside the `<Book>`; `<PageFaces id coverAngle turned right left />` next to it.
- `sheetLayout(spec, state, baseTurned?)`, `shapeOf(layout, variation?)`, `sheetAngle(u, v, P, landSec, shape)`, `lengthReadout(P, layout, shape, landSec?)`.

**Decisions and conventions later patches must follow:**
- **A vertex shader, not a skinned mesh.** The bend depends on u and v (the corner lifts one corner only), so every row is its own polyline; twelve bones along x would give every row the same bend. A skinned mesh also shortens the paper at each joint where the bones blend. The shader integrates unit segments, so a row is exactly W long, and the same code runs in the lamp's depth passes, so the shadow bends with the paper.
- **Directions are integrated, not positions.** `angle(u, v)` is clamped to `[0, restAngle]`, which is what keeps a sheet from going through its neighbour (the flutter only lifts).
- **Progress and time**: a sheet is a pure function of `P` (0 to 1) and `landSec` (seconds since `P` reached 1). Nothing in a sheet reads the frame; the rigs turn the frame into those two numbers.
- **The leaf's width is fixed where the turn starts** (`baseTurned`), while `turned` moves with the crossing, so the stacks tile the block exactly and the sheet does not change size in the air.
- **Each point decides for itself whether it lies on a stack** (`restWeightAt`, from its own angle), so the part of a sheet that has settled follows the bowed face while the rest is still in the air.
- **A sheet's variation is seeded** by the book's block seed and the sheet's number (`sheetVariation`), so the same sheet is the same in every render.
- The page's texture is mapped to the whole leaf face (D-36), the front with u from the gutter, the back mirrored.
- `PageBlock` needed no change: its heights already come from `splitOf(spec, turned)`, and the riffle feeds it a continuous `turned`.

**Known issues:**
- **Not looked at.** No browser or GPU was available, so nothing was rendered. Open `DevPageTurn` in the Studio and check by eye: the glow with the lamp set to `behind` and the sheet near vertical, the lag (the outer edge arriving late), the corner lift, the two or three small wiggles on landing, the page faces under a lifting sheet, and the `cpu` toggle (the two meshes must look the same).
- **The shader was not compared with its twin by a test.** `sheetUniformValues` is pure so a JavaScript copy of the GLSL can be run on it, but that copy was not written; the `cpu` toggle is the check for now.
- **The strip of stills** (frames 0, 4, 8 ... 44) and **`npm run bench` on a riffle frame** (the patch asks for under 4 s) are yours to run.
- The riffle's 88 to 104 frames (first start to last start) holds for 12 to 14 sheets, as the config says; 10 and 11 sheets are allowed (`min` is 10) but their span is shorter.
- Wiring the sheets to the shots is not part of this patch.

**Warnings for the next patch (11):**
- Give the Book `coverAngle` 1 and `turned` from `riffleTurned` or `turnedDuring`, and one `<Sheet>` per sheet in the air, with the same `coverAngle` and `turned` as the Book and `baseTurned` set to the sheets turned before the turn began.
- Load a book's pages before the first frame that shows a sheet (`loadBookPages`), and drop one book before loading another (`disposeAct`); call `releasePageTexture` for the textures made from the canvases that were dropped.
- `<Sheet>` and `<PageFaces>` build their own materials and uniforms per instance (the program cache keys are fixed). Whether a riffle of 14 sheets holds the 4 s bench budget has not been measured.

**Checks run and results** (build machine: Linux, Node 22, no browser):
`npx tsc --noEmit` 0 errors. `npm test` 257 of 257 (241 before, 16 added in `tests/sheets.test.ts`: the clock, the riffle's starts and span, the sheets of a riffle in order, the length of rows at p = 0, 0.25, 0.5, 0.75 and 1 for all four books and several sheets, the columns, the mesh's rows on both layers, the ends of a turn and the lag, the landing's rebound, determinism and unit normals, the stack weight, the pivot's arc and the offsets, the blob, the variation's seed and range, the uniform order, the grid, the checker).

Measured length read-out (sheet 10 of each book, open flat): worst deviation of any row or column from the paper's size is 0.0012 percent at every one of the five progress values, for all four books, against the 0.5 percent tolerance. W is 14.62 to 14.74 cm and H 22.30 cm.
