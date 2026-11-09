# 05 - Camera and motion

The camera is a **person** (a viewer who walks to a desk and reads), not a drone. The photo is flat, so the camera has a budget of moves it can make convincingly. This guide gives the budget, the operator model, and per-shot numbers.

## 1. What the flat photo allows (the budget)

| Move | Allowed | Limit | Why |
|---|---|---|---|
| Dolly in / out (toward the desk) | Yes | Up to **x6.5** scale from the opening view, in the stages in section 4 | The plate scales as one flat card; defocus hides the lost detail |
| Slide sideways (truck) | Yes, when zoomed | Only while the plate is larger than the frame; never past the plate's edges (keep **40 photo px** of margin) | There is nothing beyond the photo |
| Pan (turn left/right) | Small | At most **+-4 degrees** | Larger pans reveal that the plate is a card |
| Tilt (look up/down) | Small | At most **+-3 degrees** while the plate is visible | The photo's desk strip must stay at the right angle |
| Roll | Tiny | +-1.2 degrees (hand-held feel) | |
| Orbit around the desk | **No** | - | There is no back side to the photo |
| Look down at the desk top | **No** (use R3 instead) | - | The photo has only a thin strip of desk |

**The way around the limits** is regime R3: the book is lifted *in front of the camera*, at reading distance, with the plate reduced to a defocused glow. In R3 the camera is free to tilt and drift, because the plate is no longer a readable picture. All close-up work happens in R3.

## 2. Camera regimes

| Regime | Used in | Plate | Camera freedom |
|---|---|---|---|
| **R1** Establishing | S00 | 1:1 pillarboxed, in focus | micro-drift only |
| **R2** Plate-follow | S01-S03, S15, end of S21, first half of S22 | scales and shifts with the camera, growing defocus | within the budget above |
| **R3** Hero | S04-S14, S16-S21 | a defocused backdrop (the plate scaled so large that only soft amber and dark shapes remain) | free: orbit +-12 degrees, tilt +-15 degrees, roll +-3 |
| **R4** Truck / display | second half of S22, S23-S25 | pans, zoomed in, defocus on all but the riser | slide + settle |

**Handover R2 to R3 (S04):** the book rises and fills the frame; as it passes 55% of frame height the plate's magnification jumps (hidden behind the book) from about 5x to about 9x, and the defocus goes to its maximum. The jump is hidden by the book's body and the blur. Verify with `npm run motion` that no frame shows a pop larger than 2% in the plate's visible edge.

## 3. The operator model

A camera held by a person is never a mathematical path. Apply this model on top of the authored keyframes (`src/camera/operator.ts`), with all noise from `src/lib/noise.ts` seeded:

| Layer | Amplitude | Frequency | Applies in |
|---|---|---|---|
| Breathing (vertical) | 0.35 cm, 0.08 degrees | 0.28 Hz | everywhere |
| Walking bob (vertical) | 0.9 cm, 0.25 degrees | 1.8 Hz (two steps per second) | S01 only, fading out over 40 frames at arrival (frame 440-480) |
| Walking sway (lateral) | 0.6 cm | 0.9 Hz | S01 |
| Micro tremor | 0.12 cm | 7 Hz | R3 only, subtle |
| Lean-in | 3 cm forward, 0.6 degrees down | 1.0 s ease | S02 arrival, S04 reach |
| Reach dip | 2 cm down | 0.4 s | S04 (a viewer reaching for the book) |
| Settle after reach | 0.7 cm up, damped | 0.6 s | S04 |

**Time scale rule:** nothing lasts shorter than **6 frames** (0.1 s) at 60 fps or it reads as a glitch.

## 4. Per-act camera keyframes (starting values)

`scale` is the plate magnification `M` from guide 02 (1.607 = the whole photo at full height). The authoritative copy is `src/config/camera.ts`; this table is what you hand to Patch 14-20. Positions are in the world units of guide 02 relative to the pile-zone origin; `focus` is the focus distance in cm.

| Shot | Frames | Camera move | Start M | End M | Focus (cm) | Aperture |
|---|---|---|---|---|---|---|
| S00 | 0-239 | micro push 2.5% | 1.607 | 1.65 | all in focus | f/8 |
| S01 | 240-479 | arc toward the lamp side, walking bob, ease-in | 1.65 | 3.4 | 260 to 120 | f/4 |
| S02 | 480-839 | slow down, lean in, focus pull to the pile | 3.4 | 6.2 | 120 to 38 | f/2.8 |
| S03 | 840-959 | drift 1.5 cm, 3% push | 6.2 | 6.4 | 36 | f/2.8 |
| S04 | 960-1079 | reach dip, R2 to R3 handover | 6.4 | 9 (hidden) | 36 to 30 | f/2 |
| S05 | 1080-1439 | slow orbit +-8 degrees, 4% push | - | - | 30 | f/2 |
| S06-S09 | 1440-1919 | tilt down 10 degrees to read the open book, then drift down the page | - | - | 32 | f/2.8 |
| S10 | 1920-2039 | pull back 6 cm to take the whole page block | - | - | 36 | f/2.8 |
| S11-S13 | 2040-2759 | square-on to the right page; push 4% per spread; **steady during QR hold** (no roll, no tremor) | - | - | 28 | f/2.8 |
| S14 | 2760-2879 | pull back to the whole closing book | - | - | 38 | f/2.8 |
| S15 | 2880-2999 | R3 to R2: the camera looks over the book to the desk; M rises from 9 to 6.4 | 9 | 6.4 | 40 | f/2.8 |
| S16-S21 | 3000-3959 | same as S04-S14 but 30% faster | | | | |
| S22 | 3960-4319 | pull back to M = 3.4, truck right (about +330 photo px), pass the chair (frames 4140-4199 are the occluder) | 6.4 | 3.4 then 5.2 | 90 to 50 | f/2.8 |
| S23 | 4320-4799 | settle and push 6% on the riser | 5.2 | 5.5 | 50 | f/4 |
| S24 | 4800-5279 | push 3%, exposure -1.5 stops | 5.5 | 5.65 | 50 | f/2.8 |
| S25 | 5280-5399 | hold with micro-drift; fade | 5.65 | 5.65 | 50 | f/2.8 |

Why M = 5.2 to 5.5 on the riser: the riser lives in the plate's right zone, 145 photo px wide. 145 px x 5.5 = 800 px, roughly 40% of the frame width. The books fill the centre, the dark wall and soft speaker bokeh surround them. If the riser looks too small, raise M, never lower the defocus.

## 5. Easing and spring vocabulary

Authoritative copy: `src/lib/ease.ts`, `src/lib/spring.ts`.

| Name | Curve | Use |
|---|---|---|
| `signature` | cubic-bezier(0.65, 0, 0.35, 1) | the default for any authored move |
| `arrive` | cubic-bezier(0.22, 0.8, 0.2, 1) (the site's `--ease`) | an arrival that slows at the end |
| `lift` | cubic-bezier(0.3, 0, 0.2, 1) | book lift |
| spring `cover` | damping ratio 0.6, 3.2 Hz natural | cover opening |
| spring `settle` | damping ratio 0.45, 6 Hz natural | set-down rebound |
| spring `book-sway` | damping ratio 0.9, 1.2 Hz | follow-through on held book |

**Linear motion is only for** dust, grain and the page riffle's overall rate. Everything else eases.

## 6. Motion rules (the film's own, inherited and extended)

1. **No shot is still.** A hold over 60 frames (1 s) at 60 fps has an authored drift (a 3% push or a 1.5 cm slide). The operator model is the floor, not a substitute. (The earlier film used 60 frames at 30 fps = 2 s; at 60 fps a still hold is noticed sooner, so the limit is 1 s.)
2. **Moves have length.** A camera move takes at least **48 frames** (0.8 s). Hold at least 20 frames between moves.
3. **Speed limits.** Peak lateral camera speed: 40 cm/s in R2, 10 cm/s in R3. Peak change of plate magnification: 1.5 x per second.
4. **Everything lands on a beat.** Cuts, lifts, page landings, label arrivals: multiples of 30 frames. Only continuous drifts are off-beat.
5. **Never leave the photo.** The camera window must stay inside the plate with the 40 px margin (except in pillarbox, where the bars are intentional).
6. **Text the viewer must read is held at least 2 s** (guide 07), and the camera is not rolling then.
7. **QR hold:** the QR page is square-on within 4 degrees, flat, sharp, for at least 90 consecutive frames.
8. **No `backdrop-filter`.** Defocus the plate with the depth-of-field effect (in-scene), not with a CSS filter.
9. **Run `npm run motion` and look at the contact sheets before every hand-over.** Paste its summary into the patch notes.

## 7. What `npm run motion` reports (Patch 05)

`STILL` (a hold over 60 f with less than 0.5% movement), `FAST` (a speed limit broken), `DEEP` (plate magnification above the budget while the plate is not defocused enough), `EDGE` (the camera window leaves the plate margin), `POP` (a plate or book position jump over 2%), `LATE` (an authored event not on a beat). Zero of each is the target; a deliberate exception is written in `docs/PATCH_NOTES.md` with the frame.
