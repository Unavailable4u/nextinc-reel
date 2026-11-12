// THE PROCEDURAL TEXTURES (Patch 07). Pure functions: a texture's name in, its pixels out. No DOM, no file system, no Math.random;
// every random value is an integer hash of (cell, seed), so the same name always gives the same bytes on every machine
// (determinism rule 5). `scripts/make-textures.mjs` bundles this file, encodes the pixels as PNG with sharp and writes
// `public/textures/`; `tests/textures.test.ts` generates them again in memory and compares the SHA-256 of the pixels with
// `public/textures/manifest.json`.
//
// Only + - * / sqrt, floor, min, max, round and a few integer operations are used in the pixel loops, and `Math.sin`/`Math.exp`
// not at all, so there is nothing a platform's maths library could round differently.
//
// WHAT EACH ONE IS (sizes, tile sizes and seeds are in `config/materials.ts`):
//   cloth-normal  plain weave, 8 threads each way per 0.2 cm tile (40 per cm), as a tangent-space normal map (OpenGL green)
//   cloth-rough   the weave again, as a roughness multiplier between 0.9 and 1.0
//   cloth-tone    thread-by-thread dye differences and larger soft patches, 0.9 to 1.0 of the cloth colour
//   paper-grain   short fibres and fine mottling, 0.9 to 1.0 of the paper colour
//   edge-lines    the edges of the sheets: 20 fine, slightly wavy lines per tile
//   corner-wear   alpha for rubbing at the corners and along the edges of a board
//   dust          alpha for a faint film with a few specks

import { TEXTURES, TEXTURE_NAMES, type TextureName } from "../config/materials";

export interface RawTexture {
  width: number;
  height: number;
  channels: 1 | 3;
  /** row 0 at the top, `channels` bytes per pixel */
  data: Uint8Array;
}

// ---------------------------------------------------------------------------------------------------------------------------
// noise: integer hashes, smooth value noise that wraps
// ---------------------------------------------------------------------------------------------------------------------------

/** A number in [0, 1) from two integers and a seed. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/**
 * Smooth value noise on a lattice of `px` x `py` cells over the unit square, wrapping at its edges (so it tiles). `fx` and `fy` are
 * in [0, 1); values outside wrap. The result is in [0, 1].
 */
export function vnoise(fx: number, fy: number, px: number, py: number, seed: number): number {
  const gx = fx * px;
  const gy = fy * py;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const tx = gx - ix;
  const ty = gy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const x0 = wrap(ix, px);
  const x1 = wrap(ix + 1, px);
  const y0 = wrap(iy, py);
  const y1 = wrap(iy + 1, py);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal noise: `octaves` layers of `vnoise`, each twice as fine and half as strong. In [0, 1]. Tiles when the lattice does. */
export function fbm(fx: number, fy: number, px: number, py: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(fx, fy, px << o, py << o, seed + o * 101);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const q8 = (v: number): number => Math.round(clamp01(v) * 255);

// ---------------------------------------------------------------------------------------------------------------------------
// the weave
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * The height field of a plain weave on an N x N tile with T threads each way: in a cell the warp (vertical) thread is over when
 * the cell's column plus row is even, the weft (horizontal) thread when it is odd; the thread that is over is a round ridge that
 * bulges at the middle of the cell. Each thread has its own seeded height, and a little fibre noise rides on top. Wraps at the edges.
 */
export function weaveHeight(N: number, T: number, seed: number, fibres = 1): Float32Array {
  const pitch = N / T;
  const warp = new Float32Array(T);
  const weft = new Float32Array(T);
  for (let i = 0; i < T; i++) {
    warp[i] = (hash2(i, 1, seed) - 0.5) * 0.12;
    weft[i] = (hash2(i, 2, seed) - 0.5) * 0.12;
  }
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const cy = Math.floor(y / pitch);
    const ay = (2 * (y - cy * pitch + 0.5)) / pitch - 1;
    for (let x = 0; x < N; x++) {
      const cx = Math.floor(x / pitch);
      const ax = (2 * (x - cx * pitch + 0.5)) / pitch - 1;
      let v: number;
      if (((cx + cy) & 1) === 0) {
        // warp over: a vertical ridge, rounder across (ax) and bulging along (ay)
        v = 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - ax * ax)) * (0.7 + 0.3 * (1 - ay * ay)) + warp[cx];
      } else {
        v = 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - ay * ay)) * (0.7 + 0.3 * (1 - ax * ax)) + weft[cy];
      }
      // slubs (slow, along the tile) and fibres (per pixel)
      v += 0.05 * fibres * (vnoise(x / N, y / N, 16, 16, seed + 5) - 0.5);
      v += 0.03 * fibres * (hash2(x, y, seed + 9) - 0.5);
      h[y * N + x] = v;
    }
  }
  return h;
}

// ---------------------------------------------------------------------------------------------------------------------------
// the seven pictures
// ---------------------------------------------------------------------------------------------------------------------------

function clothNormal(s: (typeof TEXTURES)["cloth-normal"]): RawTexture {
  const N = s.width;
  const T = 8;
  const h = weaveHeight(N, T, s.seed);
  const out = new Uint8Array(N * N * 3);
  const S = 4; // normal strength: how steep the ridges read (the material's normalScale does the rest)
  for (let y = 0; y < N; y++) {
    const ya = wrap(y - 1, N);
    const yb = wrap(y + 1, N);
    for (let x = 0; x < N; x++) {
      const xa = wrap(x - 1, N);
      const xb = wrap(x + 1, N);
      const dhdx = (h[y * N + xb] - h[y * N + xa]) * 0.5;
      // image rows run down and v runs up, so dh/dv is the row above minus the row below
      const dhdv = (h[ya * N + x] - h[yb * N + x]) * 0.5;
      const nx = -dhdx * S;
      const ny = -dhdv * S;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * N + x) * 3;
      out[i] = q8(nx * inv * 0.5 + 0.5);
      out[i + 1] = q8(ny * inv * 0.5 + 0.5);
      out[i + 2] = q8(inv * 0.5 + 0.5);
    }
  }
  return { width: N, height: N, channels: 3, data: out };
}

function clothRough(s: (typeof TEXTURES)["cloth-rough"]): RawTexture {
  const N = s.width;
  const h = weaveHeight(N, 8, TEXTURES["cloth-normal"].seed); // the same weave as the normal map, so valleys and ridges agree
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ridge = clamp01((h[y * N + x] - 0.55) / 0.45);
      const n = fbm(x / N, y / N, 8, 8, 3, s.seed);
      // ridges are polished by use and valleys stay rough; the multiplier stays between 0.9 and 1.0
      out[y * N + x] = q8(0.9 + 0.1 * (0.55 * n + 0.45 * (1 - ridge)));
    }
  }
  return { width: N, height: N, channels: 1, data: out };
}

function clothTone(s: (typeof TEXTURES)["cloth-tone"]): RawTexture {
  const N = s.width;
  const T = 64; // 64 threads over 1.6 cm: 40 per cm
  const pitch = N / T;
  const warp = new Float32Array(T);
  const weft = new Float32Array(T);
  for (let i = 0; i < T; i++) {
    warp[i] = (hash2(i, 3, s.seed) - 0.5) * 0.05;
    weft[i] = (hash2(i, 4, s.seed) - 0.5) * 0.05;
  }
  const out = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    const cy = Math.floor(y / pitch);
    for (let x = 0; x < N; x++) {
      const cx = Math.floor(x / pitch);
      const thread = ((cx + cy) & 1) === 0 ? warp[cx] : weft[cy];
      const patch = fbm(x / N, y / N, 3, 3, 3, s.seed);
      out[y * N + x] = q8(0.955 + 0.045 * patch + thread);
    }
  }
  return { width: N, height: N, channels: 1, data: out };
}

function paperGrain(s: (typeof TEXTURES)["paper-grain"]): RawTexture {
  const N = s.width;
  const f = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) f[y * N + x] = 0.965 + 0.035 * fbm(x / N, y / N, 32, 32, 2, s.seed);
  // short fibres: a seeded line segment each, wrapping at the edges
  for (let k = 0; k < 700; k++) {
    const x0 = Math.floor(hash2(k, 11, s.seed) * N);
    const y0 = Math.floor(hash2(k, 12, s.seed) * N);
    // a direction without trigonometry: the first point of a seeded sequence inside the unit disc, normalised
    let dx = 1;
    let dy = 0;
    for (let t = 0; t < 8; t++) {
      const ux = hash2(k, 20 + 2 * t, s.seed) * 2 - 1;
      const uy = hash2(k, 21 + 2 * t, s.seed) * 2 - 1;
      const r2 = ux * ux + uy * uy;
      if (r2 > 0.05 && r2 <= 1) {
        const inv = 1 / Math.sqrt(r2);
        dx = ux * inv;
        dy = uy * inv;
        break;
      }
    }
    const len = 4 + Math.floor(hash2(k, 13, s.seed) * 11);
    const amount = (hash2(k, 14, s.seed) - 0.55) * 0.05;
    for (let t = 0; t < len; t++) {
      const px = wrap(Math.round(x0 + dx * t), N);
      const py = wrap(Math.round(y0 + dy * t), N);
      f[py * N + px] += amount;
    }
  }
  const out = new Uint8Array(N * N);
  for (let i = 0; i < out.length; i++) out[i] = q8(Math.max(0.9, Math.min(1, f[i])));
  return { width: N, height: N, channels: 1, data: out };
}

function edgeLines(s: (typeof TEXTURES)["edge-lines"]): RawTexture {
  const W = s.width;
  const H = s.height;
  const LINES = 20;
  const lineH = H / LINES;
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // each line wanders a little along its length (the sheets of a real block are never quite level)
      const yy = y + 1.8 * 2 * (vnoise(x / W, y / H, 4, LINES, s.seed) - 0.5);
      const li = wrap(Math.floor(yy / lineH), LINES);
      const f = wrap(yy, H) / lineH - Math.floor(wrap(yy, H) / lineH);
      const d = Math.min(f, 1 - f);
      const sm = clamp01(1 - d / 0.14);
      const seam = sm * sm;
      const base = 0.965 + 0.035 * hash2(li, 0, s.seed);
      const depth = 0.22 * (0.6 + 0.4 * hash2(li, 1, s.seed));
      let v = base * (1 - depth * seam);
      v *= 1 + 0.03 * (hash2(x, y, s.seed + 9) - 0.5);
      v *= 0.985 + 0.015 * vnoise(x / W, 0.37, 4, 4, s.seed + 3);
      out[y * W + x] = q8(v);
    }
  }
  return { width: W, height: H, channels: 1, data: out };
}

function cornerWear(s: (typeof TEXTURES)["corner-wear"]): RawTexture {
  const W = s.width;
  const H = s.height;
  const [wCm, hCm] = s.coverCm;
  const R = 2.0; // reach of a corner's rubbing, cm
  const strength = [0, 1, 2, 3].map((c) => 0.6 + 0.4 * hash2(c, 5, s.seed));
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const cy = ((y + 0.5) / H) * hCm;
    for (let x = 0; x < W; x++) {
      const cx = ((x + 0.5) / W) * wCm;
      let corner = 0;
      for (let c = 0; c < 4; c++) {
        const dx = (c & 1 ? wCm - cx : cx);
        const dy = (c & 2 ? hCm - cy : cy);
        const f = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R);
        corner = Math.max(corner, f * f * strength[c]);
      }
      const e = Math.min(cx, wCm - cx, cy, hCm - cy);
      const em = Math.max(0, 1 - e / 0.35);
      const edge = 0.45 * em * em;
      const base = Math.max(corner, edge);
      if (base <= 0) continue; // nothing rubs the middle of the board
      const n = fbm(x / W, y / H, 6, 8, 4, s.seed);
      const n2 = fbm(x / W, y / H, 24, 36, 2, s.seed + 7);
      // a ragged threshold: rubbing breaks up into patches instead of a smooth blob, and only where something rubs
      const ragged = (n2 - 0.5) * 0.7 * Math.min(1, base * 4);
      out[y * W + x] = q8(base * (0.55 + 0.9 * n) * 1.5 + ragged - 0.06);
    }
  }
  return { width: W, height: H, channels: 1, data: out };
}

function dustFilm(s: (typeof TEXTURES)["dust"]): RawTexture {
  const W = s.width;
  const H = s.height;
  const speck = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      speck[y * W + x] = hash2(x, y, s.seed + 3) > 0.985 ? 0.5 + 0.5 * hash2(x, y, s.seed + 4) : 0;
    }
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // a soft film with thin and thick places, plus the specks spread over a 3 x 3 neighbourhood
      const n = fbm(x / W, y / H, 3, 4, 3, s.seed);
      const film = 0.22 * n * n;
      let sp = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) sp += speck[Math.min(H - 1, Math.max(0, y + j)) * W + Math.min(W - 1, Math.max(0, x + i))] * (i === 0 && j === 0 ? 0.5 : 0.0625);
      out[y * W + x] = q8(film + sp * 0.8);
    }
  }
  return { width: W, height: H, channels: 1, data: out };
}

/** The pixels of one named texture. Deterministic. */
export function generateTexture(name: TextureName): RawTexture {
  switch (name) {
    case "cloth-normal":
      return clothNormal(TEXTURES[name]);
    case "cloth-rough":
      return clothRough(TEXTURES[name]);
    case "cloth-tone":
      return clothTone(TEXTURES[name]);
    case "paper-grain":
      return paperGrain(TEXTURES[name]);
    case "edge-lines":
      return edgeLines(TEXTURES[name]);
    case "corner-wear":
      return cornerWear(TEXTURES[name]);
    case "dust":
      return dustFilm(TEXTURES[name]);
  }
}

/** All seven, in the order of `TEXTURE_NAMES`. */
export function generateAll(): Record<TextureName, RawTexture> {
  const out = {} as Record<TextureName, RawTexture>;
  for (const n of TEXTURE_NAMES) out[n] = generateTexture(n);
  return out;
}