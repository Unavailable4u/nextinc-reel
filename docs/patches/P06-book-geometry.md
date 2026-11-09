### PATCH 06 - Book geometry

**Needs:** 00, 04
**Parallel-safe with:** 05
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/lib/units.ts`, `src/light/Rig.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/04-book-design.md` section 1, `docs/guide/03-realism-bible.md` sections 3 and 6

```
PATCH 06 - Book geometry.

GOAL: a parametric hardcover book that looks right as geometry: boards, rounded spine, hinge groove, page block slab with squares, bevelled edges, ribbon, head and tail bands, with the four books' different thicknesses.

CREATE / CHANGE:
- `src/config/books.ts`: per book `{ id, volume, trimW:15.2, trimH:22.9, board:0.3, square:0.3, spine:{Mini Me 2.4, SPHEREx 1.8, MiniLocker 2.0, Immersive 1.6}, weightG, imperfection seeds }`
- `src/book/Book.tsx` with props `id`, `coverAngle` (0 closed to 1 fully open), `turned` (number of sheets turned, for block heights), `pose` (position, rotation); children slots for textures later; named anchors (spine, front board, back board, page block top, ribbon) exposed for rigs
- `src/book/PageBlock.tsx` (slab with a slight bow and uneven edge), `Ribbon.tsx` (a bent ribbon with a kink, a swing parameter), geometry bevel 0.8 mm
- `src/dev/DevBook.tsx`: a book with rotation sliders, a bounding-box overlay in cm, a three-book pile preview with the askew offsets from `books.ts`

RULES THAT MATTER HERE:
- Units are centimetres. A closed Mini Me is 15.2 x 22.9 x (2.4 + 2 x 0.3) cm with squares.
- No textures yet: flat colours only.
- Pure props in, geometry out; no frame reads.

CHECK:
- Bounding box prints 15.2 x 22.9 cm for the trim size
- The pile of three has believable, different thicknesses
- `npx tsc --noEmit`
```

**Acceptance (what you look at to say yes):** From any angle in `DevBook` it reads as a hardback, with bevelled edges catching the lamp.
**Do not:** Paint covers or pages, or animate opening.
