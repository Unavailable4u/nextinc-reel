### PATCH 15 - Shots S05-S09: cover hero, open, first pages

**Needs:** 14
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`, `src/paint/spread.ts`, `src/config/pageSpecs.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (the acts for these shots), `docs/guide/05-camera-and-motion.md` section 4 (rows S05-S09), `docs/guide/03-realism-bible.md` section 4

```
PATCH 15 - Shots S05-S09: cover hero, open, first pages.

GOAL: MiniMe in full view, the cover opening, the half-title, title page, abstract and figure, with a reading camera.

CREATE / CHANGE:
- `src/shots/S05.tsx` ... `S09.tsx`: slow yaw orbit +-8 degrees with the specular sweep on beat 3 of bar 10 (frame 1260), cover open (spring), turn 1 (frames 1560-1613), turn 2 (1680-1733), the reading tilt and drift; spreads per guide 04 section 5; texture load/dispose for Mini Me pages
- must-read strings: the title, the authors, `Abstract.`, the figure caption: each on screen at least 120 frames with no roll

RULES THAT MATTER HERE:
- No still hold over 60 frames without drift.
- Text readable at 100%.

CHECK:
- `npm run motion` for 1080-1919 clean
- Stills at 1260 (cover with specular), 1600, 1720, 1860; read them at 100%
```

**Acceptance (what you look at to say yes):** The cover is gorgeous, the pages are readable and turn like paper.
**Do not:** Riffle, gallery, QR (Patch 16).
