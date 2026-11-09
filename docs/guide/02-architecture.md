# 02 - Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Video framework | **Remotion 4.x** | You already use it (`minilocker-film` pins `4.0.540`). Frame-exact, scriptable, Studio preview. |
| 3D | **Three.js through React Three Fiber**, via `@remotion/three` (`<ThreeCanvas>`) | Remotion's own integration. Your `Next-In-C` repo already uses react-three-fiber, drei and postprocessing, so the skill carries over. |
| Language | TypeScript, `strict: true` | Same as the earlier film. |
| UI/React | React 18.3.x | Keep React at 18 while you use react-three-fiber v8 (v9 expects React 19). Patch 00 confirms the compatible set against the current docs and pins exact versions. |
| QR | A small QR library at build time (Patch 09), not a web service | Offline, deterministic, decodable. |
| Image prep | `sharp` (Node) for resizing, WebP, grain textures | Scriptable and repeatable. |
| Encoding | `ffmpeg` and `ffprobe` on PATH | Same as before (`winget install Gyan.FFmpeg` on Windows). |

**Version policy.** Every dependency is pinned to an exact version in `package.json`. Patch 00 records the chosen versions in `docs/PATCH_NOTES.md`. Upgrades are a maintenance task with a test (guide 11), never a side effect.

**Rendering on your machine.** Three.js needs a real WebGL renderer in the headless browser. Remotion documents the OpenGL renderer option `angle` for this (set it in `remotion.config.ts` for the Studio and in the render script's browser options for Node API renders). On Windows with a GPU this is fast; with no GPU the software fallback works but is many times slower. `npm run bench` (Patch 04) measures it, and the answer decides the render plan (guide 09).

## Determinism (the rules that keep a render from flickering)

1. Every pixel at frame *N* is a pure function of *N*. Use `useCurrentFrame()`, `interpolate()`, `spring()`, and your own pure easing functions.
2. **Never use `useFrame` from react-three-fiber.** `<ThreeCanvas>` forces the loop to `never` during rendering and re-renders only when Remotion asks; animation that is not driven by `useCurrentFrame()` will flicker or freeze.
3. A `<Sequence>` inside `<ThreeCanvas>` must use `layout="none"` (it must not output a DOM element).
4. **No physics engine running live.** Page turning, cover opening and book motion are closed-form functions of time (springs solved analytically, noise from a seeded generator). If you want the look of simulation, simulate **offline once** and store the curve in `src/config/`.
5. Randomness only from `src/lib/prng.ts` (seeded). Dust, grain, noise, paper flutter all take a seed.
6. No `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date.now()`, or network requests at render time.
7. **Every asset load blocks the render** (`delayRender` / `continueRender`, or a loader that does): textures, fonts, models, the plate. A render that starts before the plate has loaded writes black frames.
8. Textures painted in code (covers, pages) are painted once per book, cached by content hash, and disposed when their act ends (memory budget below).
9. No CSS transitions or animations, and no `backdrop-filter` (Chrome draws it wrongly under 3D transforms; same rule as `minilocker-film`).

## World units and coordinates

- **1 unit = 1 centimetre.** A hardcover trade book is 15.2 x 22.9 cm, so the numbers in code read like the real object.
- **Y is up. The desk top is the plane `y = 0`.** X runs left to right as seen from the camera at the start. The camera looks toward -Z.
- The **origin** is the front edge of the desk, at the horizontal centre of the **pile zone** (left of the chair). `plateMatch.json` (Patch 03) stores where the photograph's camera sits relative to this origin, and `placementZones.json` stores the free areas of the desk top in these units.
- Rotation order for books: Y (yaw on the desk), then X (pitch), then Z (roll). A resting book has all three small but not zero (see "imperfection", guide 03).

## The plate rig (how a flat photo hosts a 3D scene)

The photograph is the **plate**. The books are 3D. They meet at the desk surface.

1. **Plate plane.** The photo is a textured, unlit, un-tonemapped plane inside the 3D scene, at the depth of the desk's middle, facing the camera. Because it is inside the scene, the depth-of-field effect blurs it automatically as a function of its distance from the focus. (A separate 2D layer behind the canvas would need its own fake blur and would not blend with the book's blur.)
2. **Match camera.** At the first frame, the 3D camera is set so that a virtual desk plane (`y = 0`) lands exactly on the photo's desk strip (front edge, back edge, left and right ends), and the virtual lens has the photo's field of view. Patch 03 builds a lab for this (overlay + sliders) and saves `plateMatch.json`. Everything is measured against that match.
3. **Plate-follow.** When the camera moves, the plate plane moves with it by a single function, `plateTransform(cameraPose)`, so that the point on the plate where the pile sits stays registered with the 3D desk. For a dolly toward the pile this reduces to a scale; for a slide it reduces to a shift. Because the plate is flat, a large change of viewpoint cannot be faked: moves are budgeted (guide 05).
4. **Shadow catcher.** An invisible plane at `y = 0` with a shadow-only material receives the books' shadows and a faint warm reflection. It draws no desk colour of its own, so the photo's wood is what the viewer sees, darkened under each book.
5. **Occlusion.** Books must never be covered by the chair, keyboard or lamp unless physically right. The placement zones keep books where nothing in the photo is in front of them. The one exception, the chair wipe in S22, is a deliberate full-frame occluder.
6. **Pillarbox.** In S00 the plate is centred at full height; the left and right bars are the same near-black as the photo's own edges, with a feathered join (about 60 photo px). The left edge averages luminance 13/255 and the right edge about 40/255 (see `reference/desk-plate-analysis.md`), so the join is invisible when feathered. As the camera pushes in (S01), the plate's width grows past the frame width when the magnification reaches 2.6, at about frame 360, and the bars slide out of frame.

### Magnification budget (how much we may enlarge a 736 px photo)

Define **plate magnification** `M` = (on-screen width of the plate in px) / 736.

| M | Allowed | Rule |
|---|---|---|
| up to 2.6 (the whole plate fills 1920 px) | In focus | This covers S00 and the start of S01. |
| 2.6 to 5 | Only with defocus | Blur radius at least 6 px at 1080p, rising to 25 px by M = 5. |
| above 5 | Heavy bokeh only | Blur radius at least 25 px. Nothing in the photo may be read or recognised at this size. |

Depth of field is the cheat that makes this honest: the books are physically close to the camera, the wall and monitors are physically far, and a real lens at that distance blurs them. The defocus values are **starting values**, tuned in Patch 04 by looking, and the `npm run motion` audit (Patch 05) flags any frame where the plate breaks this table.

### Plate integrity test (a gate, not a nicety)

You said not to change the photo. This is how we prove it:

1. Render frame 0 with the books hidden, at `M` = 1.607 (full height in the frame, pillarboxed).
2. Crop the plate area, resize the original to the same size, and compare. **Pass when SSIM is at least 0.98** and no pixel in the lamp or LED regions moves by more than 3 levels.
3. `npm run plate:verify` also checks the original file's SHA-256 against `docs/reference/.plate.sha256` (`82aa3d3c...04b41`).

Adding grain, vignette, dust and the ending's dim happens **after** the comparison frame, and each is a named layer you can switch off.

## Colour pipeline

- Renderer output colour space: sRGB. **Tone mapping: none.** The plate material has `toneMapped = false`, so its pixels pass through unmodified. Books are lit and exposed to look right without a tone curve; highlights are controlled by light intensity and a soft clip in the finishing pass (Patch 22).
- Textures that hold colour are tagged sRGB; roughness, metalness, normal, AO textures are linear.
- Export: H.264, `yuv420p`, Rec. 709 tags, limited range (the same flags as `minilocker-film`'s `scripts/render.mjs`).

## Source layout (created across the patches)

```
src/
  index.ts  Root.tsx  ReelFilm.tsx              entry, compositions (film first, dev sheets after), master composition
  config/
    timeline.ts     sec()/beat()/bar()/f() helpers, SHOTS table (frames), CUES
    camera.ts       CameraKeyframe types, per-shot keyframe arrays (S00..S25), operator model constants
    plateMatch.json calibrated match camera (Patch 03)
    placementZones.json  free desk areas in cm (Patch 03)
    lights.ts       lamp, LED strips, fill: positions, colours, intensities, falloff
    books.ts        trim size, board thickness, page counts, spine radius, per-book design tokens
    pageSpecs.ts    the page lists per book (types only; text comes from data)
    ledger.ts       getBookLocation(bookId, frame): the continuity ledger
  data/
    site-snapshot.json    generated by `npm run sync` from the website repo
    select.ts             typed selectors; throw an error naming the missing path
    types.ts
  lib/    ease.ts spring.ts prng.ts noise.ts hash.ts fonts.ts units.ts
  plate/  Plate.tsx PlateFollow.ts ShadowCatcher.tsx Pillarbox.tsx
  light/  Rig.tsx PlateProbe.ts (environment probe from the plate)
  camera/ CameraRig.tsx operator.ts focus.ts
  book/   Book.tsx Cover.tsx PageBlock.tsx Sheet.tsx Ribbon.tsx rig/*.ts   geometry and motion
  paint/  covers/*.ts pages/*.ts qr.ts typography.ts   Canvas2D painters (pure functions -> canvas)
  scene/  Desk.tsx Pile.tsx Riser.tsx Dust.tsx
  shots/  S00.tsx ... S25.tsx   (or grouped by act)
  fx/     Grain.tsx Vignette.tsx Dim.tsx Labels.tsx Wordmark.tsx
  audio/  ReelAudio.tsx sfx.ts
  dev/    DevPlate.tsx DevMatch.tsx DevLighting.tsx DevBook.tsx DevPages.tsx DevPageTurn.tsx DevRiser.tsx ...
scripts/  sync-site.mjs  verify-plate.mjs  bench.mjs  make-stills.mjs  check-qr.mjs  audit-truth.mjs  render.mjs  make-poster.mjs
tools/    audit-motion.mjs  make-prompt.mjs  measure-plate.mjs
```

**Architecture rules** (so separate sessions fit together):

- **Components are dumb.** Props in, pixels out. `Book` takes `openAmount`, `coverAngle`, `turnProgress[]`, pose, and a `BookId`. It never reads the frame.
- **Shots are small.** A shot file provides: camera keyframes, book pose keyframes (or references to rig functions), the overlay component, and the audio cues. Nothing else. `ReelFilm.tsx` concatenates shots and does not need editing when a shot is replaced.
- **One pose function per object.** `getBookPose(bookId, frame)` returns the book's pose from the continuity ledger and the rig functions. Nobody places a book by hand elsewhere.
- **Config over code.** Timing, camera, lights, book sizes, page lists live in `src/config/`. A tweak is a number, not a refactor.

## Budgets

| Budget | Limit | Why |
|---|---|---|
| Texture memory | 1.5 GB peak (browser), so at most one book's page textures loaded at a time, others as thumbnails | Painted pages are 2048 x 3072 each |
| Page texture size | 2048 x 3072 (readable pages), 1024 x 1536 for pages that never read | Text legibility rule in guide 07 |
| Draw calls | Under 300 per frame | Real-time renderer stays predictable |
| Shadow maps | One soft key shadow (lamp) plus contact shadows | Cost and look |
| Frame time target | Under 4 s per frame at 1080p on your machine for any shot | 5400 frames at 4 s = 6 h; measure in Patch 04 |

If the bench result is far worse, the fixes in order: lower page texture size on non-read pages, reduce shadow map size, turn off the second soft shadow, render at 30 fps and interpolate (last resort; this loses the high frame rate you want).

## Dev compositions (every layer is inspectable alone)

`DevPlate`, `DevMatch`, `DevLighting`, `DevBook`, `DevCovers`, `DevPages`, `DevPageTurn`, `DevBookMotion`, `DevRiser`, `DevShotStrip`. Each is a Remotion composition registered **after** the final film in `Root.tsx`, so `ReelFilm` is always the default.

## Testing and gates

| Check | When | Pass |
|---|---|---|
| `npx tsc --noEmit` | every patch | zero errors |
| `npm run plate:verify` | every patch from 02 | checksum and SSIM pass |
| Stills of the patch's new range | every patch | You looked at them |
| **Gate G1: stills realism** | after Patch 11 | Rubric score at least 4/5 on 10 stills (guide 13) |
| **Gate G2: motion test** | after Patch 16 | S05-S13 plays at 60 fps without pops, flicker or plate tears |
| `npm run motion` | patches 05, 14-20 | No STILL over 120 f, no FAST, no DEEP, no plate-magnification violation |
| `npm run audit` | patch 23 | Every on-screen fact traced to the snapshot |
