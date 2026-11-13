// Decodes every QR code of the book pages from a RENDERED still and compares it with the target the selectors give (Patch 09, guide 04
// "QR code rules").   npm run qr:check     (-- --book=mini-me to look at one book, -- --keep to keep the stills in out/qr)
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

const args = parseArgs(process.argv.slice(2), ["book", "keep"]);

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
