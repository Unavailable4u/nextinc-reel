// PAGE TEXTURES FOR THE SHEETS (Patch 10). The painted pages of Patch 09 are canvases (`PaintedPage.canvas`, 2048 x 3072); the sheets and
// the stacks' faces need them as three.js textures. A canvas becomes a texture ONCE (cached by the canvas itself), is set up for text
// (sRGB, mip maps, 16x anisotropy: guide 06 section 7) and is never repainted per frame. `releasePageTexture` frees the GPU copy when
// a book's act is over (`disposeAct` in `paint/spread.ts` drops the canvases; call this for the textures that were made from them).
//
// The test textures of `DevPageTurn` (a checker whose sides are marked) are plain typed arrays, so Node can build and read them.

import * as THREE from "three";

const cache = new WeakMap<object, THREE.Texture>();

function configure(tex: THREE.Texture): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
}

/** The texture of a painted page: made on first use, the same object after that. */
export function pageTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const hit = cache.get(canvas);
  if (hit) return hit;
  const tex = configure(new THREE.CanvasTexture(canvas));
  cache.set(canvas, tex);
  return tex;
}

/** Frees the texture made from a canvas, if any. */
export function releasePageTexture(canvas: HTMLCanvasElement): void {
  cache.get(canvas)?.dispose();
  cache.delete(canvas);
}

let white: THREE.DataTexture | null = null;
/** A 1 x 1 white texture: what a sheet without a page shows. */
export function whiteTexture(): THREE.Texture {
  if (!white) {
    white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    white.colorSpace = THREE.SRGBColorSpace;
    white.needsUpdate = true;
  }
  return white;
}

/** RGBA bytes, top row first, of a checker of 16 x 24 squares with the gutter (two columns) and the head (the top row) marked. */
export function checkerPixels(width: number, height: number, side: "front" | "back"): Uint8Array {
  const cols = 16;
  const rows = 24;
  const out = new Uint8Array(width * height * 4);
  // the front is the right page: gutter on the left. The back is the left page: gutter on the right.
  const tone = side === "front" ? [214, 98, 60] : [60, 118, 214];
  for (let y = 0; y < height; y++) {
    const row = Math.min(rows - 1, Math.floor((y / height) * rows));
    for (let x = 0; x < width; x++) {
      const col = Math.min(cols - 1, Math.floor((x / width) * cols));
      const dark = (row + col) % 2 === 0;
      let rgb = dark ? [58, 52, 46] : [238, 232, 220];
      const gutterCol = side === "front" ? col < 2 : col >= cols - 2;
      if (gutterCol && !dark) rgb = tone;
      if (row === 0 && !dark) rgb = [220, 40, 60];
      const i = (y * width + x) * 4;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = 255;
    }
  }
  return out;
}

/** The checker as a texture (512 x 768). The data's first row is the TOP of the page; the texture is flipped so the top ends up at v = 1. */
export function checkerTexture(side: "front" | "back"): THREE.Texture {
  const w = 512;
  const h = 768;
  const top = checkerPixels(w, h, side);
  const data = new Uint8Array(top.length);
  for (let y = 0; y < h; y++) data.set(top.subarray(y * w * 4, (y + 1) * w * 4), (h - 1 - y) * w * 4);
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  return configure(tex);
}
