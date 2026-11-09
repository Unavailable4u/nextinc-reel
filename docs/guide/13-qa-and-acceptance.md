# 13 - QA and acceptance

## 1. Gates

| Gate | When | Pass criteria |
|---|---|---|
| **G0** Plate | after Patch 02 | `plate:verify` passes; frame 0 SSIM at least 0.98 |
| **G0b** Match | after Patch 03 | a test cube on the desk strip looks planted at three zoom levels |
| **G1** Stills realism | after Patch 11 | 10 stills, Reality Rubric average at least 4.0, none below 3 (section 2) |
| **G2** Motion test | after Patch 16 | S05-S13 at 60 fps: no pops, no flicker, no plate tears; the page turn passes guide 06, section 6 |
| **G3** Full cut | after Patch 20 | the whole film plays; `npm run motion` clean |
| **G4** Release | after Patch 24 | section 4 checklist complete |

**If G1 or G2 fails twice after honest fixes,** do not keep polishing: read `15-plan-b-blender.md` and decide.

## 2. Reality Rubric: scoring examples

Score 0-5 on: contact, light, material, imperfection and scale, lens.

| Score | Contact | Light |
|---|---|---|
| 1 | book floats; no shadow | lit from the front by a flat white light |
| 3 | shadow present but too even | warm key from the left, but no falloff across the book |
| 5 | tight contact line, soft cast shadow that lengthens away from the lamp, faint reflection | clear gradient across the cover toward the lamp, amber rim from behind, cool fill in shadows |

Review each still at 100% and at thumbnail size. Ask someone who has not seen the plan: "photo or render?" The honest answer is part of the record in `PATCH_NOTES.md`.

## 3. Standard tests

| Test | How | Pass |
|---|---|---|
| Plate integrity | `npm run plate:verify` | checksum and SSIM |
| Camera audit | `npm run motion` | zero STILL/FAST/DEEP/EDGE/POP/LATE |
| Frame-time audit | `npm run bench` on the worst shots (S05, S10, S11, S23) | each under 4 s per frame, or the render plan adjusted |
| Truth audit | `npm run audit` | every string and QR target traced to the snapshot |
| QR scan | `npm run qr:check` and a **real phone** pointed at the screen | all decode to the exact target |
| Legibility | stills at 1080p, 100% | every must-read string readable; contrast at least 7:1 |
| Beat check | `npm run motion` LATE report | all authored events on multiples of 30 frames |
| Loudness | `ffmpeg ... loudnorm` print | -16 LUFS +-1, true peak at most -1.5 dB |
| Contact sheets | stills every 30 frames, in order | no sudden jumps, no black frames |
| Cross-device | laptop muted, headphones, phone | still looks right |

## 4. Release checklist (G4)

- [ ] Duration is exactly 90.000 s, 1920x1080, 60 fps, AAC audio present.
- [ ] The first frame is the original photograph (plus grain and vignette only).
- [ ] No text on any page or label that is not in the snapshot or `content/books.md` wording.
- [ ] No `minime.app`, no invented URL, no third-party logo.
- [ ] Mini Me is labelled with the status the data states (currently coming soon).
- [ ] The riser labels are correct and in site order.
- [ ] Every QR decodes to the expected target.
- [ ] No frame shows a plate edge, a seam, a hole under a page, or a book intersecting another.
- [ ] Audio cues sit on their frames; the ending is silent at the last frame.
- [ ] Poster 1600x900 WebP at most 100 KB.
- [ ] `RENDER_INFO.json`, `CHANGELOG.md` updated; tag created.
- [ ] Viewing protocol done (guide 09, section 7).

## 5. Accessibility and honesty checks

- The film has no flashing (nothing flashes more than three times per second; the riffle is under that because it is a single fan, but check the contact sheets).
- The text alternative is published (guide 10).
- Nothing implies a product is available when its status says otherwise.
