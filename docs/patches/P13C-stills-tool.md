### PATCH 13C - Stills tool: `npm run stills`

**Needs:** 13A
**Parallel-safe with:** 13B
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `package.json`, `scripts/verify-plate.mjs`, `scripts/lib/env.mjs`, `scripts/make-sheets.mjs`, `src/shots/index.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/11-maintenance.md` (the golden stills), `docs/guide/09-render-and-delivery.md` (render options)

```
PATCH 13C - Stills tool: `npm run stills`.

GOAL: render chosen frames of the film to PNG, and a labelled contact sheet of them, so every later shot patch can be looked at.

CREATE / CHANGE:
- `scripts/make-stills.mjs` (replaces the stub): `--frames 0,600,...` (film frames), `--shot S05` (the shot's first, middle and last frame; with `--every N` every Nth frame of the shot), `--every N` (every Nth frame of the film, starting at 0), `--golden` (the ten golden frames of guide 11: 0, 600, 840, 1250, 1500, 2100, 2640, 3250, 4580, 5100). Both `--every 120` and `--every=120` work (the shared `parseArgs` only knows `=`; parse here or extend it without changing what the other scripts accept). A frame outside 0-5399, an unknown shot id or an empty selection is a usage error that says what was wrong
- Output in `out/stills/`: `fNNNN.png` per frame and `contact-sheet.png` (a grid of the frames, each cell labelled with the frame number and the shot id, drawn with sharp); the readout (`hud`) is off unless `--hud`; the browser and GL options are the ones `scripts/lib/env.mjs` gives the other scripts
- `--golden` also compares each frame with `docs/reference/golden/fNNNN.png` when that file exists and prints the SSIM; when it does not, it says "no golden copy yet" and still renders (the golden copies are stored by Patch 23). Move the SSIM function out of `scripts/verify-plate.mjs` into `scripts/lib/ssim.mjs` and import it from both; `npm run plate:verify` must give the same numbers as before
- `package.json`: `"stills": "node scripts/make-stills.mjs"`
- `docs/PATCH_NOTES.md`, `docs/patches/INDEX.md`

RULES THAT MATTER HERE:
- Rendering is deterministic: the same frame gives the same PNG.
- The stills are written under `out/`, never under `public/` or `docs/reference/`; the original plate is never touched.
- Pure Node 20+, Windows-safe paths, no bash.

CHECK:
- `npm run stills -- --frames 0,840` writes two PNGs and a contact sheet
- `npm run stills -- --shot S03` writes the first, middle and last frame of S03
- `npm run stills -- --every 120` renders the contact sheet of the (mostly empty) film: 45 frames, every cell labelled
- `npm run stills -- --golden` renders ten frames and says there are no golden copies yet
- `npm run plate:verify` gives the same SSIM as before the move of the function
```

**Acceptance (what you look at to say yes):** The contact sheet of `--every 120` shows the film from the photo to its last frame, each cell labelled with the right shot id.
**Do not:** Store golden copies, change what any shot looks like, or build the shot strip.
