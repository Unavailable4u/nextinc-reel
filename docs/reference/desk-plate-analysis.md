# Desk plate analysis

File: `public/plates/original/desk-plate.png` - PNG, **1536 x 864 px** (exactly 16:9), sRGB. SHA-256: see `.plate.sha256` (`3aa7af92d957fc90427f096aa6f2e7fb2ac1a3192cff17d2b1a3496381044af0`). **Read-only.**

It replaced the first photo (`public/plates/superseded/desk-plate-v1.jpg`, 736 x 672, `82aa3d3c...04b41`, unchanged, checksum in `.plate-v1.sha256`) in Patch 02a. The new image is a **re-render of the room, not a pixel extension**: the desk is 1.38x larger (front edge 869.7 px wide against 629 px) and the perspective differs, so none of the first photo's measurements carry over.

Coordinates are in plate pixels, origin top-left, **estimated by eye from the image (about +-10 px)** except where a number says "measured". Patch 03 replaces the estimates with calibrated values (`placementZones.json`, `plateMatch.json`).

## What is in the picture

Dark room, near-symmetric one-point view. Back wall with two sets of floating shelves lit from underneath by amber LED strips (statues, a framed figure, a globe-like sphere, stacks of books). A long walnut desk with drawer units and an under-desk LED glow. Three monitors (dark mountain wallpaper) with a light bar above, a keyboard on a mat, a mouse, an Edison-bulb lamp at the left end, a speaker and a webcam on a stand at the right end. A gaming chair, back to us, covers the middle right. Heavy curtain, a window and a plant at the far left; a candle on the floor at the bottom-left corner. **New in this image:** a tall, lit bookshelf along the right (x about 1150 to 1500) with books, figures, a globe, a plant, a filament lantern and a framed picture on the wall beside it; and a rug under the chair.

## Measured luminance (0-255, Rec. 709 weights)

| Region | Mean |
|---|---|
| whole image | 32.4 (p99 165.0) |
| left 30 px | 18.8 |
| left 60 px | 21.4 |
| right 30 px | 6.1 |
| right 60 px | 13.3 |
| top 30 px | 20.3 |
| bottom 30 px | 31.3 |

The plate fills the frame, so its edges are not joined to anything and need no feather or bars.

## Sampled colours (sRGB)

| Where | RGB |
|---|---|
| Edison bulb (pixels brighter than luma 200) | 249, 226, 181 |
| LED strips (pixels brighter than luma 150) | 237, 173, 104 |
| Bookshelf LED (same rule) | 238, 176, 100 |
| Desk top, mid | 98, 63, 46 |
| Back wall | 48, 47, 47 |
| Monitor (dark area) | 38, 39, 43 |
| Right wall, beside the bookshelf | 64, 46, 38 |
| Rug | 36, 34, 34 |

## Desk strip (the surface the books sit on)

Desk top, **measured**: front edge y = 565.7 (corners x = 214.3 and 1084), back edge y = 546.4 (corners x = 251.8 and 1022.8). The front apron face runs from y = 565.7 to about 580 and is NOT desk top. The visible desk-top strip is therefore **y 546 to 566, 19 px deep**.

| Zone | x range at the front edge (plate px) | Free? | Used for |
|---|---|---|---|
| **L** left | 321-515 (X = -61 to -9 cm); the lamp base ends at about x 330 and the keyboard mat starts at about x 520 | free | **the pile** (S00-S21); the lamp (globe x 280-340, y 475-530) is the key light |
| Middle | 520-875: keyboard (x 553-670, y 538-556), mouse (x 690-717), then **the chair back (x about 735-875, y 428 down)** | not used | the chair is the occluder in S22 |
| **R** right | 875-1084 (X = 92 to 144 cm); speaker at x 893-957 (y 468-548) and webcam stand at x 965-1010 (y 508-552), both **behind** the front edge | free at the front edge | **the riser**, placed at the **front edge**, in front of them, so it correctly occludes their lower parts |

Scale references (design assumptions, not measurements: the scene is a rendering of an unknown real size): the desk front edge is 869.7 px. Taking it as 233 cm gives **3.73 plate px per cm** at the front edge, three monitors about 45 cm each (they span about 532 px) and a keyboard about 31 cm. A 15.2 cm book is about 57 px wide at native size. Patch 03 fixes the scale by choosing one and recording it.

## Constraints that follow

1. The pile occupies about 57 x 90 plate px at native size (3 books, 6-7 cm tall): small in S00, which is intended.
2. The riser (36 cm wide) is about 135 plate px wide: it fits zone R (about 194 px wide at the anchor).
3. The plate has no view of the desk from above, so close-ups are done in regime R3 (book held in front of the camera). The desk top is seen at about 5 degrees.
4. The plate's shelves already hold books (left and right wall shelves, and the whole right-hand bookshelf). Our books are on the desk, never on the shelves (D-26).
5. The right-hand bookshelf is bright and busy. It is behind and to the right of the desk end, so it enters the right edge of the S23 riser frame; keep it in deep defocus (guide 05).
6. The right-hand shelf holds a helmet that closely resembles a licensed film character. Confirm the image's rights before publishing (D-27, `plate-licence.md`).

## Magnification (M = on-screen plate width / 1536)

| M | Meaning |
|---|---|
| 1.25 | the whole plate fills the 1920 x 1080 frame (opening shot, fit height = fit width) |
| 1.319 | the 40 px edge margin starts to restrict the camera |
| 2.5 | a 4K frame at the opening view |
| 2.6 | end of the in-focus budget (S01 ends at 2.46) |
| 3.98 | riser view: about 194 px x 3.98 = 772 px |
| 4.49 | pile view (S02 end) |
| 6.51 | R3 backdrop (only soft shapes remain) |
