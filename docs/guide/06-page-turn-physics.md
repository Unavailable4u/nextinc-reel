# 06 - Pages and page turning

You asked for a page that moves "just like we slide a page of a book in real life". This guide describes what a real page does, and how to reproduce it **without a live physics engine** (determinism rule 4).

## 1. What a real page turn does (the reference)

Record this once on your phone: slow-motion video of turning a hardcover page. Then watch it frame by frame. You will see:

1. **Pinch and lift.** A fingertip lifts the *outer corner* of the right page. The page leaves the stack at the fore-edge first, the corner leads, the gutter side stays flat.
2. **Curl.** The page is a bent sheet, not a hinged board. Its free edge trails behind its leading edge: the lifted page makes a "C"-shaped curve whose peak is near the top-outer corner. The curve flattens as the page rises.
3. **Arc.** The page swings over the spine hinge. At vertical (90 degrees) it is nearly flat again, lagging slightly.
4. **Air drag and drop.** On the way down, the free edge is slowed by air and arrives later than the gutter edge. It lands corner-first, then the rest follows.
5. **Settle.** A tiny flutter (two or three decaying wiggles at the free edge) and a slight bow near the gutter that relaxes over 0.3 s.
6. **Light.** While the page is vertical it is **lit from behind**; thin paper glows warm. It also casts a moving soft shadow on the pages under it.

## 2. The model: a closed-form sheet

A sheet is a rectangular mesh (about **24 x 36 segments**) with its spine edge fixed on the hinge line. Its shape at turn progress `p` in [0, 1] is a pure function:

```
angle(x, p)  = hinge_angle(p) - curl(p) * w(x)          // x in [0,1] from gutter to outer edge
hinge_angle  = lerp(0, 180 deg, ease(p))                 // the overall swing
curl(p)      = A * sin(pi * p)^k                         // zero at rest, max near mid-turn, A about 38 deg, k about 1.4
w(x)         = x^1.6                                     // gutter stays flat, outer edge curls most
```

Build the sheet by integrating the bend along x (a polyline whose segment angles follow `angle(x, p)`), so the sheet is **inextensible** (its length never changes), which is why it looks like paper and not rubber. Then add:

- **Lag:** a different `p` for the outer edge than for the gutter: `p_x = clamp(p - lag * w(x))`, with lag about 0.12. The outer edge is a little late in both directions.
- **Corner lift:** a slight extra lift near the top-outer corner (the finger's corner): `+ 6 deg * smooth(1 - dist_to_corner / 0.35)` during `p` in [0, 0.25].
- **Flutter on landing:** after `p = 1`, add `a * exp(-t/0.12) * sin(2 pi * 9 t) * w(x)`, with `a` about 2.5 deg.
- **Bow near the gutter** at rest: 0.5 mm, relaxing.

**Implementation choice (Patch 10).** Either a **skinned mesh** with about 12 bones along x, driven by the function above (the usual R3F "interactive book" technique; search "react three fiber interactive book skinned mesh"), or a **vertex shader** that evaluates the function on the GPU. The shader is lighter and fully deterministic; skinned meshes are easier to extend. Pick one in Patch 10 and note why.

## 3. Paper thickness and the page block

- A sheet's thickness is 0.01 cm; geometry that thin shows Z-fighting. Give each animated sheet **0.012 cm of real depth** and offset it by 0.004 cm from its neighbours.
- The page block under the sheets is a **textured slab** (fore-edge lines, slight yellowing). When a sheet lifts off it, the slab's top face is the *next page* (printed texture), so the viewer never sees a hole.
- As turned pages accumulate on the left, the left block grows and the right shrinks. Compute heights from the count of turned sheets: `left = (turned / total) * block_height`. At the riffle, 10-14 sheets move at once; the block changes visibly. That change is the best "it is thick" cue.

## 4. Translucency and shadows

- **Translucency:** a sheet's brightness gets a term proportional to `max(0, dot(lightDir, backNormal))` times a warm tint when the light is on its *back* face, and its own printed ink shows faintly through (about 8% of the facing page's alpha) so a turning page displays a ghost of its other side. This is the effect that sells the paper.
- **Self and neighbour shadows:** a moving soft shadow from the turning sheet onto the pages below. If a real shadow map is too coarse, use a **blob shadow decal** parented to the sheet (an elongated dark gradient whose length and softness follow the sheet's height).
- **Gutter shadow:** a permanent dark gradient where the page meets the spine (a printed-in shading), 1.4 cm wide on both pages.

## 5. Timing (at 60 fps)

| Action | Frames | Notes |
|---|---|---|
| Single turn | 54 (0.9 s), `p` eased `signature` | S07, S08, S12: lands on a beat |
| Quick turn | 36 (0.6 s) | Book 2, shot S18 |
| Riffle (S10) | 12-14 sheets, each 30 f, start offsets of 6 f growing to 10 f | the total length is 90-110 f; loudest at the middle |
| Cover open | spring `cover`, about 54 f to the first arrival, 30 f of settle | |
| Cover close | ease in 48 f, then the board lands with a 6-frame air puff | |

## 6. Painting pages (Patch 09) and testing turns (Patch 10)

- Every page is a **pure Canvas2D painter**: `paintPage(spec, data, bookId) -> Canvas`. Fonts must be loaded (with `FontFace` and `delayRender`) before the first paint. Painters are tested on the `DevPages` sheet, one of every page type for each book, so you can read the text and check the margins.
- A turn is tested in `DevPageTurn` with a **scrubber**: you can drag to frame N and see the sheet's shape, plus a toggle to show the mesh, the hinge line, and the shadow decal.
- **Acceptance of a turn:** the paper never intersects the neighbouring page, never stretches (measure the polyline length at 5 values of `p`: within 0.5% of the original), the lag is visible, and the landing has two to three decaying wiggles.

## 7. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Page looks like a hinged board | curl missing | raise `A`, check `w(x)` |
| Rubbery paper | length not preserved | integrate the polyline; never scale the mesh |
| Z-fighting flicker | sheets too thin and coplanar | 0.012 cm depth, 0.004 cm offsets, `polygonOffset` |
| Text swims on the turning sheet | texture filtering | anisotropy 16, mipmaps, texture at 2048 x 3072 |
| Lit from the wrong side | back-face normal not flipped | use two-sided material with correct normals per side |
| Hole under the lifted sheet | page block top face not textured with the next page | paint the next page onto the slab's top face |
