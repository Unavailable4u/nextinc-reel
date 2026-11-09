### PATCH 18 - Shots S16-S21: the second book (MiniLocker)

**Needs:** 17
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`, `src/paint/covers/miniLocker.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/01-storyboard.md` (the acts for these shots), `docs/guide/05-camera-and-motion.md` section 4 (rows S16-S21), `docs/guide/03-realism-bible.md` section 4

```
PATCH 18 - Shots S16-S21: the second book (MiniLocker).

GOAL: the same language, 30% faster, with the short page sequence.

CREATE / CHANGE:
- `S16.tsx` ... `S21.tsx` per the storyboard: lift without the pile hold; cover hero 4 s; open straight to the title page (colophon left); one short riffle; the gallery spread with the four cropped screenshots; the film spread (2:50 film) with QR; close and set down beside MiniMe

RULES THAT MATTER HERE:
- Screenshots must be the cropped versions (guide 07).
- QR hold at least 90 frames.

CHECK:
- `npm run motion` 3000-3959 clean
- `npm run qr:check` on frames 3730-3830
- Stills at 3200, 3600, 3780
```

**Acceptance (what you look at to say yes):** A second book feels familiar and quicker; two books now lie beside a pile of one.
**Do not:** Camera travel to the right.
