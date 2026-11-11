# Match notes (Patch 03)

What the match camera is, which numbers were measured and which were chosen, and what is still yours to decide. The numbers live in `src/config/plateMatch.json` and `src/config/placementZones.json`; this file says why.

**Status: seed.** `plateMatch.json` holds the starting match (`"status": "seed"`): the desk edges' own horizon (y 395.6), the 233 cm scale and a level camera. It has not been looked at in the lab by you yet. After you look (see "Your steps"), paste the lab's JSON over it; the status then reads `"chosen"`.

## 1. The world and the camera

- 1 unit = 1 cm. The desk top is `y = 0`. The **origin is the front edge of the desk top at the centre of the pile zone**. X runs to the right, `Zd` runs from the front edge towards the wall, and a desk point `(X, Y, Zd)` sits at world `(X, Y, -Zd)`.
- The camera stands at `(35, 45.57, 507.88)`: 35 cm to the right of the pile centre, 45.57 cm above the desk, 507.88 cm from its front edge, looking down `-Z`. Vertical field of view 25.675 degrees over the plate's 864 px (horizontal 44.1), focal length 1895.7 plate px.
- **Pitch is 0 and the horizon is a lens shift.** The horizon sits at plate y 395.6, above the image centre (432), and the vanishing point of the desk's depth lines at x 544.7, which is 223 px left of the plate centre. A pitch would tilt the plate's vertical lines; a lens shift does not (`measured-calibration.md`, section 3).
- The scene camera never moves when the view changes. A `PlateView` (M, cx, cy) is a window cut from the camera's sensor, so a 3D object on the desk stays on the desk at every zoom and pan. The plate is a flat card square to the camera's axis, 32.5 cm behind the desk's front edge (the desk's middle), 437.8 x 246.3 cm.
- Anything taller than the card's depth that stands behind `Zd = 32.5` is hidden by the card. Both zones end at `Zd = 34` and the pile and riser stand in front of the card, so nothing in Patch 03's scope is hidden. Patch 04 must decide the card's depth write for the depth of field (see the patch notes).

## 2. Measured and chosen

| What | Value | Kind |
|---|---|---|
| Desk top front edge y; left and right corners x | 565.7; 214.3, 1084 | measured on the plate |
| Desk top back edge y; left and right corners x | 546.4; 251.8, 1022.8 | measured on the plate |
| Horizon from the desk's side edges | y 395.6 | measured (the match follows it) |
| Horizon from the ceiling and baseboard lines | y about 464 | measured, not followed (D-25) |
| Desk width and depth | 233 x 65 cm | **chosen** (design assumption) |
| Camera height 45.57 cm, distance 507.88 cm, fov 25.675 degrees | | **solved** from the rows above and the two chosen sizes |
| Pile origin and camera X (35 cm) | | **chosen**: the pile centre is the origin |
| Placement zones, extents of the lamp, keyboard, chair, speaker, headset stand | | by eye on the plate, about +-10 px |

With these numbers the desk's six measured corner values are reproduced to 0.02 px (`npm test` holds them to 0.5 px).

## 3. The chosen scale, and why

**3.73 plate px per cm at the desk's front edge**, from taking the desk as 233 cm wide. This is a **design assumption, not a measurement**: the plate is a rendering of a room of unknown size. It was kept from the first plan because everything else was sized on it (three monitors about 47 cm each, 3 books about 57 x 90 px at native size, the riser 36 x 24 cm = 135 x 90 px, both zones about 48 cm wide, the M table in guide 05).

Cross-check with the keyboard bar: the keyboard in the plate (x 553 to 670) measures **about 33 cm** at this scale, so the 40 cm bar of the lab overhangs it by about 3.5 cm each side. A full-size keyboard is about 44 cm and a tenkeyless one about 36 cm, so this scale makes the room a little small, about 10 to 25 percent. If you would rather have a real-size keyboard, set `deskWidthCm` in the lab to about 175 to 205 (books then look bigger, 4.5 to 5 px per cm). That changes every M in guide 05, the zone widths and the footprints in pixels, so it is cheapest to decide it now. The default keeps 233 cm.

## 4. The horizon (D-25), what the lab shows you

The desk's side edges converge at y 396, the room's ceiling and baseboard lines at about y 464. They cannot both be true for one camera. The lab's `lockToDesk` solves height, distance and fov for any horizon so that the desk's **front edge, back-edge height and front corners stay exact**. What it cannot keep is the back corners. Measured by the tests:

| Horizon y | Back corners off by (px, left / right) | Pile anchor moves | Camera height |
|---|---|---|---|
| 380 | 3 / 5 | 0.3 px | 49.8 cm |
| **395.6** | **0 / 0** | 0 | 45.6 cm |
| 420 | 6 / 10 | 0.8 px | 39.0 cm |
| 464 | 25 / 41 | 3 px (riser 10 px) | 27.2 cm |
| 470 | 29 / 48 | 4 px (riser 12 px) | 25.6 cm |

So following the room lines (464) costs a visibly wrong desk top at the back and a much wider lens (fov 45 degrees against 25.7), and gains a lower, flatter view of the books' tops. Books lie on the desk and the desk is what the viewer compares them with, which is why the seed follows 395.6. Look at both in the lab and answer D-25. A different horizon changes the heights of things above the desk (the lamp bulb's Y) and a little of the desk's interior; the zones were chosen with margins that absorb that.

## 5. Placement zones

Rectangles on the desk plane, in cm (origin at the pile centre):

| Zone | X | Zd | Anchor | Why |
|---|---|---|---|---|
| L (pile) | -24 to 24 | 3 to 34 | (0, 16) = plate px (418, 560.5) | between the lamp (behind and to the left) and the mat (3.5 cm away at the nearest) |
| R (riser) | 133 to 176 | 3 to 34 | (153, 16) = plate px (971.7, 560.5) | right of the chair (15 px at the nearest corner), 3.5 cm from the desk's end and from the headset stand |

- The riser footprint 36 x 24 cm at its anchor spans X 135 to 171, Zd 4 to 28, and its nearest picture point is about 26 px from the chair's edge (the test asks for 8).
- A trade book turned up to 12 degrees fits zone L.
- Exclusions (extents estimated by eye, about +-10 px): lamp, keyboard and mat (with the mouse), chair, speaker, headset stand. The patch text names a "headset stand"; the earlier notes called that object a webcam, but at high zoom it is a headset on a stand, and the id is `headset_stand`.
- The chair stands in front of the desk. Its backrest covers the desk top between plate x 740 and 872, so it is listed by its box in the picture, not by a rectangle on the desk.
- Our books stay on the desk, never on the plate's shelves (D-26).

## 6. The lamp

`plateMatch.json` carries the lamp bulb for Patch 04's key light: `X -35.33, Y 12.26, Zd 58.99` for this match, computed from the base's contact point (plate px 309.5, 548) and the height of the glow (y 507). It is recomputed whenever the match changes. At this scale the bulb is 35 cm to the left of the pile centre and 43 cm behind it, about **57 cm** from the pile's centre, not the 20 to 40 cm of guide 03. Patch 04 can tune the intensity and falloff; moving the lamp would break the match.

## 7. Your steps

1. `npm run studio`, open `DevMatch`. It opens at the pile view (M 4.49) with the grid, the zones and the 15.2 x 22.9 x 2 cm test box at the pile anchor.
2. Pick the three presets in turn (`M1.25 whole plate`, `M2.46 end of S01`, `M4.49 pile view (S02)`), and `M3.98 riser view (S23)` for the riser. The box must look planted on the desk strip each time.
3. Slide `horizonY` between 380 and 470 with `lockToDesk` ticked to see the choice of D-25 (the white rings are the measured desk corners; the read-out lists the differences).
4. Tick `showBar` for the keyboard check and `showExclusions` to see what the zones avoid.
5. When you are happy, press `Copy JSON` in the panel (or select the text) and paste it over `src/config/plateMatch.json`. If the button does nothing in the Studio, run `copy(window.__plateMatchJson)` in the browser console.
6. Take the three stills for gate G0b: `npx remotion still src/index.ts DevMatch out/match-125.png --props='{"preset":"M1.25 whole plate","showPanel":false}'`, then the same with `"M2.46 end of S01"` and `"M4.49 pile view (S02)"`.
7. Run `npm test`, `npm run plate:verify` and `npx tsc --noEmit`.

If you change the horizon or the scale, `npm test` tells you if the file's derived numbers or the zones no longer agree.
