# 03 - Realism bible

Goal: a viewer should believe a camera was in that room. This file lists the cues that create that belief, with **starting values**. Starting values are tuned by eye in Patches 04, 07 and 22; the numbers give you a place to start, not a law.

## 1. The light is already in the photograph. Use it.

Never invent a light that the photo does not justify. The plate shows four sources. Sampled colours (sRGB, from the original file):

| Source | Where in the photo | Colour sampled | Role for the books |
|---|---|---|---|
| **Edison lamp** (the bulb) | left end of the desk, x about 105-150, y about 405-465 | bulb (240, 206, 160), glass warm amber | **Key light** for the pile. Warm, about 2300 K, falls off fast. |
| **LED strips under the shelves and behind the desk edge** | along the wall, y about 222, 285, and the glow line at y about 455 | (235, 175, 123) | **Rim / back light**. A thin amber line behind the pile: it outlines page edges and cover corners. |
| **LED under the desk top** | under the front edge | warm, dim | **Bounce / kicker** from below: a faint warm glow on the lower edges of books and on the desk's front. |
| **Monitors** | three screens, mostly dark mountains | (40, 41, 46) | Very low **cool fill**, only visible as a slight blue-grey in the deepest shadows. |

Light rig (Patch 04, `src/config/lights.ts`):

- **Key:** a point light at the lamp's bulb position (from `plateMatch.json`), colour `#F0CEA0`, with a **physically falling** intensity (inverse-square). The pile is about 20-40 cm from the lamp, so the left side of each book is noticeably brighter than the right. That gradient is the single biggest "this is lit by that lamp" cue. Casts the main soft shadow (PCF soft or variance shadow map, radius tuned so the penumbra is about 1-2 cm).
- **Rim:** a thin rectangular area light along the back of the desk, colour `#EBAF7B`, aimed forward and slightly down. Area lights do not cast shadows in real-time Three.js; that is fine, since a rim does not need to.
- **Kicker:** a very dim warm area light under the front edge, pointing up.
- **Fill:** a cool, very dim hemisphere light so shadows are not dead black (`#28292E`, intensity about 0.04 of the key). Dead black reads as a cut-out.
- **Practical highlights:** the specular on foil and glossy spots must pick up the lamp and the strips. For that, build an **environment probe from the plate itself** (see section 7).

**Keep the exposure honest.** The photo's brightest areas are the bulb and the strips (p99 luminance about 160/255); the average luminance is only about 34/255. The books live in that range. A book as bright as the bulb looks pasted on.

## 2. Contact is everything

A book that is not convincingly **touching** the desk looks like a sticker.

- **Contact shadow:** a very dark, tight shadow (1-3 mm) right at the book's base, fading over 1-2 cm. Use ambient occlusion in the post chain *and* a baked contact-shadow decal under every resting book.
- **Soft cast shadow:** from the key, longer and lighter, going away from the lamp (to the right and slightly back).
- **Reflection:** the desk is polished walnut. Under each book there is a faint warm, blurred reflection (a few percent, fading in about 1 cm). The shadow-catcher plane (guide 02) carries it.
- **Pile contact:** each book in a pile shows a thin dark line where it meets the one below, and a slight **lateral offset** (see imperfection).
- **Lifted books:** as a book rises, its shadow on the desk and on the other books **softens and offsets** with height. A book at 15 cm has a shadow about 4x softer than one at 1 cm.

## 3. Materials

All values are starting points for a metal/rough PBR material in Three.js.

| Part | Look | Starting values / technique |
|---|---|---|
| **Bookcloth cover** | woven fabric, slightly matte | base colour per project; roughness 0.85; a tiling **weave normal map** at about 40 threads/cm of cover (visible only at close range); a very faint colour variation noise; **sheen** 0.3-0.5 to catch the lamp at grazing angles |
| **Foil stamping** (title, logo, rules) | gold/rose/silver, bright, mirror-ish | metalness 1.0; roughness 0.25-0.35; **foil is slightly debossed**: add a 0.2 mm inward step in the normal map; reflects the plate probe, so it flares when the angle is right |
| **Cover board edges** | square, slightly rounded, cloth wrapped | bevel 0.8 mm radius on the geometry so edges catch a highlight; this alone removes much of the "CG box" look |
| **Spine** | rounded (about 3 cm radius of curvature on a 2 cm spine) | cloth with a visible hinge groove where the board meets the spine |
| **Page block** | thousands of sheets | a solid slab, with a **fore-edge texture** of fine horizontal lines and subtle yellowing near the edges; a gentle irregular edge (real page blocks are not planar) |
| **Individual sheets** (the ones that turn) | paper 80-100 gsm | white at about (0.93, 0.91, 0.87) base colour; roughness 0.9; slight warm tint; **translucency**: when backlit by the lamp, the sheet glows warm (see guide 06) |
| **Headband and ribbon** | cloth ribbon, crimson `#C0102C` | roughness 0.8; the ribbon lies in the gutter and hangs out the bottom 3 cm; tiny curve |
| **Endpapers** | patterned, from the project's palette and motif | generated art, matte, 0.9 roughness |
| **Riser (display)** | walnut, close to the desk's wood | wood grain texture sampled for colour from the plate's desk (96, 63, 48) with a sharper, finer grain than the photo |

**Foil is where realism is won or lost.** A flat gold colour looks like a game. A metallic material that reflects a moving environment looks like a book. Do the specular sweep in S05 by moving the *book* (a 5 degree yaw), not the light.

## 4. Lens and depth of field

Treat the virtual camera as a real one: full-frame equivalent, **35 mm** for R2 (approach), **50 mm** for R3 (the book in hand) and **35 mm** for R4. Aperture about **f/2** in R3, **f/2.8** in R2. The depth-of-field effect (Patch 04) uses three numbers per shot: **focus distance**, **focal length**, **aperture**. Focus pulls are keyframed, like everything else (`config/camera.ts`).

| Shot | Focus on | Aperture | Result |
|---|---|---|---|
| S00 | the whole photo | f/8-equivalent (everything sharp) | the photo, as it is |
| S01 | the far wall, drifting to the desk | f/4 | the wall softens |
| S02 | the pile | f/2.8 | wall and monitors defocused; the pile crisp |
| S03 | the page edges of the stack | f/2.8 | micro-detail visible |
| S04-S05 | the cover | f/2 | the background is a bokeh of amber bars and dark blocks |
| S06-S09 | the open pages (gutter to outer edge, so a deeper aperture) | f/2.8 | both pages readable |
| S11-S13 | the screenshots, then the QR | f/2.8 | the QR is sharp across the whole code |
| S22 | follows the chair edge then the riser | f/2.8 | smooth hand-over |
| S23 | the four book covers (a row, same depth) | f/4 | all four sharp |
| S24 | the riser, falling off | f/2.8 | the wordmark sits over a soft background |

**Bokeh shape:** circular, with a faint rim, slightly cat's-eye towards the corners if the effect allows. The amber LED strips become **long soft bars** (they are lines, not dots), which is exactly how they look in a real fast lens. This is the signature of the film.

## 5. Physical cues of motion

People read weight from motion before they read it from shading.

- **Anticipation and settle.** Nothing starts or stops instantly. A lift begins with a 6-frame press (1 mm down), then rises. A set-down ends with a 4-6 frame settle (0.3 mm of rebound).
- **Springs, not lerps.** Cover opening: damped spring, damping ratio about 0.6, so it overshoots by about 3 degrees and returns. Paper: see guide 06.
- **Hand-held sway** on a held book: two noise layers, 0.3 Hz at 0.4 degrees and 1.1 Hz at 0.15 degrees, with 0.8 mm position noise. A held book that is perfectly steady looks like a rendering.
- **Secondary motion.** The ribbon swings a little when the book moves. Dust motes drift in the lamp cone and swirl when the book lifts (a small seeded force field, no physics engine).
- **Parallax.** Even a 3-5 cm camera slide makes the books move against the defocused plate. That parallax is cheap and strong.

## 6. Imperfection (the anti-CG list)

Perfect things look fake. Every one of these is a number in `config/books.ts` and a seeded random, so it is repeatable:

- The pile's books are **askew**: yaw offsets of +3, -2, +1 degrees; lateral offsets of 3-8 mm; slightly different thicknesses (each book has its own page count).
- Covers have **tiny differences in wear**: faint rubbing on the corners (a corner-wear alpha map), the lightest dust film on the top surface of the top book, and one or two micro-scuffs.
- The page block is **not perfectly flat**: a 0.5 mm bow, and page edges differ by up to 0.3 mm at the fore-edge.
- Text on printed pages has **slight ink gain** (letters about 3% heavier at corners), and the paper has a faint grain.
- The ribbon is a little **kinked**, not a straight line.
- No two lights are identical in colour or intensity over time: the lamp has a 0.5% flicker, seeded and slow (not strobing). (Do not animate anything *in the photo*; only our own lights.)

## 7. Plate probe: reflections that belong to the room

Foil and glossy surfaces need something to reflect. Real-time Three.js can use an **environment map**. Build one from the photo so reflections are the room's own:

1. From the plate, make a heavily blurred, low-resolution copy (about 128 x 128, in `plates/derived/probe-front.png`), gamma-correct, and keep the amber strips (they are the brightest thing).
2. Make a cube map: the **front** face is that blurred plate; the left, right, top, bottom and back faces are dark warm gradients (the curtain on the left, the wall on the right, the dark ceiling). The camera-side (back) face is very dark.
3. Use it as the scene's environment with a low intensity (about 0.6) and a **separate, brighter, tiny emissive** version of the lamp so the foil sparkles.

This takes an afternoon and is the best realism investment after contact shadows.

## 8. Finishing (Patch 22)

Applied in this order, each a layer with its own switch:

1. **Bloom**: subtle, on the lamp and strips only (threshold high). Strength about 0.15.
2. **Halation**: a faint warm halo around highlights (optional).
3. **Chromatic aberration**: at most 0.5 px at the frame corners, in R2 and R4 only.
4. **Vignette**: 12-16%, darker at the corners.
5. **Grain**: 2-3% opacity, **re-seeded every frame** (fixed pattern grain looks like dirt on the screen).
6. **Colour grade**: nudge the books' black point so it matches the photo's black point; matching shadow colour (a touch of warm brown, never pure black) is the glue between the real photo and the generated books.
7. **Soft clip** at the top so the lamp does not clip into a flat white disc.

## 9. Things that always read as CG

Fix these on sight:

| Looks fake | Because | Fix |
|---|---|---|
| Razor-sharp edges on boards and pages | no real object has a perfect edge | 0.8 mm bevel; slightly soften the specular at edges |
| Shadows all the same hardness | real shadows soften with distance | contact shadow + soft cast shadow; shadow radius grows with height |
| Perfect symmetric stack | people do not stack that way | askew offsets (section 6) |
| Floating books | no contact shadow | contact decal, AO |
| Pure black shadows | no bounce | fill light, warm black |
| Over-saturated covers | print is slightly dull in warm light | reduce saturation 10-15%, let the lamp tint it |
| Text that is razor crisp at all angles | print has ink gain and paper grain | tiny noise, 3% gain, anisotropic filtering 16 |
| Linear motion | nothing in life moves linearly | springs, signature ease `cubic-bezier(0.65, 0, 0.35, 1)` |
| A still camera | a camera held by a person drifts | operator model (guide 05) |
| Too-clean backgrounds | cameras add noise | grain |

## 10. The Reality Rubric (used at Gate G1 and in QA)

Score each of 10 stills from 0 to 5 on each of the five lines; the sum divided by 5 is the still's score. **Pass at G1: average of 4.0 or more, and no still below 3.**

1. **Contact and grounding** (shadows, reflection, weight)
2. **Light that belongs to the room** (direction, colour, falloff match the photo)
3. **Material truth** (cloth, foil, paper read as such)
4. **Imperfection and scale** (nothing too clean; sizes plausible against the keyboard, lamp)
5. **Lens** (depth of field, grain, bloom, edges)

A short list of scoring examples goes in `docs/guide/13-qa-and-acceptance.md`.
