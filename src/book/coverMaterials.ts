// THE COVERS ON THE BOOK (Patch 08): pictures, materials and the curved spine geometry. Plain functions, no React: a painted cover in,
// three.js objects out, so Node can build the geometry and test it.
//
// EACH SURFACE has two thin overlays that lie on the cloth (the cloth itself is Patch 07's and is not touched):
//   print   the colour canvas: printed ink, and the darkening of a blind stamp. A standard material as rough as the cloth, with the
//           deboss normal map, transparent where nothing is printed.
//   foil    the foil canvas: its colour is the reflectance and its alpha the mask. `foilMaterial` (metal) with the same deboss normal map.
// They stand a few steps above the cloth, below the corner wear (`MATERIALS.decalLiftCm`), the way Patch 07's decals do.

import * as THREE from "three";
import { BOOK_GEOMETRY, type BookSpec } from "../config/books";
import { MATERIALS } from "../config/materials";
import type { Surface } from "../config/covers";
import type { Artwork } from "../paint/covers";
import { foilMaterial } from "./materials";
import { layoutOf } from "./geometry";

/** How far above the cloth each overlay stands, cm: the print first, the foil on it, then the wear (`decalLiftCm`) over both. */
export const PRINT_LIFT_CM = MATERIALS.decalLiftCm * 0.5;
export const FOIL_LIFT_CM = MATERIALS.decalLiftCm * 0.75;

export interface SurfaceTextures {
  color: THREE.CanvasTexture;
  foil: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}

function canvasTexture(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

/** The three pictures of every surface of an artwork as textures (colour and foil are sRGB, the normal map is data). */
export function surfaceTextures(art: Artwork, surface: Surface): SurfaceTextures {
  return { color: canvasTexture(art.layers[surface].color, true), foil: canvasTexture(art.layers[surface].foil, true), normal: canvasTexture(art.normals[surface], false) };
}

const decal = <M extends THREE.Material>(m: M): M => {
  m.transparent = true;
  m.depthWrite = false;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = -1;
  return m;
};

/** The printed layer: ink and blind stamps, as rough as the cloth, with the deboss. */
export function printMaterial(t: SurfaceTextures): THREE.MeshStandardMaterial {
  const m = decal(new THREE.MeshStandardMaterial({ map: t.color, normalMap: t.normal, roughness: MATERIALS.cloth.roughness, metalness: 0 }));
  m.name = "cover-print";
  return m;
}

/** The foil layer: metal, its colour from the canvas (so one surface can hold two foils), the deboss as its normal map. */
export function stampMaterial(t: SurfaceTextures): THREE.MeshStandardMaterial {
  const m = decal(foilMaterial({ color: "#FFFFFF", normalMap: t.normal }));
  m.map = t.foil;
  m.name = "cover-foil";
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------------
// the spine's curve
// ---------------------------------------------------------------------------------------------------------------------------

/** The half angle of the spine's arc: the arc runs from the back board's outer face to the front board's (`asin(T / 2R)`). */
export function spineHalfAngle(spec: BookSpec): number {
  const L = layoutOf(spec);
  return Math.asin(L.T / (2 * BOOK_GEOMETRY.spineRadiusCm));
}

/**
 * One half of the rounded back as a curved sheet, in the SPINE anchor's frame (+Z out, +X across towards the front board, +Y up the
 * book with the head up), `lift` cm outside the cloth. The back half runs from the back board to the apex (texture u from 0 to
 * 0.5), the front half from the apex to the front board (0.5 to 1): the front half is carried by the cover when it opens, so the two
 * are separate meshes. The texture is laid by ARC LENGTH, which is what the painted surface's width in cm is.
 */
export function spineHalfGeometry(spec: BookSpec, half: "back" | "front", lift: number, segments = 24): THREE.BufferGeometry {
  const L = layoutOf(spec);
  const R = BOOK_GEOMETRY.spineRadiusCm;
  const Rl = R + lift;
  const t = spineHalfAngle(spec);
  const a0 = half === "back" ? -t : 0;
  const a1 = half === "back" ? 0 : t;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    const s = Math.sin(a);
    const c = Math.cos(a);
    const u = (a + t) / (2 * t);
    // the surface at angle a: across = Rl sin a, outward = Rl cos a - R (the apex is at 0)
    for (const y of [-L.H / 2, L.H / 2]) {
      pos.push(Rl * s, y, Rl * c - R);
      nor.push(s, 0, c);
      uv.push(u, y > 0 ? 1 : 0);
    }
  }
  const index: number[] = [];
  for (let i = 0; i < segments; i++) {
    const b0 = i * 2;
    const b1 = (i + 1) * 2;
    index.push(b0, b1, b0 + 1, b1, b1 + 1, b0 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}
