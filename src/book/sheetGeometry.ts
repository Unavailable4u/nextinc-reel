// THE SHEET'S GEOMETRY (Patch 10). Two things live here: the GRID a sheet is drawn with (the vertex shader of `sheetShader.ts` moves it;
// the CPU twin of `sheetShape.ts` can write the same vertices into it), and the small pieces that go with a sheet: the page printed on
// a stack's face and the soft ellipse of the blob shadow. Pure functions, no React, no frame reads.
//
// THE GRID. Two layers of (cols + 1) x (rows + 1) points, 0.012 cm apart once the shader has moved them: the FRONT layer first (the
// right page of a spread, facing out of the right-hand stack) and the BACK layer after it (the left page, facing the other way). The
// attribute `aGrid` holds (u, v, layer): u from the gutter to the outer edge, v from the head to the tail, layer 0 front and 1 back.
// `position` and `normal` hold zeros until the CPU twin writes them (the shader ignores them unless `uCpu` is 1).

import * as THREE from "three";
import type { BookSpec } from "../config/books";
import { SHEET } from "../config/sheets";
import { blockBackX, layoutOf } from "./geometry";
import { sheetUV, type SheetMesh } from "./sheetShape";

/**
 * The grid of one sheet. Triangles are wound so that the front layer faces +y when the sheet lies flat on the right-hand stack
 * (angle 0) and the back layer faces the other way, so a material that draws front faces only shows each layer from outside.
 * `frustumCulled` must be false on the mesh (the bounding sphere of a grid of zeros is wrong); the sphere is set to the leaf's
 * reach anyway so a tool that asks for it gets something sensible.
 */
export function sheetGridGeometry(cols: number = SHEET.mesh.cols, rows: number = SHEET.mesh.rows, reachCm = 40): THREE.BufferGeometry {
  const per = (cols + 1) * (rows + 1);
  const n = per * 2;
  const grid = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let layer = 0; layer < 2; layer++) {
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const i = layer * per + r * (cols + 1) + c;
        const u = c / cols;
        const v = r / rows;
        grid.set([u, v, layer], i * 3);
        uv.set(sheetUV(u, v, layer === 0 ? "front" : "back"), i * 2);
      }
    }
  }
  const index: number[] = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = layer * per + r * (cols + 1) + c;
        const b = a + (cols + 1);
        const cc = a + 1;
        const d = b + 1;
        // front: (a, b, cc) has the normal z x x = +y at angle 0; the back layer reverses the winding
        if (layer === 0) index.push(a, b, cc, cc, b, d);
        else index.push(a, cc, b, cc, d, b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("aGrid", new THREE.BufferAttribute(grid, 3));
  geo.setIndex(index);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), reachCm);
  return geo;
}

/** Writes a CPU mesh (`sheetMesh`) into a grid: positions of both layers, the normals of the front layer and the flipped ones of the back. */
export function writeSheetMesh(geo: THREE.BufferGeometry, mesh: SheetMesh): void {
  const per = (mesh.cols + 1) * (mesh.rows + 1);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  if (pos.count !== per * 2) throw new Error(`sheetGeometry: the grid has ${pos.count} points, the mesh needs ${per * 2}`);
  (pos.array as Float32Array).set(mesh.front, 0);
  (pos.array as Float32Array).set(mesh.back, per * 3);
  const na = nor.array as Float32Array;
  na.set(mesh.normal, 0);
  for (let i = 0; i < per * 3; i++) na[per * 3 + i] = -mesh.normal[i];
  pos.needsUpdate = true;
  nor.needsUpdate = true;
}

export interface PageFaceOptions {
  /** the face's height in the closed frame: the plane where the two stacks meet, `splitOf(...).yMid` */
  y: number;
  /** the stacks' bow, cm: the face lies on it (`bowAmplitude` of the split) */
  bowAmp: number;
  /** "top": the right-hand stack's face, normal +y, in the base frame. "bottom": the left-hand stack's face, normal -y, in the cover's closed frame. */
  at: "top" | "bottom";
}

/**
 * The page printed on the face of a stack (guide 06 section 3: "the slab's top face is the NEXT page, so the viewer never sees a
 * hole"): a grid as wide and tall as the block, lying on the stack's bowed face a hair above it, with the page's texture
 * coordinates (canvas top = head). The right-hand face reads with its gutter on the left; the left-hand face (seen from above once
 * the cover is open) has it on the right, so its x runs the other way in the closed frame.
 */
export function pageFaceGeometry(spec: BookSpec, opts: PageFaceOptions): THREE.BufferGeometry {
  const L = layoutOf(spec);
  const { cols, rows, liftCm } = SHEET.face;
  const xb = blockBackX(L, opts.y);
  const W = L.xFore - xb;
  const H = L.zTail - L.zHead;
  const n = (cols + 1) * (rows + 1);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const ut = c / cols;
      const v = r / rows;
      const bow = opts.bowAmp * Math.sin(Math.PI * ut) * Math.sin(Math.PI * v);
      const i = r * (cols + 1) + c;
      const x = opts.at === "top" ? xb + ut * W : xb + (1 - ut) * W;
      const y = opts.at === "top" ? opts.y - bow + liftCm : opts.y - bow - liftCm;
      pos.set([x, y, L.zHead + v * H], i * 3);
      nor.set([0, opts.at === "top" ? 1 : -1, 0], i * 3);
      uv.set([ut, 1 - v], i * 2);
    }
  }
  const index: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = (r + 1) * (cols + 1) + c;
      const cc = a + 1;
      const d = b + 1;
      // top: a (u0 v0), b (u0 v1), cc (u1 v0) is counter-clockwise from +y; the bottom face is read from -y and x is mirrored, so the same order faces down
      index.push(a, b, cc, cc, b, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

/** The soft ellipse of the blob shadow, 64 x 64, as bytes (alpha 0..255): a plain function of the pixel. Strongest in the middle, fading to 0 at the edge. */
export function blobAlphaBytes(size = 64): Uint8Array {
  const out = new Uint8Array(size * size);
  const ss = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(((x + 0.5) / size) * 2 - 1);
      const dy = Math.abs(((y + 0.5) / size) * 2 - 1);
      // flat along most of the footprint, soft at the ends and softer across (the shadow of a sheet is a band, not a spot)
      out[y * size + x] = Math.round(255 * (1 - ss(0.25, 1, dx)) * (1 - ss(0.55, 1, dy)));
    }
  }
  return out;
}