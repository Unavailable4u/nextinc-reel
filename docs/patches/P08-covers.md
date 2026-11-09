### PATCH 08 - Cover painter for the four books

**Needs:** 01, 07
**Parallel-safe with:** 09
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/data/select.ts`, `src/config/books.ts`, `src/config/bookText.ts`, `src/book/materials.ts`, `src/lib/fonts.ts`
**Paste reference (read-only, from other repos):** `nextinc/assets/js/art.js` (the `orbits` and other motifs, the seeded generator), `nextinc/assets/img/brand/mini-me-logo.png`, `minilocker-film/src/ui/RadiusDial.tsx` and `minilocker-film/docs/bible/appendix-A.md`, `nextinc/scripts/brand/glyph-x.json`
**Attach from guide:** `docs/guide/04-book-design.md` sections 2, 3, 7, `content/books.md`, `docs/guide/07-content-and-assets.md` section 4 (open conflict)
**Before you start (you do this, not the assistant):** vectorise `mini-me-logo.png` yourself (Inkscape: Path > Trace Bitmap, or potrace) and save `public/brand/mini-me-mark.svg`. Resolve D-17 (minime.app).

```
PATCH 08 - Cover painter for the four books.

GOAL: front, spine and back of each book painted in code as separate colour, foil-mask and height (deboss) canvases from the data, bound to the Book materials.

CREATE / CHANGE:
- `src/paint/typography.ts`: font loading (CMU Serif / Typewriter from the site's `.woff2` copied to `public/fonts/` with `FontFace` + `delayRender`), text measuring, small caps, tracking, justification helpers (pure)
- `src/paint/covers/miniMe.ts`, `spherex.ts`, `miniLocker.ts`, `immersive.ts`: each exports `paintCover(data, tokens) -> { color, foil, height }` for front, spine, back; Vol. I uses the vectorised mark; Vol. III uses the dial arc geometry and the exact Mark SVG; Vol. II ports the `orbits` motif; authors from `getAuthors()`
- `src/paint/covers/index.ts`: cache by content hash
- `src/dev/DevCovers.tsx`: all four fronts, spines and backs flat, with a safe-area overlay; and each cover on its `Book`

RULES THAT MATTER HERE:
- Titles and authors come from selectors and `bookText.ts`, never typed.
- No `minime.app`, no "Try" button, no third-party logos.
- The MiniLocker Mark and dial geometry are used exactly; never redrawn by eye.

CHECK:
- `DevCovers` shows four distinct, legible covers; a spine reads top to bottom
- Changing a title in the snapshot changes the cover (prove it once, then revert)
- `npx tsc --noEmit`
```

**Acceptance (what you look at to say yes):** Each cover looks like a real book you could buy, on the lit book in `DevBook`.
**Do not:** Paint interior pages or QR codes.
