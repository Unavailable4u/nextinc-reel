### PATCH 03 - Camera match lab and placement zones

**Needs:** 02
**Parallel-safe with:** none
**Size:** L
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/plate.ts`, `src/plate/Plate.tsx`, `src/plate/PlateFollow.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/02-architecture.md` (World units, The plate rig), `docs/reference/desk-plate-analysis.md` (Desk strip, Constraints), `docs/guide/05-camera-and-motion.md` sections 1-2

```
PATCH 03 - Camera match lab and placement zones.

GOAL: a virtual camera whose desk plane lies exactly on the photo's desk strip, a scale chosen and recorded, and measured free zones for the pile and the riser.

CREATE / CHANGE:
- `src/dev/DevMatch.tsx`: the plate with a virtual desk plane (y=0) drawn as a translucent grid, a front-edge line and a back-edge line, sliders for camera height, distance to the desk, vertical field of view, pitch, and the horizon / vertical lens shift (range y = 380 to 470: the desk edges say 396, the room's ceiling and baseboard lines say about 464, and the person chooses by eye, D-25); toggles: show grid, show test box (15.2 x 22.9 x 2 cm), show a 40 x 4 x 1 cm bar for the keyboard; a numeric read-out of the desk front edge and back edge in photo px; a panel that prints the JSON and a copy button (Studio cannot write files)
- `src/config/plateMatch.json` (you paste the printed JSON): camera position, fov, pitch, plate depth and size in cm, chosen scale (photo px per cm at the desk front), desk edges in photo px
- `src/config/placementZones.json`: zone L (pile) and zone R (riser) as rectangles on the desk plane in cm, plus the exclusion list (lamp, keyboard and mat, chair, speaker, headset stand) with their estimated extents
- update `PlateFollow.ts` to use the real match
- a `docs/reference/match-notes.md` recording the chosen scale and why (design assumption, not a measurement)

RULES THAT MATTER HERE:
- The photo is not 3D; the match is for the desk plane only.
- Record every number you choose; later patches read them.
- Keep books inside zones; zone R is for the riser at the front edge (in front of the speaker).

CHECK:
- Test box at the pile zone looks planted at M = 1.25, 2.46 and 4.49 (take three stills)
- The riser footprint (36 x 24 cm) fits zone R without touching the chair
- `npm run plate:verify` still passes
- `npx tsc --noEmit`
```

**Acceptance (what you look at to say yes):** Gate G0b: a box on the desk strip looks like it is on that desk at three zoom levels.
**Do not:** Add lighting or real book geometry.
