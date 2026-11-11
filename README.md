# nextinc-reel

A code-driven, deterministic 3D motion film for the Next Inc. website: the **company intro reel** that sits right after the hero section of the home page (the slot the site calls *Fig. 1*, film id `next-inc-reel`).

**This repository is a guide pack plus the first four patches already built and tested.** It contains the plan, the rules, the storyboard, the asset lists and the numbered patch prompts (`docs/patches/`), and the code of **Patches 00, 01, 02 and 03**: the scaffold, the site-data sync with typed selectors, the plate rig with its integrity test, and the camera match lab with the placement zones. You continue from **Patch 04** (lights, shadows, depth of field) after confirming the match in the lab (`docs/reference/match-notes.md`). Each patch adds code to `src/`, and `docs/PATCH_NOTES.md` is the memory between sessions.

## Status

| Done | What you can do now |
|---|---|
| 00 Scaffold | `npm install`, `npm run studio` (the film opens on your photo with a frame/shot readout), `npm test`, `npm run timeline`, `npm run prompt -- <n>` |
| 01 Site data | `npm run sync` (writes `src/data/site-snapshot.json`; `-- --check` before every render; `-- --copy-media` for covers, logo, fonts), `node scripts/test-select.mjs` |
| 02 Plate rig | `npm run plate:verify` (the gate G0 proof that your photo is untouched), the **DevPlate** composition in the Studio (sliders for magnification and position, green/amber/red resolution band) |

First run on your own machine: `npm install`, then `npm run sync -- --copy-media` (needs the website repo next to this one, or `SITE_REPO=<path>`), then `npm run plate:verify` (the first run downloads Remotion's browser), then `npm run studio`. Details and every check that was run are in `docs/PATCH_NOTES.md`.

**Also read `docs/reference/measured-calibration.md` and `docs/reference/match-notes.md`.** The photo has been measured by hand and a tested starting camera for it is in `docs/reference/calibration-seed/`. It also lists four things the build found in the guides (one affects what appears on screen).

## The film in one paragraph

The first frame is your desk photograph, untouched. Someone walks up to the desk. On it lies a small pile of three hardcover books, one per project. The top book, **MiniMe**, is lifted and turned toward us: we see its cover (project logo on top, title, the three author names). The cover opens, we read a few pages (each turn bends and settles like real paper), riffle to the middle where screenshots, the promo film's thumbnail with a play mark, and finally QR codes and links are printed like an interactive e-book. The book is put down, a second book (**MiniLocker**) gets the same treatment in a shorter glance. Then the camera travels to the right end of the desk where all four project books stand on a small riser, each one marked with its project name. The room dims and the **Next Inc.** logo appears. 90 seconds, 1920x1080, **60 fps**.

## Read in this order

1. `docs/guide/00-read-first.md` - decisions already made for you, and the five things that will surprise you.
2. `docs/guide/01-storyboard.md` - the whole film, shot by shot, frame by frame.
3. `docs/guide/02-architecture.md` - stack, repo layout, coordinates, determinism, the "plate rig".
4. `docs/guide/03-realism-bible.md` - how to make it look real (light, materials, depth of field, physical cues).
5. `docs/guide/04-book-design.md` and `docs/guide/06-page-turn-physics.md` - the books and the pages.
6. `docs/guide/05-camera-and-motion.md` - the camera, as a person, with numbers.
7. `docs/guide/07-content-and-assets.md` and `content/books.md` - what goes on every page, where every fact comes from, what you must supply.
8. `docs/guide/14-ai-session-workflow.md` - how to work patch by patch with an assistant.
9. `docs/patches/INDEX.md` - the 27 patches and their order.
10. When you get there: `08-audio.md`, `09-render-and-delivery.md`, `10-site-integration.md`, `13-qa-and-acceptance.md`; when stuck: `12-troubleshooting.md`, `15-plan-b-blender.md`.

Maintenance lives in `docs/guide/11-maintenance.md` and `docs/ops/RUNBOOK.md`.

## The whole flow (what you will do, in order)

1. Read the guides above and answer the open questions in `docs/DECISIONS.md` (all have defaults, so you can accept them).
2. Run **Patches 00-05** (scaffold, site data sync, the plate rig, camera match, lighting and render baseline, camera system). After Patch 05 you can see your desk photo with a test cube sitting on it convincingly.
3. Run **Patches 06-11** (the book: geometry, materials, covers, pages, page turning, book motion). **Gate G1** (stills) happens here.
4. Run **Patches 12-20** (desk dressing, timeline, and the nine acts). **Gate G2** (motion test) happens after Patch 16.
5. Run **Patches 21-24** (audio, finishing, QA, render and delivery).
6. Run **Patch 25** to put the film on the website. Run **Patch 26** to finish the maintenance kit.
7. Tag a release (`reel-v1.0`) and keep the `out/` masters on a backup drive.

## Commands (each is created by the patch named in brackets; stubs print "created by Patch NN")

| Command | Purpose |
|---|---|
| `npm run studio` | Remotion Studio, live preview [00, done] |
| `npm test` / `npm run typecheck` / `npm run timeline` | Pure-logic tests, TypeScript check, print the shot table [00, done] |
| `npm run prompt -- <n>` | Assemble the five parts of a patch prompt into `prompts-out/` [00, done] |
| `npm run sync` | Read the website repo, write `src/data/site-snapshot.json` [01, done] |
| `npm run select:test` | Print the four books, QR targets and run the truth checks [01, done] |
| `npm run plate:verify` | Prove the original photo is untouched [02, done] |
| `npm run plate:measure` | Print the plate's edge colours and the lamp/LED test regions [02, done] |
| `npm run bench` | Measure seconds per frame on this machine [04] |
| `npm run motion` | Audit the camera path (speed, holds, depth of field) [05] |
| `npm run stills` | Render the check stills to `out/stills/` [13] |
| `npm run qr:check` | Decode every QR in a rendered still and compare with the data [09] |
| `npm run audit` | Truth audit: every on-screen fact traced to the snapshot [23] |
| `npm run render` | Render, encode, verify, write poster and loop [24] |

Rows without "done" are still stubs until their patch is built.

## Layout

```
README.md  AGENTS.md  .gitignore  .gitattributes
docs/
  guide/        the guides (read-first, storyboard, architecture, realism, books, camera, ...)
  patches/      one file per patch + INDEX.md (the dependency table)
  templates/    patch-prompt template, shot card, decision record
  reference/    desk-plate analysis, glossary, the plate checksum,
                measured-calibration.md + calibration-seed/ (tested starting camera for Patch 03)
  checklists/   quick checklist, pre-render, pre-publish
  ops/          RUNBOOK.md (maintenance, step by step)
  DECISIONS.md  every decision, its default, and how to change it
content/
  books.md      the editorial truth table for the four books
public/
  plates/original/desk-plate.png   YOUR PHOTO (1536 x 864, 16:9). READ-ONLY.
  plates/superseded/desk-plate-v1.jpg   the first photo (736 x 672), kept unchanged for the record
  plates/derived/   anything produced from it (upscales, blurred probes)
  fonts/ brand/ textures/ models/ screens/ films/ audio/ qr/
src/          config/ (timeline, plate), lib/ (ease, spring, prng, noise, hash, units, fonts), data/ (snapshot + selectors),
              plate/ (the plate rig), dev/ (DevPlate), stage.tsx, ReelFilm.tsx, Root.tsx
scripts/      sync-site, verify-plate, test-select, lib/env.mjs, stubs for later patches
tools/        make-prompt, run-tests, print-timeline, measure-plate
tests/        pure-logic tests (npm test)
out/  prompts-out/                   (git-ignored)
```

## Licensing and rights (read once)

- **Remotion** is free for individuals and for companies of up to 3 people, including commercial use. Next Inc. currently lists three people on its site, so the free licence applies. If the combined headcount of everyone who uses it (including collaborators and contractors) reaches 4, a company licence is required. Check https://www.remotion.dev/license before you add a fourth person. This is not legal advice.
- **Fonts**: CMU Serif and CMU Typewriter Text are SIL OFL, already vendored in your website repo (`assets/fonts/`).
- **Your desk photograph**: confirm you have the right to use it in a published film. If it came from a stock site or a generator, keep the licence text in `docs/reference/plate-licence.md`.
- **Audio**: record your own foley (guide 08) or use CC0 / properly licensed files, and list every file in `docs/reference/asset-licences.md`.
- **Third-party marks**: no NASA, Vultr or other logos on the books. Names appear as plain text only, and only where the project data already says so.
