### PATCH 16 - Shots S10-S13: riffle, gallery, film, links; Gate G2

**Needs:** 15
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`, `src/book/rig/riffle.ts`, `src/paint/qr.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (the acts for these shots), `docs/guide/05-camera-and-motion.md` section 4 (rows S10-S13), `docs/guide/03-realism-bible.md` section 4, `docs/guide/04-book-design.md` QR rules

```
PATCH 16 - Shots S10-S13: riffle, gallery, film, links; Gate G2.

GOAL: the middle of the book: riffle, screenshots with captions, the film thumbnail with a play mark, the QR page held steady.

CREATE / CHANGE:
- `src/shots/S10.tsx` ... `S13.tsx`: riffle (frames 1920-2030), gallery with a 4% push per spread, the film spread (no playback), the links spread held square-on, flat and steady for at least 90 frames
- **Gate G2:** render S05-S13 at 60 fps; check for pops, flicker, plate tears; check the turn against guide 06 section 6; scan the QR page from your screen with a real phone

RULES THAT MATTER HERE:
- The QR spread has no roll, no tremor and no page bend during the hold.
- The film page never plays.

CHECK:
- `npm run motion` for 1920-2759 clean
- `npm run qr:check` on frames 2600-2700
- Gate G2 notes in `PATCH_NOTES.md`
```

**Acceptance (what you look at to say yes):** Gate G2 passed. The riffle looks thick and fast; the screenshots are legible; the phone scans the QR from the screen.
**Do not:** Close or set down the book.
