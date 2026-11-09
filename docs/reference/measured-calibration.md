# Measured calibration of the desk plate (input for Patch 03)

Written during Patches 00-02. Read this before running Patch 03 (`docs/patches/P03-match-lab.md`). Nothing here is used by the film yet; it saves the match lab hours.

Files: `calibration-seed/calibration-seed.json` (the numbers), `calibration-seed/plateCamera.seed.ts` (a tested reference implementation), `calibration-seed/calibration-overlay.jpg` (the fitted desk drawn on the photo), `tests/calibration-seed.test.ts` (run by `npm test`).

## 1. What was measured, and how

The photo (736 x 672) was brightened for inspection only (the original was never touched), gridded at 5-10 px, and these were read off by eye:

| What | Photo px |
|---|---|
| Desk top, front edge | y = 483.5; left corner x = 59, right corner x = 688 |
| Desk top, back edge (where it meets the LED glow) | y = 457; left x = 98, right x = 650 |
| Front apron (the vertical face under the desk top) | y = 483.5 to about 495 |
| Where the desk's two side edges converge | y about 264 (right) and 272 (left): the **horizon** |

## 2. The fitted camera

A pinhole camera, looking level, principal point at (368, 268), focal length 1263 photo px, 80 cm above the desk top, 468 cm from its front edge, with a desk top 233 cm wide and 65 cm deep. Only the front corners, the front edge and the horizon were used in the fit.

**Cross-checks that were not used in the fit:**
- The hidden back corners are predicted at x = 96.7 and 649.0 (y = 457.6). Measured: 98 and 650 (y = 457). Error about 1.3 px.
- The lamp's base comes out 11.4 cm wide, the speaker 16.4 cm: believable sizes.
- `npm test` proves the same camera, built in three.js with `setViewOffset`, projects desk points to the same screen pixel as the formulas, to 0.01 px, for random zooms and pans. (That is the mechanism to keep a 3D book on the desk while a window slides over the photo.)

A render of the fitted desk over the photo (`calibration-overlay.jpg`): yellow = desk top, cyan grid = 10 cm, green = free zones, red = chair, cyan rings = the hand-measured back corners. The yellow outline sits on the real desk edge.

## 3. What this means for the Patch 03 sliders (height, distance, FOV, pitch)

- **Vertical FOV about 29.8 degrees** (horizontal about 32.5), from f = 1263 and the 672 px height.
- **Pitch about 3.1 degrees DOWN.** The horizon is at y = 268, above the image centre (336). A level camera with a vertical lens shift, or a camera tilted down 3.1 degrees, both reproduce it; the photo's verticals stay vertical to within about 4 px over 300 px, so either is fine. Do not start the lab with pitch 0 and the horizon at the centre: the desk's depth lines will not converge where the photo's do.
- Camera height about 80 cm and distance about 468 cm are **design assumptions** (the photo has no known real size). They were chosen so three monitors come out about 45 cm each and the keyboard about 32 cm. If you prefer another scale, scale height, distance and the desk size together; the picture does not change.
- Suggested anchors: pile at X = -80, Zd = 14 (about photo px 158, 476), riser at X = 93, Zd = 15 (about 608, 476).
- The desk top is only about 27 px deep in the photo (y 457-484). Books lying flat are seen at a grazing angle of about 14 degrees: you will see mostly their fore-edges and spines, little of their covers. This is why the hero shots (R3) hold the book in front of the camera rather than on the desk.

## 4. Things the build found in the guides (not errors in your files, but you will hit them)

1. **The Mini Me film poster shows `minime.app`.** Guide 07 warns about `cover.webp`; the film poster `films/mini-me-chat-film.webp`, which S12 uses, carries the same "Try MiniMe" button and address. `npm run sync -- --copy-media` does not copy either. See D-20.
2. **`src/lib/fonts.ts` was pasted by Patch 08 but created by no patch.** Patch 00 now creates it. Patch 08's `typography.ts` should import it.
3. **Patch 01 said media goes to `public/site/`, Patch 08 expects fonts in `public/fonts/`.** Images go to `public/site/`, fonts to `public/fonts/`.
4. **Riser labels:** guides 01 (S23) and 04 show `MiniMe` / `SPHEREx`; `content/books.md` says the data's title. The selectors follow `content/books.md`. See D-23.
5. **`EDGE_MARGIN = 40`** is the camera's margin from the photo's edge (guide 05). Patch 02's text also called the 60 px feather by a similar name; the code keeps them as two constants.
6. **Desk-plate analysis:** it gives the visible desk strip as y 455-492. The desk TOP is y 457-484; the rest is the front apron face. Use 457-484 for anything that must sit ON the desk.

## 5. How to use this in Patch 03

Paste this file and `calibration-seed.json` into the session alongside the patch prompt. The assistant can start the lab from the seed values and tune by eye, instead of from placeholders. `plateCamera.seed.ts` may be lifted into `src/plate/` whole: it is self-contained and its test already runs.
