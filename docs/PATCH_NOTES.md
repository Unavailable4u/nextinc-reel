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
