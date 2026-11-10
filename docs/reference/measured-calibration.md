# Measured calibration of the desk plate (input for Patch 03)

Written during Patches 00-02 and redone in Patch 02a for the 1536 x 864 plate. Read this before running Patch 03 (`docs/patches/P03-match-lab.md`). Nothing here is used by the film yet; it saves the match lab hours. **The numbers of the first photo (736 x 672) no longer apply.**

Files: `calibration-seed/calibration-seed.json` (the numbers), `calibration-seed/plateCamera.seed.ts` (a tested reference implementation), `calibration-seed/calibration-overlay.jpg` (the fitted desk drawn on the plate), `tests/calibration-seed.test.ts` (run by `npm test`).

## 1. What was measured, and how

The plate (1536 x 864) was brightened for inspection only (the original was never touched), gridded, and these were read off:

| What | Plate px |
|---|---|
| Desk top, front edge | y = 565.7; left corner x = 214.3, right corner x = 1084 |
| Desk top, back edge (where it meets the LED glow) | y = 546.4; left x = 251.8, right x = 1022.8 |
| Front apron (the vertical face under the desk top) | y = 565.7 to about 580 |
| Where the desk's two side edges converge | y about 396: the **horizon** from the desk edges |
| Where the room's ceiling and baseboard lines converge | y about 464: a second horizon (see the warning in section 3) |

## 2. The fitted camera

A pinhole camera, looking level, principal point at (544.7, 395.6), focal length 1895 plate px, 45.6 cm above the desk top, 508 cm from its front edge, with a desk top 233 cm wide and 65 cm deep. Only the front corners, the front edge and the horizon were used in the fit.

**Cross-checks that were not used in the fit:**
- The hidden back corners are predicted at x = 251.7 and 1022.3 (y = 546.4). Measured: 251.8 and 1022.8 (y = 546.4). `npm test` holds the model to 2.5 px.
- `npm test` proves the same camera, built in three.js with `setViewOffset`, projects desk points to the same screen pixel as the formulas, to 0.01 px, for random zooms (1.25 to 8.25) and pans. (That is the mechanism to keep a 3D book on the desk while a window slides over the plate.)

`calibration-overlay.jpg` shows the fitted desk over the brightened plate: yellow = desk top, cyan grid = 10 cm, green = free zones, red = chair, cyan rings = the measured back corners, white dots = the anchors, magenta and orange lines = the two horizon candidates.

## 3. What this means for the Patch 03 sliders (height, distance, FOV, pitch)

- **Vertical FOV about 25.7 degrees** (horizontal about 44.1), from f = 1895 and the 864 px height.
- **Pitch about 1.09 degrees DOWN, or a pure lens shift.** The horizon is at y = 395.6, above the image centre (432). The plate's vertical lines stay vertical, so a pure lens shift reproduces it better than a tilt: the principal point sits at x = 544.7, **223 px left of the plate centre**, as well as 36 px above it. Do not start the lab with the horizon at the centre: the desk's depth lines will not converge where the plate's do.
- **The horizon is uncertain (D-25).** The desk edges put it at y = 396; the room's ceiling and baseboard lines point to y about 464. The seed follows the desk edges because the books sit on the desk. Let the lab slide the horizon between 380 and 470 and choose by eye.
- Camera height about 45.6 cm and distance about 508 cm are **design assumptions** (the plate has no known real size). They keep the desk 233 cm wide, three monitors about 47 cm each and the keyboard about 31 cm. If you prefer another scale, scale height, distance and the desk size together; the picture does not change.
- Suggested anchors: pile at X = -35, Zd = 16 (about plate px 418, 561), riser at X = 118, Zd = 16 (about 971, 561). Both free zones are about 52 cm wide.
- The desk top is only about 19 px deep in the plate (y 546-566). Books lying flat are seen at about 5 degrees: you will see mostly their fore-edges and spines, little of their covers. This is why the hero shots (R3) hold the book in front of the camera rather than on the desk.
- **Converting the first plan's M values:** multiply by 0.7233 (the desk's front-edge width ratio, 629 / 869.7). The opening shot is the exception: it is 1.25 (the whole plate).

## 4. Things the build found in the guides (not errors in your files, but you will hit them)

1. **The Mini Me film poster shows `minime.app`.** Guide 07 warns about `cover.webp`; the film poster `films/mini-me-chat-film.webp`, which S12 uses, carries the same "Try MiniMe" button and address. `npm run sync -- --copy-media` does not copy either. See D-20.
2. **`src/lib/fonts.ts` was pasted by Patch 08 but created by no patch.** Patch 00 now creates it. Patch 08's `typography.ts` should import it.
3. **Patch 01 said media goes to `public/site/`, Patch 08 expects fonts in `public/fonts/`.** Images go to `public/site/`, fonts to `public/fonts/`.
4. **Riser labels:** guides 01 (S23) and 04 show `MiniMe` / `SPHEREx`; `content/books.md` says the data's title. The selectors follow `content/books.md`. See D-23.
5. **`EDGE_MARGIN = 40`** is the camera's margin from the plate's edge (guide 05). Patch 02's text also called the 60 px feather by a similar name; the code keeps them as two constants (the feather is 0 now).
6. **Desk top versus apron:** the visible strip under the desk's front edge is the apron face, not desk top. On this plate the desk TOP is y 546-566; use that for anything that must sit ON the desk.

## 5. How to use this in Patch 03

Paste this file and `calibration-seed.json` into the session alongside the patch prompt. The assistant can start the lab from the seed values and tune by eye, instead of from placeholders. `plateCamera.seed.ts` may be lifted into `src/plate/` whole: it is self-contained and its test already runs.
