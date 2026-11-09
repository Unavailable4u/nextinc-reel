# 15 - Plan B: Blender for the hero shots

Use this only if a gate fails twice. Real-time Three.js can look very good with careful lighting, but a path tracer wins on soft light, paper translucency, foil and depth of field.

## What changes, what stays

| Stays | Changes |
|---|---|
| The storyboard, shot list, timeline, beat grid | The books and page turns are **rendered in Blender** as transparent image sequences |
| The data snapshot, covers and pages (painted textures exported as PNG) | The 3D scene is built in Blender (a script reads `site-snapshot.json` and `content/books.md`) |
| The plate rule (untouched photo) | The plate sits behind as a **shadow-catcher** setup: Blender renders books plus shadows and reflections with alpha, and the plate is composited under them |
| Remotion | Remotion becomes the **compositor**: plate, then the image sequences, grain, labels, wordmark, audio |

## How

1. Camera-match the plate in Blender (the same procedure as Patch 03; the free fSpy tool exports a matched camera; check its current docs).
2. Model one book procedurally with a script (boards, spine, page block). Pages as a cloth simulation or shape-key curl following the same function as guide 06.
3. Light with an area light for the lamp, a strip area light for the LEDs, a world environment from the plate probe.
4. Render with the Cycles engine (soft shadows, true depth of field, real motion blur); denoise. Output PNG with alpha per shot into `public/renders/Sxx/`.
5. In Remotion, a shot is `Plate + <Img sequence> + overlays`.

## Costs

- A path-traced frame takes seconds to minutes, depending on your GPU; 5400 frames is a long job. Plan to render only the shots that need it (S03-S21 and S23) and to render at 30 fps for the page-turn shots if time runs out, then interpolate carefully.
- Blender files are binary and do not merge: keep one author per file, use Git LFS, and keep the **generator script** as the source of truth.
- It needs someone who knows Blender; the assistant workflow works for scripts but you must run Blender yourself to look.

## Decision rule

If after two honest rounds G1 average is below 4.0 on contact, light or material, or G2 shows persistent page-turn artefacts, switch only the **books** to Blender (keep Remotion as the compositor, keep the data pipeline, keep the shot list). Record the switch in `DECISIONS.md` as D-20.
