// The procedural textures (Patch 07): the same pixels every time, the manifest agrees, the sizes and ranges are what the config says,
// and the tiles have no seam.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TEXTURES, TEXTURE_BUDGET_BYTES, TEXTURE_GENERATOR_VERSION, TEXTURE_MANIFEST_FILE, TEXTURE_NAMES, gpuBytes, type TextureName } from "../src/config/materials";
import { generateAll, generateTexture, hash2, vnoise, type RawTexture } from "../src/paint/textures";
import { eq, near, test, truthy } from "./harness";

const ROOT = process.cwd();
const sha = (data: Uint8Array): string => crypto.createHash("sha256").update(data).digest("hex");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public", TEXTURE_MANIFEST_FILE), "utf8")) as {
  generator: number;
  textures: Record<string, { sha256: string; file: string; width: number; height: number; channels: number }>;
};
const all = generateAll();

const stat = (t: RawTexture): { min: number; max: number; mean: number } => {
  let min = 255;
  let max = 0;
  let sum = 0;
  for (const v of t.data) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / t.data.length };
};
/** the byte of channel `c` at (x, y) */
const px = (t: RawTexture, x: number, y: number, c = 0): number => t.data[(y * t.width + x) * t.channels + c];
/** the mean absolute difference between two columns (or two rows) of channel 0 */
const colDiff = (t: RawTexture, a: number, b: number): number => {
  let s = 0;
  for (let y = 0; y < t.height; y++) s += Math.abs(px(t, a, y) - px(t, b, y));
  return s / t.height;
};
const rowDiff = (t: RawTexture, a: number, b: number): number => {
  let s = 0;
  for (let x = 0; x < t.width; x++) s += Math.abs(px(t, x, a) - px(t, x, b));
  return s / t.width;
};

test("hash2 and vnoise: in range, the same twice, and vnoise wraps", () => {
  for (let i = 0; i < 200; i++) {
    const h = hash2(i, i * 7 - 50, 7101);
    truthy(h >= 0 && h < 1, "hash2 in [0, 1)");
    eq(h, hash2(i, i * 7 - 50, 7101), "hash2 repeats");
  }
  near(vnoise(0.25, 0.4, 4, 4, 9), vnoise(1.25, 1.4, 4, 4, 9), 1e-12, "vnoise has period 1");
});

test("textures: every picture is deterministic (made twice, the same bytes)", () => {
  for (const n of TEXTURE_NAMES) eq(sha(generateTexture(n).data), sha(all[n].data), n);
});

test("textures: the pixels agree with public/textures/manifest.json (the hash check)", () => {
  eq(manifest.generator, TEXTURE_GENERATOR_VERSION, "generator version (run `npm run textures` after a meant change)");
  eq(Object.keys(manifest.textures).sort().join(","), [...TEXTURE_NAMES].sort().join(","), "the manifest lists the seven pictures");
  for (const n of TEXTURE_NAMES) eq(sha(all[n].data), manifest.textures[n].sha256, `${n} differs from the manifest: run \`npm run textures\` if the change was meant`);
});

test("textures: sizes, channels and data length are what config/materials.ts says", () => {
  for (const n of TEXTURE_NAMES) {
    const s = TEXTURES[n];
    const t = all[n];
    eq(t.width, s.width, `${n} width`);
    eq(t.height, s.height, `${n} height`);
    eq(t.channels, s.channels, `${n} channels`);
    eq(t.data.length, s.width * s.height * s.channels, `${n} length`);
  }
});

test("textures: the PNG files are the right size and kind (grey for one channel, RGB for three)", () => {
  for (const n of TEXTURE_NAMES) {
    const s = TEXTURES[n];
    const b = fs.readFileSync(path.join(ROOT, "public", s.file));
    eq(b.subarray(1, 4).toString("latin1"), "PNG", `${n} signature`);
    eq(b.readUInt32BE(16), s.width, `${n} width`);
    eq(b.readUInt32BE(20), s.height, `${n} height`);
    eq(b[24], 8, `${n} bit depth`);
    eq(b[25], s.channels === 1 ? 0 : 2, `${n} colour type`);
    const chunks: string[] = [];
    for (let i = 8; i < b.length; i += 12 + b.readUInt32BE(i)) chunks.push(b.subarray(i + 4, i + 8).toString("latin1"));
    truthy(!chunks.includes("iCCP") && !chunks.includes("gAMA") && !chunks.includes("sRGB") && !chunks.includes("cHRM"), `${n} has no colour chunk, so a browser reads the bytes as they are`);
  }
});

test("textures: all seven stay under the budget as RGBA8 with mip maps (guide 02)", () => {
  const total = TEXTURE_NAMES.reduce((a, n) => a + gpuBytes(TEXTURES[n]), 0);
  truthy(total <= TEXTURE_BUDGET_BYTES, `${total} bytes is over ${TEXTURE_BUDGET_BYTES}`);
  near(total / 1048576, 3.9, 0.1, "the figure the config quotes");
});

test("textures: the thread counts agree (the config, the generator and the comments)", () => {
  const C = TEXTURES;
  // the weave tile: 8 threads each way over 0.2 cm is 40 per cm, and the tone map 64 over 1.6 cm
  near(C["cloth-normal"].coverCm[0] * 40, 8, 1e-9, "weave threads per tile");
  near(C["cloth-tone"].coverCm[0] * 40, 64, 1e-9, "tone threads per tile");
  // the edge tile: 20 lines over 0.5 cm is 40 per cm
  near(C["edge-lines"].coverCm[1] * 40, 20, 1e-9, "sheet lines per tile");
});

test("textures: value ranges (the multipliers stay 0.9 to 1.0, the normal points out of the surface)", () => {
  const n = all["cloth-normal"];
  let minZ = 255;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n.width * n.height; i++) {
    minZ = Math.min(minZ, n.data[i * 3 + 2]);
    sx += n.data[i * 3];
    sy += n.data[i * 3 + 1];
  }
  truthy(minZ >= 128, "no normal points into the surface");
  near(sx / (n.width * n.height), 127.5, 3, "the weave is flat on average (x)");
  near(sy / (n.width * n.height), 127.5, 3, "the weave is flat on average (y)");
  for (const name of ["cloth-rough", "cloth-tone", "paper-grain"] as TextureName[]) {
    const s = stat(all[name]);
    truthy(s.min >= 229, `${name} stays at or above 0.9 (min ${s.min})`);
    truthy(s.max <= 255, `${name} max`);
  }
  const edge = stat(all["edge-lines"]);
  truthy(edge.min >= 150 && edge.mean > 235, "the sheet lines are fine and pale");
});

test("textures: the tiles have no seam (the wrap is as quiet as the inside)", () => {
  for (const name of TEXTURE_NAMES.filter((n) => TEXTURES[n].tiles)) {
    const t = all[name];
    let inner = 0;
    for (let x = 0; x < t.width - 1; x++) inner += colDiff(t, x, x + 1);
    inner /= t.width - 1;
    let innerRows = 0;
    for (let y = 0; y < t.height - 1; y++) innerRows += rowDiff(t, y, y + 1);
    innerRows /= t.height - 1;
    truthy(colDiff(t, t.width - 1, 0) <= 3 * inner + 3, `${name}: the left and right edges do not meet (${colDiff(t, t.width - 1, 0).toFixed(2)} vs ${inner.toFixed(2)})`);
    truthy(rowDiff(t, t.height - 1, 0) <= 3 * innerRows + 3, `${name}: the top and bottom edges do not meet (${rowDiff(t, t.height - 1, 0).toFixed(2)} vs ${innerRows.toFixed(2)})`);
  }
});

test("corner-wear: nothing in the middle of the board, rubbing at every corner and edge", () => {
  const t = all["corner-wear"];
  let middle = 0;
  for (let y = Math.floor(t.height * 0.25); y < Math.floor(t.height * 0.75); y++) for (let x = Math.floor(t.width * 0.25); x < Math.floor(t.width * 0.75); x++) middle = Math.max(middle, px(t, x, y));
  eq(middle, 0, "the middle is untouched");
  const win = 28;
  const corners: [number, number][] = [
    [0, 0],
    [t.width - win, 0],
    [0, t.height - win],
    [t.width - win, t.height - win],
  ];
  for (const [x0, y0] of corners) {
    let m = 0;
    for (let y = y0; y < y0 + win; y++) for (let x = x0; x < x0 + win; x++) m = Math.max(m, px(t, x, y));
    truthy(m >= 90, `a corner is rubbed (max ${m})`);
  }
  let edge = 0;
  for (let y = 0; y < t.height; y++) edge = Math.max(edge, px(t, 0, y), px(t, 1, y));
  truthy(edge > 0, "the fore-edge side is worn");
});

test("dust: a faint film (low alpha on average, a few brighter specks)", () => {
  const d = stat(all.dust);
  truthy(d.mean > 2 && d.mean < 40, `mean alpha ${d.mean.toFixed(1)}`);
  truthy(d.max > 60, "there are specks");
});
