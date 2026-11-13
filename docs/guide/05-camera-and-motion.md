# 05 - Camera and motion

The camera is a **person** (a viewer who walks to a desk and reads), not a drone. The photo is flat, so the camera has a budget of moves it can make convincingly. This guide gives the budget, the operator model, and per-shot numbers.

## 1. What the flat photo allows (the budget)

| Move | Allowed | Limit | Why |
|---|---|---|---|
| Dolly in / out (toward the desk) | Yes | Up to **x6.5** scale from the opening view, in the stages in section 4 | The plate scales as one flat card; defocus hides the lost detail |
| Slide sideways (truck) | Yes, when zoomed | Only while the plate is larger than the frame; never past the plate's edges (keep **40 photo px** of margin). Below M = 1.319 there is no room to slide at all | There is nothing beyond the photo |
| Pan (turn left/right) | Small | At most **+-4 degrees** | Larger pans reveal that the plate is a card |
| Tilt (look up/down) | Small | At most **+-3 degrees** while the plate is visible | The photo's desk strip must stay at the right angle |
| Roll | Tiny | +-1.2 degrees (hand-held feel) | |
| Orbit around the desk | **No** | - | There is no back side to the photo |
| Look down at the desk top | **No** (use R3 instead) | - | The photo has only a thin strip of desk |

**The way around the limits** is regime R3: the book is lifted *in front of the camera*, at reading distance, with the plate reduced to a defocused glow. In R3 the camera is free to tilt and drift, because the plate is no longer a readable picture. All close-up work happens in R3.

## 2. Camera regimes

| Regime | Used in | Plate | Camera freedom |
|---|---|---|---|
| **R1** Establishing | S00 | the whole plate, filling the frame (M = 1.25), in focus | micro-drift only (a 2.5% push; centred) |
| **R2** Plate-follow | S01-S03, S15, end of S21, first half of S22 | scales and shifts with the camera, growing defocus | within the budget above |
| **R3** Hero | S04-S14, S16-S21 | a defocused backdrop (the plate scaled so large that only soft amber and dark shapes remain) | free: orbit +-12 degrees, tilt +-15 degrees, roll +-3 |
| **R4** Truck / display | second half of S22, S23-S25 | pans, zoomed in, defocus on all but the riser | slide + settle |

**Handover R2 to R3 (S04):** the book rises and fills the frame; as it passes 55% of frame height the plate's magnification jumps (hidden behind the book) from about 4.6x to about 6.5x, and the defocus goes to its maximum. The jump is hidden by the book's body and the blur. Verify with `npm run motion` that no frame shows a pop larger than 2% in the plate's visible edge.

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

`scale` is the plate magnification `M` from guide 02 (1.25 = the whole plate, which fills the frame). Every value except S00 is the first plan's value x 0.7233, the ratio of the desk's front-edge width on the two images (629 px on the old 736 px photo, 869.7 px on this plate). The authoritative copy is `src/config/camera.ts`; this table is what you hand to Patch 14-20. Positions are in the world units of guide 02 relative to the pile-zone origin; `focus` is the focus distance in cm.

| Shot | Frames | Camera move | Start M | End M | Focus (cm) | Aperture |
|---|---|---|---|---|---|---|
| S00 | 0-239 | micro push 2.5% | 1.25 | 1.28 | all in focus | f/8 |
| S01 | 240-479 | arc toward the lamp side, walking bob, ease-in | 1.28 | 2.46 | 260 to 120 | f/4 |
| S02 | 480-839 | slow down, lean in, focus pull to the pile | 2.46 | 4.49 | 120 to 38 | f/2.8 |
| S03 | 840-959 | drift 1.5 cm, 3% push | 4.49 | 4.63 | 36 | f/2.8 |
| S04 | 960-1079 | reach dip, R2 to R3 handover | 4.63 | 6.51 (hidden) | 36 to 30 | f/2 |
| S05 | 1080-1439 | slow orbit +-8 degrees, 4% push | - | - | 30 | f/2 |
| S06-S09 | 1440-1919 | tilt down 10 degrees to read the open book, then drift down the page | - | - | 32 | f/2.8 |
| S10 | 1920-2039 | pull back 6 cm to take the whole page block | - | - | 36 | f/2.8 |
| S11-S13 | 2040-2759 | square-on to the right page; push 4% per spread; **steady during QR hold** (no roll, no tremor) | - | - | 28 | f/2.8 |
| S14 | 2760-2879 | pull back to the whole closing book | - | - | 38 | f/2.8 |
| S15 | 2880-2999 | R3 to R2: the camera looks over the book to the desk; M falls from 6.51 to 4.63 | 6.51 | 4.63 | 40 | f/2.8 |
| S16-S21 | 3000-3959 | same as S04-S14 but 30% faster | | | | |
| S22 | 3960-4319 | pull back to M = 2.46, truck right (about +456 plate px, which is the old +330 px / 0.7233; the pile-to-riser anchor distance is 553 px), pass the chair (frames 4140-4199 are the occluder) | 4.63 | 2.46 then 3.76 | 90 to 50 | f/2.8 |
| S23 | 4320-4799 | settle and push 6% on the riser | 3.76 | 3.98 | 50 | f/4 |
| S24 | 4800-5279 | push 3%, exposure -1.5 stops | 3.98 | 4.09 | 50 | f/2.8 |
| S25 | 5280-5399 | hold with micro-drift; fade | 4.09 | 4.09 | 50 | f/2.8 |

**What Patch 05 built from this table (S00-S03, `src/config/camera.ts`).** The keyframes are the table's numbers with these differences, each found by `npm run motion` (decisions D-33 to D-35): S00's push is 3%, so M is 1.2875 at frame 240 (with 2.5% the walking bob ran into the margin rule as the window opened and the sideways speed reached 48 cm/s); S01 and S02 are each an ease in, a straight run and an ease out (`glideShot`), because a single `signature` over a long move peaks at 2.86 x its mean speed and breaks the 1.5 x per second limit on M; S02 does not stop at the pile but glides into S03's push (a stop there was a 66 frame STILL); the focus pulls to the S01 lens over the last second of S00 so it does not jump at the cut. **The Focus column is the guide's own unit, not a distance from the match camera**: the match camera stands 508 cm away and never moves, so the column is rescaled so that 36 is the pile (524 cm) and every other value keeps its ratio to it (260 is far behind the pile, 38 is just behind it). Copy the column into keyframes as it is. S04 was authored in Patch 14 (`src/shots/S04.tsx`): M 4.63 to 6.0 (not 6.51: decision D-59), focus 36 to 30, f/2, one key on frame 1080; the reach dip and the settle are slower than the table of section 3 (decision D-60). S05 onward is still to be authored (Patches 15-20).

Why M = 3.76 to 3.98 on the riser: the riser lives in the plate's right zone, about 194 plate px wide (52 cm at 3.73 px/cm). 194 px x 3.98 = 772 px, roughly 40% of the frame width. The books fill the centre, the dark wall and soft speaker bokeh surround them. If the riser looks too small, raise M, never lower the defocus. At the riser view the window spans plate x 730 to 1212, so the lit right-hand bookshelf (its frame starts at about x 1150) enters the frame's right edge, deep in defocus. Keep it soft; if it pulls the eye, shift the window left by up to 60 px or deepen the vignette layer. Never edit the plate (D-26).

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
5. **Never leave the photo.** The camera window must stay inside the plate with the 40 px margin. There is no pillarbox now: below M = 1.319 the view is centred and only M may change.
6. **Text the viewer must read is held at least 2 s** (guide 07), and the camera is not rolling then.
7. **QR hold:** the QR page is square-on within 4 degrees, flat, sharp, for at least 90 consecutive frames.
8. **No `backdrop-filter`.** Defocus the plate with the depth-of-field effect (in-scene), not with a CSS filter.
9. **Run `npm run motion` and look at the contact sheets before every hand-over.** Paste its summary into the patch notes.

## 7. What `npm run motion` reports (Patch 05)

`STILL` (a hold over 60 f with less than 0.5% movement, judged on the authored path), `FAST` (a speed limit broken: sideways speed per regime, M changing faster than 1.5 x per second, a camera move shorter than 48 frames, or two moves less than 20 frames apart), `DEEP` (plate magnification above the regime's budget, or above the sharp band with less defocus than the table of guide 02 asks), `EDGE` (the authored camera window outside the 40 px margin, or a tilt or roll above the regime's budget), `POP` (the picture jumping by more than 2% of the frame from one frame to the next), `LATE` (an authored event, keyframe or operator event, not on a beat). Zero of each is the target; a deliberate exception is written in `docs/PATCH_NOTES.md` with the frame **and** in `KNOWN_EXCEPTIONS` in `src/config/camera.ts`, which makes the audit print it as a known exception instead of failing (`npm run motion -- --all` shows everything).

Commands: `npm run motion` (all frames the keyframes cover), `npm run motion -- --from=480 --to=959`, `npm run motion -- --break` (adds a deliberate 20-frame move and shows the audit catching it). `npm run sheets -- --from=0 --to=959 --every=30` makes contact sheets from `out/stills/` (add `--render` to make missing stills with Remotion): look at them before every hand-over. The `DevCamera` still in the Studio prints the same path as a table with plots.
