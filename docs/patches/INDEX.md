# Patch index (27 patches, 00-26)

**Progress: Patches 00, 01, 02, 03, 04, 05, 06, 07, 08 and 09 are done (Patch 08 needs your `public/brand/mini-me-mark.svg`; Patch 09 needs your MiniLocker and SPHEREx screenshots and the approval of the draft captions; see "Patch 08" and "Patch 09" in the notes), plus Patch 02a (the plate was replaced by a 1536 x 864 image; see `docs/PATCH_NOTES.md`).** Patch 03's gate G0b (a box looks planted) and the horizon choice D-25 are yours to confirm in the lab. Patch 04 ran on your machine (`plate:verify` passed, the benchmark says about 1.7 hours for the film on one worker; see "Patch 04a" in the notes); its stills are still to look at. Patch 05's Studio check, `npm run plate:verify` through the new camera rig and `npm run sheets -- --render` are yours to run (see "Known issues" in the Patch 05 notes) before Patch 06. **Patch 13 is split into 13A-13D (see the table); 13A, the shot registry, is done.**

Use `node tools/make-prompt.mjs <n>` (created in Patch 00) to assemble the five parts of each prompt. Do them in order; patches marked parallel-safe may swap with each other.

| # | Patch | Needs | Parallel-safe with | Size |
|---|---|---|---|---|
| 00 | Scaffold, config, core math, prompt tool | - | - | M |
| 01 | Site data sync and typed selectors | 00 | 02 | M |
| 02 | Plate rig, pillarbox, integrity test (**G0**) | 00 | 01 | L |
| 03 | Camera match lab and placement zones (**G0b**) | 02 | - | L |
| 04 | Light rig, shadow catcher, DOF, probe, benchmark | 03 | - | L |
| 05 | Camera rig, operator model, audits | 04 | 06 | L |
| 06 | Book geometry | 00, 04 | 05 | L |
| 07 | Materials: cloth, foil, paper, edges | 06 | - | L |
| 08 | Cover painter, four books | 01, 07 | 09 | L |
| 09 | Page painters, QR, spreads | 01, 08 (fonts) | - | L |
| 10 | Sheets, bending, translucency, riffle | 06, 07 | 08, 09 | L |
| 11 | Book motion rigs and **Gate G1** | 06, 07, 09, 10 | - | L |
| 12 | Pile, riser, dust, continuity ledger | 03, 06, 11 | - | M |
| 13 | Master composition, shot registry, stills tool (split into 13A-13D) | 05, 12 | - | M |
| 13A | Shot registry: shot types, stubs S00-S25, checks | 05, 12 | - | S |
| 13B | Master composition: the film plays from the registry | 13A | 13C | M |
| 13C | Stills tool: `npm run stills` | 13A | 13B | M |
| 13D | Shot strip and the scrub check | 13A, 13B, 13C | - | S |
| 14 | Shots S00-S04 | 13 (A-D) | - | L |
| 15 | Shots S05-S09 | 14 | - | L |
| 16 | Shots S10-S13 and **Gate G2** | 15 | - | L |
| 17 | Shots S14-S15 | 16 | - | M |
| 18 | Shots S16-S21 (MiniLocker) | 17 | - | L |
| 19 | Shots S22-S23 (truck, chair wipe, riser, labels) | 18 | - | L |
| 20 | Shots S24-S25 and **Gate G3** | 19 | - | M |
| 21 | Audio | 20 | 22 | M |
| 22 | Finishing and motion-blur decision | 20 | 21 | M |
| 23 | QA | 20, 21, 22 | - | M |
| 24 | Render, deliver, **Gate G4** | 23 | - | M |
| 25 | Website integration | 24 | - | S |
| 26 | Maintenance kit | 25 | - | S |

## Phases

A. Foundation (00-05): the photo on screen, matched, lit, with a camera. B. The book (06-11): geometry, materials, covers, pages, paper, motion. C. The film (12-20): the set, the shots. D. Finish (21-24): sound, polish, QA, render. E. Ship and keep (25-26).

## Gates

G0 (02) plate untouched. G0b (03) a box looks planted. **G1 (11)** realism of stills. **G2 (16)** motion at 60 fps and the QR scan. G3 (20) the whole film plays. G4 (24) release checklist. A failed G1 or G2 twice in a row means read `docs/guide/15-plan-b-blender.md`.

## Time

The work is sequential and visual; plan roughly one patch per working session, with Patches 04, 10, 11, 16 and 19 taking more than one. Dates are yours to set; there is no deadline in this guide.

## Splitting a patch

If an assistant cannot finish a patch in one session, split it (for example 10a and 10b), note the split in `docs/PATCH_NOTES.md` and in this table.
