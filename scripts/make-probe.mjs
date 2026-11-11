// THE PROBE IMAGE (Patch 04).   npm run probe
//
// Writes public/plates/derived/probe-front.png: the plate, blurred and reduced to 128 x 128 (guide 03 section 7), for the front face
// of the environment cube (src/light/PlateProbe.ts). The plate is only READ. The blur is done in linear light (an sRGB blur darkens
// the amber strips), by area-averaging down to the face size and then a small Gaussian, so the strips and the lamp survive as soft
// warm shapes. Deterministic: the same plate always gives the same bytes.
// Flags: --size=128  --sigma=2  (sigma in face px; 2 px is about 24 plate px across)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { ROOT, ensureDir, fail, parseArgs } from "./lib/env.mjs";

const PLATE = path.join(ROOT, "public/plates/original/desk-plate.png");
export const PROBE_PATH = path.join(ROOT, "public/plates/derived/probe-front.png");

const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const toSrgb8 = (l) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
};

/** area-average one axis: `src` has `n` samples per line over `lines` lines of 3 channels; returns `m` samples per line */
function shrink(src, n, m, lines, stride, lineStride) {
  const out = new Float32Array(m * lines * 3);
  for (let l = 0; l < lines; l++) {
    for (let o = 0; o < m; o++) {
      const a = (o * n) / m;
      const b = ((o + 1) * n) / m;
      let acc0 = 0, acc1 = 0, acc2 = 0, wsum = 0;
      for (let i = Math.floor(a); i < Math.ceil(b); i++) {
        const w = Math.min(i + 1, b) - Math.max(i, a);
        const p = l * lineStride + i * stride;
        acc0 += src[p] * w;
        acc1 += src[p + 1] * w;
        acc2 += src[p + 2] * w;
        wsum += w;
      }
      const q = (l * m + o) * 3;
      out[q] = acc0 / wsum;
      out[q + 1] = acc1 / wsum;
      out[q + 2] = acc2 / wsum;
    }
  }
  return out;
}

function gaussian1d(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = [];
  let s = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    s += v;
  }
  return { r, k: k.map((v) => v / s) };
}

function blur(src, w, h, sigma) {
  if (sigma <= 0) return src;
  const { r, k } = gaussian1d(sigma);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let a = 0;
        for (let i = -r; i <= r; i++) a += k[i + r] * src[(y * w + Math.min(w - 1, Math.max(0, x + i))) * 3 + c];
        tmp[(y * w + x) * 3 + c] = a;
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        let a = 0;
        for (let i = -r; i <= r; i++) a += k[i + r] * tmp[(Math.min(h - 1, Math.max(0, y + i)) * w + x) * 3 + c];
        out[(y * w + x) * 3 + c] = a;
      }
  return out;
}

/** Makes the probe image. Returns the path written. */
export async function makeProbe({ size = 128, sigma = 2 } = {}) {
  if (!fs.existsSync(PLATE)) fail(`The plate is missing: ${PLATE}`, "Restore public/plates/original/desk-plate.png (git checkout).");
  const img = await sharp(PLATE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = img.info;
  const lin = new Float32Array(width * height * 3);
  for (let i = 0; i < lin.length; i++) lin[i] = toLin[img.data[i]];
  // width first (every row to `size` samples), then height (every column to `size` samples)
  const wide = shrink(lin, width, size, height, 3, width * 3); // height rows of `size`
  const small = shrink(wide, height, size, size, size * 3, 3); // per column: treat the column as a line
  // `small` is laid out column by column (size columns of `size` rows): transpose to rows
  const rows = new Float32Array(size * size * 3);
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let c = 0; c < 3; c++) rows[(y * size + x) * 3 + c] = small[(x * size + y) * 3 + c];
  const soft = blur(rows, size, size, sigma);
  const u8 = Buffer.alloc(size * size * 3);
  for (let i = 0; i < soft.length; i++) u8[i] = toSrgb8(soft[i]);
  ensureDir(path.dirname(PROBE_PATH));
  await sharp(u8, { raw: { width: size, height: size, channels: 3 } }).png({ compressionLevel: 9 }).toFile(PROBE_PATH);
  return PROBE_PATH;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2), ["size", "sigma", "help"]);
  if (args.help) {
    console.log("npm run probe [-- --size=128 --sigma=2]");
    process.exit(0);
  }
  const out = await makeProbe({ size: args.size ? Number(args.size) : 128, sigma: args.sigma ? Number(args.sigma) : 2 });
  console.log(`Wrote ${path.relative(ROOT, out)} (${fs.statSync(out).size} bytes). The plate was only read.`);
}
