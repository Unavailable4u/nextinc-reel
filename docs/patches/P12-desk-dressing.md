### PATCH 12 - Pile, riser, dust, continuity ledger

**Needs:** 03, 06, 11
**Parallel-safe with:** none
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/placementZones.json`, `src/config/plateMatch.json`, `src/config/books.ts`, `src/config/ledger.ts`, `src/book/Book.tsx`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/04-book-design.md` section 7, `docs/guide/03-realism-bible.md` sections 2 and 6, `docs/guide/01-storyboard.md` (Continuity ledger)

```
PATCH 12 - Pile, riser, dust, continuity ledger.

GOAL: the set: a believable three-book pile in zone L, a two-tier riser in zone R, dust in the lamp cone, and the continuity ledger as one function.

CREATE / CHANGE:
- `src/scene/Pile.tsx`: MiniMe on top, MiniLocker, SPHEREx at the bottom, askew by the offsets in `books.ts`, spines facing the camera, contact decals
- `src/scene/Riser.tsx`: 36 x 24 cm two-tier walnut riser with a brass lip, wood material sampled from the plate's desk colour; `getRiserSlots()` returning pose for Vol. I-IV (leaning 4 degrees back)
- `src/scene/Dust.tsx`: seeded motes in the lamp cone (a cone volume from the lamp position), slow drift, a disturbance function used when a book lifts
- `src/config/ledger.ts`: `getBookLocation(bookId, frame)` per the storyboard table (pile / beside / hand / riser) and `getBookPose` integrating pile and riser slots; the swap at frames 4140-4199
- `src/dev/DevRiser.tsx` and `DevPile.tsx`

RULES THAT MATTER HERE:
- Every book exists once; locations only from the ledger.
- Books never overlap the exclusion list; the riser sits at the desk front edge.

CHECK:
- Stills at M = 4.49 (pile) and M = 3.98 (riser)
- `getBookLocation` returns the table in the storyboard at frames 0, 960, 2880, 3000, 3840, 4139, 4200, 5399
- `npx tsc --noEmit`
```

**Acceptance (what you look at to say yes):** The pile and riser both look planted and lit by the lamp and strips.
**Do not:** Camera moves or shots.
