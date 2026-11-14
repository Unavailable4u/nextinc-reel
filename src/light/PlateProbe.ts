// THE PLATE PROBE (Patch 04, guide 03 section 7): an environment for the glossy and foil materials, made from the plate itself.
// A book's gloss and foil must reflect THIS room: the lamp, the amber strips, the dark wall. The front face of a cube is the blurred
// plate (public/plates/derived/probe-front.png, made by `npm run probe`); the other five faces are simple dark gradients; a small
// bright disc at the lamp's place stands in for the lamp, brighter than the 8-bit photo can hold, so foil can flare on it.
//
// No DOM here (faces are plain arrays and three.js DataTextures), so Node can build and test it. The React side that loads the PNG
// is src/light/ProbeEnvironment.tsx.
import * as THREE from "three";
import { PLATE_H, PLATE_W } from "../config/plate";
import { LIGHTS } from "../config/lights";
import { LAMP_PX } from "../plate/plateCamera";

/** the probe's file, relative to public/ */
export const PROBE_FILE = "plates/derived/probe-front.png";
/** the size of a cube face, px */
export const PROBE_SIZE = 128;

/** RGBA8 pixels, row 0 at the top */
export interface Rgba8 {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

export interface ProbeFace {
  /** linear RGBA, half float. Backed by a plain ArrayBuffer (never a SharedArrayBuffer), which is what DataTexture accepts. */
  data: Uint16Array<ArrayBuffer>;
  size: number;
}

/** Order three.js expects: +X, -X, +Y, -Y, +Z, -Z. The camera looks down -Z, so the plate is the -Z face and the camera's own side is +Z. */
export const FACE_ORDER = ["px", "nx", "py", "ny", "pz", "nz"] as const;
export type FaceName = (typeof FACE_ORDER)[number];

const toLinear = (v8: number): number => {
  const c = v8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** a flat or vertically graded face: linear colour at the top and at the bottom */
function gradientFace(top: [number, number, number], bottom: [number, number, number], size: number): Float32Array {
  const out = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = top[c] + (bottom[c] - top[c]) * t;
      out[i + 3] = 1;
    }
  }
  return out;
}

/** the blurred plate on the front face: the plate stretched to the square, linear light, with the lamp's hot spot added */
function frontFace(front: Rgba8, size: number): Float32Array {
  const out = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(front.height - 1, Math.floor(((y + 0.5) / size) * front.height));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(front.width - 1, Math.floor(((x + 0.5) / size) * front.width));
      const s = (sy * front.width + sx) * 4;
      const i = (y * size + x) * 4;
      out[i] = toLinear(front.data[s]);
      out[i + 1] = toLinear(front.data[s + 1]);
      out[i + 2] = toLinear(front.data[s + 2]);
      out[i + 3] = 1;
    }
  }
  // the lamp: a small bright disc where the lamp is in the plate (plate px -> face px)
  const cx = (LAMP_PX.baseBottom.x / PLATE_W) * size;
  const cy = (LAMP_PX.bulbY / PLATE_H) * size;
  const r = LIGHTS.probe.lampSpotRadiusPx;
  const warm = [1, 0.82, 0.55];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r * 2) continue;
      const w = Math.exp(-((d / r) * (d / r)));
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] += warm[c] * LIGHTS.probe.lampSpotNits * w;
    }
  }
  return out;
}

/** the camera's side: nearly black, with the one soft window of `LIGHTS.probe.sweep` that the foil of a held cover reflects (see there) */
function cameraSideFace(size: number): Float32Array {
  const out = gradientFace([0.003, 0.003, 0.004], [0.003, 0.003, 0.004], size);
  const S = LIGHTS.probe.sweep;
  const k = size / 128;
  for (let y = 0; y < size; y++) {
    const row = (y + 0.5) / k;
    const v = row <= S.rowsFull ? 1 : Math.max(0, 1 - (row - S.rowsFull) / S.rowsFade);
    if (v <= 0) continue;
    for (let x = 0; x < size; x++) {
      const d = ((x + 0.5) / k - S.colPx) / S.sigmaPx;
      const w = v * Math.exp(-0.5 * d * d);
      if (w < 1e-4) continue;
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] += S.color[c] * S.nits * w;
    }
  }
  return out;
}

const half = (f: Float32Array): Uint16Array<ArrayBuffer> => {
  const o = new Uint16Array(new ArrayBuffer(f.length * Uint16Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < f.length; i++) o[i] = THREE.DataUtils.toHalfFloat(f[i]);
  return o;
}

/**
 * The six faces. The camera's side (+Z) is nearly black apart from the sweep window (`LIGHTS.probe.sweep`); the ceiling (+Y) dim and cool; the desk (-Y) warm and dark; the sides dim.
 * Colours are linear and are STARTING values, tuned by looking at the foil in Patch 10.
 */
export function buildProbeFaces(front: Rgba8, size = PROBE_SIZE): Record<FaceName, ProbeFace> {
  const mk = (f: Float32Array): ProbeFace => ({ data: half(f), size });
  return {
    px: mk(gradientFace([0.012, 0.012, 0.014], [0.02, 0.014, 0.01], size)),
    nx: mk(gradientFace([0.012, 0.012, 0.014], [0.03, 0.02, 0.012], size)),
    py: mk(gradientFace([0.02, 0.022, 0.03], [0.02, 0.022, 0.03], size)),
    ny: mk(gradientFace([0.05, 0.027, 0.014], [0.05, 0.027, 0.014], size)),
    pz: mk(cameraSideFace(size)),
    nz: mk(frontFace(front, size)),
  };
}

/** The cube texture three.js reflects. Half-float, linear. The renderer filters it for roughness itself when it is set as scene.environment. */
export function buildProbeCube(front: Rgba8, size = PROBE_SIZE): THREE.CubeTexture {
  const faces = buildProbeFaces(front, size);
  const images = FACE_ORDER.map((n) => {
    const t = new THREE.DataTexture(faces[n].data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.needsUpdate = true;
    return t;
  });
  const cube = new THREE.CubeTexture(images as unknown as HTMLImageElement[]);
  cube.format = THREE.RGBAFormat;
  cube.type = THREE.HalfFloatType;
  cube.colorSpace = THREE.LinearSRGBColorSpace;
  cube.generateMipmaps = false;
  cube.minFilter = THREE.LinearFilter;
  cube.magFilter = THREE.LinearFilter;
  cube.needsUpdate = true;
  return cube;
}
