// Decodes every QR code of the book pages from a RENDERED still and compares it with the target the selectors give (Patch 09, guide 04
// "QR code rules").   npm run qr:check     (-- --book=mini-me to look at one book, -- --keep to keep the stills in out/qr)
//
// FILM FRAMES (Patch 16, gate G2).   npm run qr:check -- --frames=2600-2700 [--every=20] [--clean] [--keep]
// Renders those frames of the FILM itself (`ReelFilm`, no readout, with its grain and vignette as a viewer sees them; `--clean` switches
// the grain and the vignette off to tell a QR problem from a grain problem) and looks for codes in the whole 1920 x 1080 picture, the way
// a phone looks at a screen: each code found is read, painted out, and the picture searched again. A frame passes when it shows exactly the
// book's targets (`--book`, default mini-me) and nothing else. Exit code 1 when a frame fails. The frames of the hold are 2640-2759.
//
// How: the Studio's `DevPages` composition (view "page") draws one page, as painted, with nothing over it. This script renders that still
// for every P-LINK and P-BACK page at `PAGE.qrCheckPxPerCm` (40) pixels per centimetre of paper (about what S13 and S20 give on screen),
// cuts out each code's light square (the plan says where it is) and reads it with jsQR, a decoder that is not the generator. A code that
// does not decode, decodes to another address, or is under 3.4 cm fails. Exit code 1 on any failure.
//
// Needs a browser (Remotion downloads its own on first use; REMOTION_BROWSER_EXECUTABLE to use another; REMOTION_GL as for the other scripts).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import jsQR from "jsqr";
import sharp from "sharp";
import { ROOT, OUT, parseArgs, fail, ensureDir, makeBundle, renderPng } from "./lib/env.mjs";

const args = parseArgs(process.argv.slice(2), ["book", "keep", "frames", "every", "clean"]);

// the plans, from the TypeScript (esbuild reads it, as `npm run timeline` does). Where a code stands does not depend on the width of
// the letters, so a rough measure is enough here; the picture sizes do not matter either.
const tmp = ensureDir(path.join(OUT, ".tests"));
const entry = path.join(tmp, "qr-entry.ts");
fs.writeFileSync(
  entry,
  [
    `export { BOOK_IDS, BOOKS } from ${JSON.stringify(path.join(ROOT, "src/config/books.ts"))};`,
    `export { PAGE, PAGE_H, PAGE_PX_PER_CM } from ${JSON.stringify(path.join(ROOT, "src/config/pages.ts"))};`,
    `export { QR_MIN_CODE_CM } from ${JSON.stringify(path.join(ROOT, "src/paint/qr.ts"))};`,
    `export { HEIGHT, WIDTH } from ${JSON.stringify(path.join(ROOT, "src/config/timeline.ts"))};`,
    `export { getQrTargets } from ${JSON.stringify(path.join(ROOT, "src/data/select.ts"))};`,
    `export { planBook } from ${JSON.stringify(path.join(ROOT, "src/paint/pages/index.ts"))};`,
  ].join("\n"),
);
const outfile = path.join(tmp, "qr-bundle.mjs");
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent", loader: { ".json": "json" } });
const m = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);

if (args.frames !== undefined) {
  const range = /^(\d+)-(\d+)$/.exec(String(args.frames));
  if (!range) fail(`--frames needs a range like 2600-2700, got "${args.frames}"`, "for example: npm run qr:check -- --frames=2600-2700 --every=20");
  const first = Number(range[1]);
  const last = Number(range[2]);
  const every = args.every !== undefined && args.every !== true ? Number(args.every) : 20;
  if (!(last >= first) || !(every >= 1)) fail("--frames needs the first frame before the last, and --every at least 1");
  const book = args.book && args.book !== true ? args.book : "mini-me";
  if (!m.BOOK_IDS.includes(book)) fail(`unknown book "${book}"`, `one of: ${m.BOOK_IDS.join(", ")}`);
  const want = m.getQrTargets(book).map((t) => t.url);
  const serveUrl = await makeBundle();
  const dir = ensureDir(path.join(OUT, "qr"));
  const frames = [];
  for (let f = first; f <= last; f += every) frames.push(f);
  if (frames[frames.length - 1] !== last) frames.push(last);
  let failed = 0;
  for (const f of frames) {
    const file = path.join(dir, `film-f${String(f).padStart(4, "0")}.png`);
    await renderPng({ serveUrl, id: "ReelFilm", frame: f, output: file, inputProps: { hud: false, feather: true, grain: args.clean !== true, vignette: args.clean !== true } });
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = new Uint8ClampedArray(data);
    const found = [];
    for (let pass = 0; pass < want.length + 2; pass++) {
      const hit = jsQR(px, info.width, info.height);
      if (!hit) break;
      found.push({ url: hit.data, size: Math.round(Math.hypot(hit.location.topRightCorner.x - hit.location.topLeftCorner.x, hit.location.topRightCorner.y - hit.location.topLeftCorner.y)) });
      // paint the code out (its bounding box and a margin) so the next pass can find another one
      const xs = Object.values(hit.location).map((p) => p.x);
      const ys = Object.values(hit.location).map((p) => p.y);
      const padPx = 12;
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - padPx);
      const x1 = Math.min(info.width, Math.ceil(Math.max(...xs)) + padPx);
      const y0 = Math.max(0, Math.floor(Math.min(...ys)) - padPx);
      const y1 = Math.min(info.height, Math.ceil(Math.max(...ys)) + padPx);
      for (let y = y0; y < y1; y++) px.fill(255, (y * info.width + x0) * 4, (y * info.width + x1) * 4);
    }
    const missing = want.filter((u) => !found.some((x) => x.url === u));
    const extra = found.filter((x) => !want.includes(x.url));
    const ok = missing.length === 0 && extra.length === 0;
    if (!ok) failed++;
    console.log(`  ${ok ? "ok    " : "FAIL  "} f${String(f).padStart(4, "0")}  ${found.length} code(s) found${found.length ? " (" + found.map((x) => `${x.size} px wide`).join(", ") + ")" : ""}${ok ? "" : "  <- " + [...missing.map((u) => `missing ${u}`), ...extra.map((x) => `unexpected "${x.url}"`)].join("; ")}`);
    if (!args.keep) fs.rmSync(file, { force: true });
  }
  console.log(`\n${frames.length - failed}/${frames.length} frames show exactly the codes of ${book}${args.keep ? ` (stills kept in ${path.relative(ROOT, dir)})` : ""}`);
  process.exit(failed ? 1 : 0);
}

const books = args.book && args.book !== true ? [args.book] : m.BOOK_IDS;
for (const id of books) if (!m.BOOK_IDS.includes(id)) fail(`unknown book "${id}"`, `one of: ${m.BOOK_IDS.join(", ")}`);

const measure = (text, f) => Array.from(text).length * f.size * (f.weight === 700 ? 0.55 : 0.5);
const tokensOf = (id) => ({ spec: m.BOOKS[id], measure, imageSize: () => ({ w: 1600, h: 1000 }) });

// the still: page `index`, as tall as the picture less 30 px above and below, at 40 px per cm of paper
const k = (m.HEIGHT - 60) / m.PAGE_H;
const scale = m.PAGE.qrCheckPxPerCm / (k * m.PAGE_PX_PER_CM);

const jobs = [];
for (const id of books) {
  for (const p of m.planBook(id, tokensOf(id))) {
    if (p.qr.length > 0) jobs.push({ id, plan: p });
  }
}
if (jobs.length === 0) fail("no page carries a code");

const serveUrl = await makeBundle();
const dir = ensureDir(path.join(OUT, "qr"));
let bad = 0;
let checked = 0;
for (const { id, plan } of jobs) {
  const file = path.join(dir, `${id}-p${String(plan.index).padStart(2, "0")}-${plan.type}.png`);
  await renderPng({
    serveUrl,
    id: "DevPages",
    frame: 0,
    output: file,
    scale,
    inputProps: { view: "page", id, spread: 0, page: plan.index, readableOnly: false, overlay: false, panel: false },
  });
  const img = sharp(file).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const targets = m.getQrTargets(id);
  for (const q of plan.qr) {
    checked++;
    // the light square (the code and its quiet zone) in the still's pixels, and a pad of paper round it
    const pad = Math.round(q.module * k * scale * 2);
    const x0 = Math.max(0, Math.floor((30 + q.quiet.x * k) * scale) - pad);
    const y0 = Math.max(0, Math.floor((30 + q.quiet.y * k) * scale) - pad);
    const x1 = Math.min(info.width, Math.ceil((30 + (q.quiet.x + q.quiet.w) * k) * scale) + pad);
    const y1 = Math.min(info.height, Math.ceil((30 + (q.quiet.y + q.quiet.h) * k) * scale) + pad);
    const w = x1 - x0;
    const h = y1 - y0;
    const crop = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) crop.set(data.subarray(((y0 + y) * info.width + x0) * 4, ((y0 + y) * info.width + x1) * 4), y * w * 4);
    const got = jsQR(crop, w, h)?.data ?? null;
    const cm = q.code.w / m.PAGE_PX_PER_CM;
    const known = targets.some((t) => t.url === q.url);
    const problems = [];
    if (got === null) problems.push("did not decode");
    else if (got !== q.url) problems.push(`decoded "${got}"`);
    if (!known) problems.push("is not a target of the selectors");
    if (cm < m.QR_MIN_CODE_CM - 1e-9) problems.push(`is ${cm.toFixed(2)} cm, under ${m.QR_MIN_CODE_CM} cm`);
    const ok = problems.length === 0;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok    " : "FAIL  "} ${id} page ${plan.index} (${plan.type})  ${q.url}  ${cm.toFixed(2)} cm, version ${q.version}${ok ? "" : "  <- " + problems.join("; ")}`);
  }
  if (!args.keep) fs.rmSync(file, { force: true });
}
console.log(`\n${checked - bad}/${checked} codes decode${args.keep ? ` (stills kept in ${path.relative(ROOT, dir)})` : ""}`);
process.exit(bad ? 1 : 0);
