// UVS IN CENTIMETRES (Patch 07). Pure functions on three.js geometry: no React, no randomness.
//
// A texture's `repeat` is one over the size its tile covers (`configureTexture`), so for a weave to be the same size on a board, a
// spine and a hinge strip, every surface's UV must be a length in cm on that surface. The geometry of Patch 06 has UVs that are
// 0 to 1 per face (boxes) or the extrusion's own (boards); this file replaces them.
//
// THE RULES
//   surfaceUV     every triangle is projected on the plane its own normal is nearest to (a box projection, per triangle). The
//                 bevel is 0.8 mm wide and three segments, so a per-VERTEX choice of plane would stretch the texture across it;
//                 per triangle each one is consistent, and only the phase of the pattern jumps at a seam, which a weave hides.
//   slabUV        the page block's six faces are known (a box in groups), so they are mapped by face: the edge faces run along
//                 the edge (u) and up the stack (v = y, so the sheet lines of two stacks meet), the two big faces use x and z.
//   cornerTint    the yellowing of the page edges, as a vertex colour (linear) that fades out over `reach` cm from a corner.
//
// ORIENTATION. A face's u runs to the reader's right and v up, as in the anchor frames of `geometry.ts` (top: u = x, v = -z, so the
// head is up). Weave, paper and dust are isotropic, so only the page edges depend on it, and those have their own mapping.

import * as THREE from "three";

/**
 * Sets the `uv` attribute in cm, each triangle on the plane its normal is nearest to. The geometry is made non-indexed if it was
 * indexed (a new geometry is returned and the old one is disposed); a non-indexed one is changed in place and returned.
 */
export function surfaceUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geo;
  if (g.index) {
    g = geo.toNonIndexed();
    geo.dispose();
  }
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let t = 0; t + 2 < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? a : k === 1 ? b : c;
      let u: number;
      let v: number;
      if (ay >= ax && ay >= az) {
        // facing up (the top of a board) or down (its underside)
        u = n.y >= 0 ? p.x : -p.x;
        v = -p.z;
      } else if (ax >= az) {
        // facing the fore-edge side or the spine side
        u = n.x >= 0 ? -p.z : p.z;
        v = p.y;
      } else {
        // facing the tail or the head
        u = n.z >= 0 ? p.x : -p.x;
        v = p.y;
      }
      uv[(t + k) * 2] = u;
      uv[(t + k) * 2 + 1] = v;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * The page-block slab's UV in cm, by face. `geo` is a three.js BoxGeometry whose vertices have been moved (so its groups are the six
 * faces in the order +x, -x, +y, -y, +z, -z). The two sides and the tail and head faces get (along the edge, y): the sheet lines
 * lie across v, so they stack up the block and are continuous from one stack to the other. The top and underside get (x, z).
 */
export function slabUV(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const index = geo.index;
  if (!index) throw new Error("slabUV: the slab must be an indexed BoxGeometry");
  const uv = new Float32Array(pos.count * 2);
  for (const g of geo.groups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = index.getX(i);
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      let u: number;
      let v: number;
      switch (g.materialIndex) {
        case 0: // +x, the fore-edge
          u = -z;
          v = y;
          break;
        case 1: // -x, against the spine
          u = z;
          v = y;
          break;
        case 2: // +y
          u = x;
          v = -z;
          break;
        case 3: // -y
          u = -x;
          v = -z;
          break;
        case 4: // +z, the tail
          u = x;
          v = y;
          break;
        default: // -z, the head
          u = -x;
          v = y;
      }
      uv[vi * 2] = u;
      uv[vi * 2 + 1] = v;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export interface CornerTint {
  /** the tint at the corner, linear RGB (each 0 to 1; white is no tint) */
  tint: readonly [number, number, number];
  /** how much of the tint the corner takes, 0 to 1 */
  amount: number;
  /** the distance at which it has faded out, cm */
  reach: number;
}

/**
 * Writes a `color` attribute (linear RGB): white, taken towards `tint.tint` by `amount` at a corner and fading to nothing over
 * `tint.reach` cm (with a square, so it is gentle at the far end). The yellowing is a function of the distance to the NEAREST
 * of `corners`, so it is the same for every vertex of a face whatever the mesh's subdivision. Between vertices it is interpolated,
 * so on a coarse face it spreads over the cell.
 */
export function cornerTint(geo: THREE.BufferGeometry, corners: readonly (readonly [number, number, number])[], tint: CornerTint): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let d2 = Infinity;
    for (const k of corners) {
      const dx = pos.getX(i) - k[0];
      const dy = pos.getY(i) - k[1];
      const dz = pos.getZ(i) - k[2];
      d2 = Math.min(d2, dx * dx + dy * dy + dz * dz);
    }
    const f = Math.max(0, 1 - Math.sqrt(d2) / tint.reach);
    const w = tint.amount * f * f;
    for (let c = 0; c < 3; c++) col[i * 3 + c] = 1 + (tint.tint[c] - 1) * w;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
