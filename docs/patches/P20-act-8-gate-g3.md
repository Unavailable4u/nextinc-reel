### PATCH 20 - Shots S24-S25: dim, wordmark, tagline, fade; Gate G3

**Needs:** 19
**Parallel-safe with:** none
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/config/camera.ts`, `src/shots/index.ts`, `src/ReelFilm.tsx`, `src/book/rig/*.ts`, `src/config/ledger.ts`, `src/data/select.ts`
**Paste reference (read-only, from other repos):** `nextinc/scripts/brand/glyph-x.json`, `nextinc/assets/img/icons/icon.svg`
**Attach from guide:** `docs/guide/01-storyboard.md` Act 8, `docs/guide/03-realism-bible.md` section 8

```
PATCH 20 - Shots S24-S25: dim, wordmark, tagline, fade; Gate G3.

GOAL: the room dims, the Next Inc. wordmark draws in, the tagline and address appear, fade to black.

CREATE / CHANGE:
- `src/fx/Dim.tsx` (exposure -1.5 stops over 120 frames from 4800; the lamp warms and falls; books stay softly lit by the strips)
- `src/fx/Wordmark.tsx`: the crimson italic x stroked on from the glyph path, letters rising into place in CMU Serif Bold; tagline and address from `getCompany()`
- `S24.tsx`, `S25.tsx` (hold 1.5 s, fade 0.5 s); **Gate G3**: play the whole film

RULES THAT MATTER HERE:
- The x path comes from `glyph-x.json`; do not redraw it.
- The wordmark sits over a soft background and is fully readable.

CHECK:
- `npm run motion` clean for the whole film
- Full-film contact sheet every 60 frames
```

**Acceptance (what you look at to say yes):** Gate G3: the whole film plays start to finish; the ending feels earned.
**Do not:** Audio or finishing.
