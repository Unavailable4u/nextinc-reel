// Contact sheets from stills (Patch 05): a grid of thumbnails with the frame, the shot and the time under each, to look at a camera
// path at a glance (guide 05, rule 9: "look at the contact sheets before every hand-over").
//
//   node scripts/make-sheets.mjs --from=0 --to=959 --every=30            (or: npm run sheets -- --from=0 --to=959 --every=30)
//   --from, --to   first and last frame (default 0 and 959, the frames Patch 05 covers); the stills are at from, from + every, ...
//   --every        one still every N frames (default 30, one per beat)
//   --dir          where the stills are (default out/stills), named f0000.png, f0030.png ... (the same names `npm run stills`
//                  makes)
//   --render       render the stills that are missing with Remotion (the film, no readout) instead of stopping
//   --scale        render scale for --render (default 1)
//   --cols, --rows grid size of one sheet (default 4 x 5); more frames make more sheets
//   --out          where the sheets go (default out/sheets): sheet-f0000-f0570.png ...
// Needs a browser only for --render (Remotion downloads its own on first use; REMOTION_GL as for the other scripts).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import { ROOT, OUT, parseArgs, fail, ensureDir, makeBundle, renderPng } from "./lib/env.mjs";

const args = parseArgs(process.argv.slice(2), ["from", "to", "every", "dir", "render", "scale", "cols", "rows", "out"]);
const num = (name, dflt) => {
  if (args[name] === undefined) return dflt;
  const v = Number(args[name]);
  if (!Number.isFinite(v)) fail(`--${name} must be a number, got "${args[name]}"`);
  return v;
};
const from = Math.round(num("from", 0));
const to = Math.round(num("to", 959));
const every = Math.round(num("every", 30));
const cols = Math.max(1, Math.round(num("cols", 4)));
const rows = Math.max(1, Math.round(num("rows", 5)));
const scale = num("scale", 1);
if (every < 1) fail("--every must be at least 1");
if (to < from) fail(`--to (${to}) is before --from (${from})`);
const dir = path.resolve(ROOT, args.dir && args.dir !== true ? args.dir : path.join("out", "stills"));
const outDir = ensureDir(path.resolve(ROOT, args.out && args.out !== true ? args.out : path.join("out", "sheets")));

// the shot table, for the labels (esbuild reads the TypeScript, as `npm run timeline` does)
const tmp = ensureDir(path.join(OUT, ".tests"));
const outfile = path.join(tmp, "timeline-sheets.mjs");
await build({ entryPoints: [path.join(ROOT, "src/config/timeline.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent" });
const tl = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);

const frames = [];
for (let f = from; f <= to; f += every) frames.push(f);
const stillPath = (f) => path.join(dir, `f${String(f).padStart(4, "0")}.png`);
const missing = frames.filter((f) => !fs.existsSync(stillPath(f)));

if (missing.length) {
  if (!args.render) {
    fail(
      `${missing.length} of ${frames.length} stills are missing in ${path.relative(ROOT, dir)} (first: ${path.basename(stillPath(missing[0]))}).`,
      "run again with --render to make them, or put stills named f0000.png, f0030.png ... in that folder (npm run stills makes them).",
    );
  }
  ensureDir(dir);
  console.log(`Rendering ${missing.length} still${missing.length === 1 ? "" : "s"} into ${path.relative(ROOT, dir)} (about a second each)`);
  const serveUrl = await makeBundle();
  let n = 0;
  for (const f of missing) {
    await renderPng({ serveUrl, id: "ReelFilm", frame: f, output: stillPath(f), inputProps: { hud: false, feather: true }, scale });
    process.stdout.write(`\r  still ${++n} of ${missing.length}   `);
  }
  process.stdout.write("\n");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const THUMB_W = 480;
const THUMB_H = 270;
const LABEL_H = 26;
const GAP = 10;
const perSheet = cols * rows;
const sheets = [];
for (let s = 0; s * perSheet < frames.length; s++) {
  const part = frames.slice(s * perSheet, (s + 1) * perSheet);
  const r = Math.ceil(part.length / cols);
  const width = GAP + cols * (THUMB_W + GAP);
  const height = GAP + r * (THUMB_H + LABEL_H + GAP);
  const layers = [];
  for (let i = 0; i < part.length; i++) {
    const f = part[i];
    const left = GAP + (i % cols) * (THUMB_W + GAP);
    const top = GAP + Math.floor(i / cols) * (THUMB_H + LABEL_H + GAP);
    layers.push({ input: await sharp(stillPath(f)).resize(THUMB_W, THUMB_H, { fit: "cover" }).png().toBuffer(), left, top });
    const shot = tl.shotAt(f);
    const label = `f${String(f).padStart(4, "0")}  ${shot.id}  ${tl.timecode(f)}  ${shot.regime}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${LABEL_H}"><rect width="${THUMB_W}" height="${LABEL_H}" fill="#161618"/><text x="6" y="18" font-family="Consolas, 'DejaVu Sans Mono', monospace" font-size="15" fill="#F1EADB">${esc(label)}</text></svg>`;
    layers.push({ input: Buffer.from(svg), left, top: top + THUMB_H });
  }
  const file = path.join(outDir, `sheet-f${String(part[0]).padStart(4, "0")}-f${String(part[part.length - 1]).padStart(4, "0")}.png`);
  await sharp({ create: { width, height, channels: 3, background: "#0b0b0c" } }).composite(layers).png().toFile(file);
  sheets.push(file);
}
console.log(`Made ${sheets.length} sheet${sheets.length === 1 ? "" : "s"} from ${frames.length} stills (every ${every} frames, f${from}-f${to}):`);
for (const f of sheets) console.log(`  ${path.relative(ROOT, f)}`);
