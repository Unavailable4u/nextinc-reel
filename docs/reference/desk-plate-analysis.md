# Desk plate analysis

File: `public/plates/original/desk-plate.jpg` - JPEG, **736 x 672 px**, 72 dpi, sRGB. SHA-256: see `.plate.sha256` (`82aa3d3c859fd182689bf509338271f1097e1781b9ff94cf9ea7793418f04b41`). **Read-only.**

Coordinates are in photo pixels, origin top-left, **estimated by eye from the image (about +-10 px)** except where a number says "measured". Patch 03 replaces the estimates with calibrated values (`placementZones.json`, `plateMatch.json`).

## What is in the picture

Dark room, near-symmetric one-point view. Back wall with two sets of floating shelves lit from underneath by amber LED strips (statues, a framed picture on the right wall, a stack of books on the right shelf). A long walnut desk with an under-desk LED glow. Three monitors (dark mountain wallpaper), a keyboard on a mat, a mouse, an Edison-bulb lamp at the left end, a speaker and a small headset stand at the right end. A gaming chair, back to us, covers the middle. Heavy curtain at the far left.

## Measured luminance (0-255, Rec. 709 weights)

| Region | Mean |
|---|---|
| whole image | 33.9 (p99 160.7) |
| left 30 px | 13.3 |
| left 60 px | 17.0 |
| right 30 px | 38.3 |
| right 60 px | 40.0 |
| top 30 px | 13.5 |
| bottom 30 px | 35.0 |

So the left and top edges are almost black and the right edge is dark brown: a feathered black pillarbox joins invisibly (guide 02).

## Sampled colours (sRGB)

| Where | RGB |
|---|---|
| Edison bulb | 240, 206, 160 |
| LED under the desk / shelf glow | 235, 175, 123 |
| Desk top, mid | 96, 63, 48 |
| Back wall | 58, 62, 63 |
| Monitor (dark area) | 40, 41, 46 |
| Right wall | 6, 5, 1 |
| Rug | 52, 52, 50 |

## Desk strip (the surface the books sit on)

Visible desk-top strip: **y about 455 (back edge) to 492 (front edge)**, **x about 58 to 692**.

| Zone | x range (photo px) | Free? | Used for |
|---|---|---|---|
| **L** left | 150-280 (between the lamp and the keyboard mat); a little more at 58-100 | free | **the pile** (S00-S21); the lamp is at x 105-150 and is the key light |
| Middle | 280-545 | keyboard, mat, mouse, then **the chair back (x 320-545, y 365 down)** | not used; the chair is the occluder in S22 |
| **R** right | 545-690 | speaker at x 555-595 (y 395-462), headset stand at x 600-640 (y 430-470), both **behind** the front edge | **the riser**, placed at the **front edge**, in front of them, so it correctly occludes their lower parts |

Estimated scale references (design assumptions, not measurements: the scene is a photograph of an unknown real size): three monitors span about 390 px; if each is a 27 in monitor (about 61 cm wide), the desk-level scale is about 2.1-2.5 photo px per cm, so a 15.2 cm book is about 36 px wide at native size. The keyboard (about 112 px wide) agrees if it is about 45 cm. Patch 03 fixes the scale by choosing one and recording it.

## Constraints that follow

1. The pile occupies about 40 x 60 photo px at native size (3 books, 6-7 cm tall): small in S00, which is intended.
2. The riser (36 cm wide) is about 80-90 photo px wide: it fits zone R (145 px).
3. The photo has no view of the desk from above, so close-ups are done in regime R3 (book held in front of the camera).
4. The photo's shelves already hold books (right shelf, x 462-545, y 213-262). Our books are on the desk, never on the shelves.

## Magnification (M = on-screen plate width / 736)

| M | Meaning |
|---|---|
| 1.607 | whole photo at full 1080 px height (pillarboxed) |
| 2.609 | plate width = 1920 px (no pillarbox) |
| 5.5 | riser view: 145 px x 5.5 = about 800 px |
| 9 | R3 backdrop (only soft shapes remain) |
