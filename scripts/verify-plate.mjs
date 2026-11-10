// PLATE INTEGRITY TEST (gate G0).   npm run plate:verify
//
// You said the photo must not change. This proves it, in three steps (guide 02, "Plate integrity test"):
//   1. the original file's SHA-256 equals docs/reference/.plate.sha256;
//   2. frame 0 of the film is rendered (books hidden, no readout) and compared with what a perfect rendering of the original
//      must look like for that view (bilinear sampling in linear light, exactly what the GPU does when magnifying):
//        A. feather OFF  -> the bare photo: SSIM over the whole photo area must be >= 0.98;
//        B. feather ON   -> the real frame 0: SSIM >= 0.98 outside the feathered strips, and no pixel in the lamp / LED regions
//           (src/config/plateRegions.json) differs by more than 3 levels. The plate is 16:9 and the configured feather is 0, so B
//           reuses the render of A;
//   3. the frame has no bars (and if the plate ever stops filling the frame, the bars must be black).
// Flags: --skip-render (only the checksum), --keep (keep the rendered PNGs in out/plate-verify/)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { ROOT, OUT, ensureDir, fail, makeBundle, parseArgs, renderPng } from "./lib/env.mjs";

const args = parseArgs(process.argv.slice(2), ["skip-render", "keep", "help"]);
if (args.help) {
  console.log("npm run plate:verify [-- --skip-render --keep]");
  process.exit(0);
}

const PLATE = path.join(ROOT, "public/plates/original/desk-plate.png");
const SSIM_MIN = 0.98;
const REGION_MAX_DIFF = 3;
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
};

// ---- 1. checksum ----
const want = fs.readFileSync(path.join(ROOT, "docs/reference/.plate.sha256"), "utf8").trim().split(/\s+/)[0];
const got = crypto.createHash("sha256").update(fs.readFileSync(PLATE)).digest("hex");
console.log("\n1. Checksum of public/plates/original/desk-plate.png");
check("SHA-256 equals docs/reference/.plate.sha256", got === want, got === want ? got.slice(0, 8) + "..." + got.slice(-5) : `got ${got}, want ${want}`);
if (args["skip-render"]) finish();

// ---- load the code's own constants (so this test cannot drift from the film) ----
const tmp = ensureDir(path.join(OUT, ".tests"));
const outfile = path.join(tmp, "plate-consts.mjs");
await build({ entryPoints: [path.join(ROOT, "src/plate/PlateFollow.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent", loader: { ".json": "json" } });
const PF = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
const cfgFile = path.join(tmp, "plate-config.mjs");
await build({ entryPoints: [path.join(ROOT, "src/config/plate.ts")], bundle: true, platform: "node", format: "esm", outfile: cfgFile, logLevel: "silent", loader: { ".json": "json" } });
const CFG = await import(pathToFileURL(cfgFile).href + `?t=${Date.now()}`);
const { PLATE_W, PLATE_H, PLATE_FILE, PLATE_SHA256, INTEGRITY_REGIONS, PILLARBOX } = CFG;
check("src/config/plate.ts names this file and this checksum", `public/${PLATE_FILE}` === path.relative(ROOT, PLATE).split(path.sep).join("/") && PLATE_SHA256 === got, `${PLATE_FILE}, ${String(PLATE_SHA256).slice(0, 8)}...`);
const view = PF.VIEW_FIT;
const SW = 1920;
const SH = 1080;

// ---- the reference: what a perfect render of the original is ----
const photo = await sharp(PLATE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (photo.info.width !== PLATE_W || photo.info.height !== PLATE_H) fail(`The plate is ${photo.info.width}x${photo.info.height}, the config says ${PLATE_W}x${PLATE_H}.`, "Update src/config/plate.ts (and re-measure) if you replaced the photo on purpose.");
const toLin = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const toSrgb8 = (l) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
};
const lin = new Float32Array(PLATE_W * PLATE_H * 3);
for (let i = 0; i < lin.length; i++) lin[i] = toLin[photo.data[i]];
function sample(u, v) {
  // u, v in photo px (texel k covers [k, k+1)); texel centres at k + 0.5; clamp to edge
  const s = Math.min(Math.max(u - 0.5, 0), PLATE_W - 1);
  const t = Math.min(Math.max(v - 0.5, 0), PLATE_H - 1);
  const x0 = Math.floor(s), y0 = Math.floor(t);
  const x1 = Math.min(x0 + 1, PLATE_W - 1), y1 = Math.min(y0 + 1, PLATE_H - 1);
  const fx = s - x0, fy = t - y0;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = lin[(y0 * PLATE_W + x0) * 3 + c], b = lin[(y0 * PLATE_W + x1) * 3 + c];
    const d = lin[(y1 * PLATE_W + x0) * 3 + c], e = lin[(y1 * PLATE_W + x1) * 3 + c];
    out[c] = toSrgb8((a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy);
  }
  return out;
}
const toPhotoX = (sx) => view.cx + (sx + 0.5 - SW / 2) / view.M;
const toPhotoY = (sy) => view.cy + (sy + 0.5 - SH / 2) / view.M;

// ---- SSIM (luma, 11x11 gaussian window, sigma 1.5, standard constants) ----
function gaussKernel() {
  const k = [];
  let s = 0;
  for (let i = -5; i <= 5; i++) { const v = Math.exp(-(i * i) / (2 * 1.5 * 1.5)); k.push(v); s += v; }
  return k.map((v) => v / s);
}
const K = gaussKernel();
function blur(src, w, h) {
  const tmpB = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -5; i <= 5; i++) a += K[i + 5] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
    tmpB[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -5; i <= 5; i++) a += K[i + 5] * tmpB[Math.min(h - 1, Math.max(0, y + i)) * w + x];
    out[y * w + x] = a;
  }
  return out;
}
function ssim(a, b, w, h) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const mu1 = blur(a, w, h), mu2 = blur(b, w, h);
  const aa = new Float32Array(w * h), bb = new Float32Array(w * h), ab = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { aa[i] = a[i] * a[i]; bb[i] = b[i] * b[i]; ab[i] = a[i] * b[i]; }
  const s11 = blur(aa, w, h), s22 = blur(bb, w, h), s12 = blur(ab, w, h);
  let sum = 0, n = 0;
  for (let y = 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) {
    const i = y * w + x;
    const v1 = s11[i] - mu1[i] * mu1[i], v2 = s22[i] - mu2[i] * mu2[i], cv = s12[i] - mu1[i] * mu2[i];
    sum += ((2 * mu1[i] * mu2[i] + C1) * (2 * cv + C2)) / ((mu1[i] ** 2 + mu2[i] ** 2 + C1) * (v1 + v2 + C2));
    n++;
  }
  return sum / n;
}
const lumaOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// ---- render and compare ----
async function compare(label, feather) {
  const file = path.join(OUT, "plate-verify", `frame0-${feather ? "feather" : "bare"}.png`);
  ensureDir(path.dirname(file));
  await renderPng({ serveUrl, id: "ReelFilm", frame: 0, output: file, inputProps: { hud: false, feather } });
  const img = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (img.info.width !== SW || img.info.height !== SH) fail(`Rendered frame is ${img.info.width}x${img.info.height}, expected ${SW}x${SH}.`);
  const left = SW / 2 - view.cx * view.M;
  const right = left + PLATE_W * view.M;
  const featherPx = feather ? PILLARBOX.feather + 3 : 0;
  const x0 = Math.ceil(left + featherPx * view.M) + 3;
  const x1 = Math.floor(right - featherPx * view.M) - 3;
  const y0 = 3, y1 = SH - 3;
  const w = x1 - x0, h = y1 - y0;
  const A = new Float32Array(w * h), B = new Float32Array(w * h);
  let maxAll = 0;
  const px = (sx, sy) => { const i = (sy * SW + sx) * 3; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x0 + x, sy = y0 + y;
    const e = sample(toPhotoX(sx), toPhotoY(sy));
    const r = px(sx, sy);
    A[y * w + x] = lumaOf(...e);
    B[y * w + x] = lumaOf(...r);
    for (let c = 0; c < 3; c++) maxAll = Math.max(maxAll, Math.abs(e[c] - r[c]));
  }
  const s = ssim(A, B, w, h);
  check(`${label}: SSIM over the photo area (${w}x${h} px)`, s >= SSIM_MIN, `${s.toFixed(5)} (need >= ${SSIM_MIN}); largest single-channel difference ${maxAll} levels`);
  return { img, left, right };
}

console.log("\n2. Rendering frame 0 through the film (this bundles the project; about a minute)");
const serveUrl = await makeBundle();
const A = await compare("A. bare photo (feather off)", false);
const B = PILLARBOX.feather > 0 ? await compare("B. real frame 0 (feather on), outside the feathered strips", true) : A;
if (PILLARBOX.feather <= 0) console.log("  (feather is 0 in src/config/plate.ts: the real frame 0 is the bare photo, so B is A)");

// strict regions on the real frame 0
let worst = 0;
let worstName = "";
for (const [name, r] of Object.entries(INTEGRITY_REGIONS)) {
  let mx = 0;
  const sx0 = Math.ceil(SW / 2 + (r.x0 - view.cx) * view.M), sx1 = Math.floor(SW / 2 + (r.x1 - view.cx) * view.M);
  const sy0 = Math.ceil(SH / 2 + (r.y0 - view.cy) * view.M), sy1 = Math.floor(SH / 2 + (r.y1 - view.cy) * view.M);
  for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
    const e = sample(toPhotoX(sx), toPhotoY(sy));
    const i = (sy * SW + sx) * 3;
    for (let c = 0; c < 3; c++) mx = Math.max(mx, Math.abs(e[c] - B.img.data[i + c]));
  }
  if (mx > worst) { worst = mx; worstName = name; }
}
check(`B. strict pixel test in ${Object.keys(INTEGRITY_REGIONS).length} lamp / LED regions`, worst <= REGION_MAX_DIFF, `largest difference ${worst} levels in "${worstName}" (need <= ${REGION_MAX_DIFF})`);

// ---- 3. bars ----
console.log("\n3. Pillarbox");
if (B.left <= 0.5 && B.right >= SW - 0.5) {
  check("the photo fills the frame: no bars", true, `photo spans x ${B.left.toFixed(1)} to ${B.right.toFixed(1)} of ${SW}`);
} else {
  let barMax = 0;
  for (let y = 0; y < SH; y += 7) {
    for (let x = 0; x < Math.floor(B.left) - 4; x += 5) { const i = (y * SW + x) * 3; barMax = Math.max(barMax, B.img.data[i], B.img.data[i + 1], B.img.data[i + 2]); }
    for (let x = Math.ceil(B.right) + 4; x < SW; x += 5) { const i = (y * SW + x) * 3; barMax = Math.max(barMax, B.img.data[i], B.img.data[i + 1], B.img.data[i + 2]); }
  }
  check("bars outside the photo are black", barMax <= 1, `brightest bar pixel ${barMax}`);
}

if (!args.keep) fs.rmSync(path.join(OUT, "plate-verify"), { recursive: true, force: true });
finish();

function finish() {
  const bad = results.filter((r) => !r.ok);
  console.log(bad.length ? `\nPLATE VERIFY: FAILED (${bad.length} of ${results.length} checks)\n` : `\nPLATE VERIFY: PASSED (${results.length} checks). The photo is untouched.\n`);
  process.exit(bad.length ? 1 : 0);
}
