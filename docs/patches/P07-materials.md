### PATCH 07 - Materials: cloth, foil, paper, edges

**Needs:** 06
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/book/Book.tsx`, `src/book/PageBlock.tsx`, `src/light/PlateProbe.ts`, `src/light/Rig.tsx`, `src/config/books.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/03-realism-bible.md` sections 3, 6, 7

```
PATCH 07 - Materials: cloth, foil, paper, edges.

GOAL: physically plausible cloth, foil, paper and page-edge materials with procedural texture sets, lit by the plate probe.

CREATE / CHANGE:
- `scripts/make-textures.mjs` (sharp): tileable cloth weave normal and roughness maps, a paper grain map, a fore-edge line texture, a corner-wear alpha map, a faint dust map; writes to `public/textures/`; deterministic (fixed seeds)
- `src/book/materials.ts`: `clothMaterial(tokens)`, `foilMaterial(tokens)`, `paperMaterial()`, `edgeMaterial()`, `stainedEdge(color)`; values from guide 03 section 3
- `src/paint/patterns.ts`: endpaper pattern generator from `motif` (rings, orbits, nodes, waves, bars, tiles) and `palette`, seeded from the slug
- `src/dev/DevMaterials.tsx`: lighting presets (lamp only, strips only, all) and a 5-degree yaw slider to prove the foil flares

RULES THAT MATTER HERE:
- Foil is metal and reflects the probe; cloth is rough with sheen.
- Every random value is seeded.
- Texture sizes are budgeted (guide 02).

CHECK:
- Foil flares across a 5-degree yaw; cloth shows weave only at close range; paper edges show fine lines
- Textures regenerate identically (hash check)
- `npm run bench` unchanged by less than 15%
```

**Acceptance (what you look at to say yes):** A flat-colour book becomes a believable object under the lamp.
**Do not:** Place real text or logos.
