// STILLS (Patch 13C): render chosen frames of the film to PNG and a labelled contact sheet of them, so every shot patch can be looked at.
//
//   npm run stills -- --frames 0,600,840      these film frames
//   npm run stills -- --shot S05              the shot's first, middle and last frame
//   npm run stills -- --shot S05 --every 30   every 30th frame of the shot, from its first
//   npm run stills -- --every 120             every 120th frame of the film, from frame 0 (45 frames)
//   npm run stills -- --golden                the ten golden frames of guide 11 (0, 600, 840, 1250, 1500, 2100, 2640, 3250, 4580, 5100),
//                                             compared with docs/reference/golden/fNNNN.png where that file exists
//   --flag value and --flag=value both work. The sources add up (--shot S03 --golden renders both).
//
// Other flags:
//   --hud            draw the frame / shot readout (off by default: a still shows the picture)
//   --scale N        render scale (default 1; the golden comparison only runs at 1)
//   --cols N         columns of the contact sheet (default: a block of about 16:9, at most 8 wide)
//   --thumb N        width of a cell of the contact sheet in px (default 320)
//   --out DIR        a folder inside out/ (default out/stills). Stills are never written anywhere else.
//
// Output: DIR/fNNNN.png for every frame (the names `npm run sheets` looks for) and DIR/contact-sheet.png. A browser is needed, as for
// the other scripts (Remotion downloads its own on first use; REMOTION_GL=swangle for a machine without a GPU, much slower).
// Rendering is deterministic: the same frame gives the same PNG. Exit codes: 0 done, 1 a render or file problem, 2 a usage error.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import sharp from "sharp";
import { ROOT, OUT, parseArgs, fail, ensureDir, makeBundle, renderPng } from "./lib/env.mjs";
import { ssimRgb } from "./lib/ssim.mjs";
import { GOLDEN_FRAMES, GOLDEN_SSIM_MIN, StillsUsageError, resolveOutDir, selectFrames, sheetColumns, splitArgs, stillName } from "./lib/stills.mjs";

const VALUE_FLAGS = ["frames", "shot", "every", "scale", "cols", "thumb", "out"];
const args = parseArgs(splitArgs(process.argv.slice(2), VALUE_FLAGS), [...VALUE_FLAGS, "golden", "hud", "help"]);
if (args.help) {
  console.log(
    [
      "npm run stills -- [--frames 0,600,840] [--shot S05 [--every 30]] [--every 120] [--golden] [--hud] [--scale N] [--cols N] [--thumb N] [--out DIR]",
      "  --frames   film frames, comma separated          --shot    a shot: its first, middle and last frame (with --every: every Nth)",
      "  --every    every Nth frame of the film from 0    --golden  the ten golden frames of guide 11, compared with docs/reference/golden/",
      "  Writes out/stills/fNNNN.png and out/stills/contact-sheet.png. --every 120 and --every=120 both work.",
    ].join("\n"),
  );
  process.exit(0);
}

const usage = (message) => {
  console.error(`\nnpm run stills: ${message}\n`);
  console.error("Choose frames with --frames 0,600 | --shot S05 | --every 120 | --golden  (npm run stills -- --help)");
  process.exit(2);
};

// the shot table, the film's length and the labels (esbuild reads the TypeScript, as `npm run timeline` does)
const tmp = ensureDir(path.join(OUT, ".tests"));
const outfile = path.join(tmp, "timeline-stills.mjs");
await build({ entryPoints: [path.join(ROOT, "src/config/timeline.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent" });
const tl = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);

let frames;
let dir;
let cols;
let scale = 1;
let thumbW = 320;
try {
  frames = selectFrames({ frames: args.frames, shot: args.shot, every: args.every, golden: args.golden === true }, tl.SHOTS, tl.TOTAL);
  dir = resolveOutDir(ROOT, args.out);
  cols = sheetColumns(frames.length, args.cols);
  if (args.scale !== undefined) {
    scale = args.scale === true ? NaN : Number(args.scale);
    if (!(scale > 0 && scale <= 4)) throw new StillsUsageError(`--scale needs a number above 0 and up to 4 (got ${args.scale === true ? "nothing" : `"${args.scale}"`})`);
  }
  if (args.thumb !== undefined) {
    thumbW = args.thumb === true ? NaN : Number(args.thumb);
    if (!Number.isInteger(thumbW) || thumbW < 64 || thumbW > 1920) throw new StillsUsageError(`--thumb needs a whole number of px from 64 to 1920 (got ${args.thumb === true ? "nothing" : `"${args.thumb}"`})`);
  }
} catch (e) {
  if (e instanceof StillsUsageError) usage(e.message);
  throw e;
}

const stillPath = (f) => path.join(dir, stillName(f));
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
ensureDir(dir);
console.log(`\nStills: ${frames.length} frame${frames.length === 1 ? "" : "s"} (${frames.length > 12 ? `${frames.slice(0, 6).join(", ")} ... ${frames[frames.length - 1]}` : frames.join(", ")}) into ${rel(dir)}/`);

// ---- render ----
const serveUrl = await makeBundle();
const hud = args.hud === true;
let n = 0;
for (const f of frames) {
  try {
    await renderPng({ serveUrl, id: "ReelFilm", frame: f, output: stillPath(f), inputProps: { hud, feather: true }, scale });
  } catch (e) {
    fail(`Rendering frame ${f} (${tl.shotAt(f).id}) failed: ${e.message}`, "Check that the Studio shows that frame (npm run studio), and see docs/guide/12-troubleshooting.md for a browser or GL problem.");
  }
  process.stdout.write(`\r  still ${++n} of ${frames.length}  f${String(f).padStart(4, "0")} ${tl.shotAt(f).id}   `);
}
process.stdout.write("\n");

// ---- contact sheet ----
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const thumbH = Math.round((thumbW * 9) / 16);
const labelH = 26;
const gap = 10;
const rows = Math.ceil(frames.length / cols);
const width = gap + cols * (thumbW + gap);
const height = gap + rows * (thumbH + labelH + gap);
const layers = [];
for (let i = 0; i < frames.length; i++) {
  const f = frames[i];
  const left = gap + (i % cols) * (thumbW + gap);
  const top = gap + Math.floor(i / cols) * (thumbH + labelH + gap);
  layers.push({ input: await sharp(stillPath(f)).resize(thumbW, thumbH, { fit: "cover" }).png().toBuffer(), left, top });
  const label = `f${String(f).padStart(4, "0")}  ${tl.shotAt(f).id}  ${tl.timecode(f)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${thumbW}" height="${labelH}"><rect width="${thumbW}" height="${labelH}" fill="#161618"/><text x="6" y="18" font-family="Consolas, 'DejaVu Sans Mono', monospace" font-size="15" fill="#F1EADB">${esc(label)}</text></svg>`;
  layers.push({ input: Buffer.from(svg), left, top: top + thumbH });
}
const sheetFile = path.join(dir, "contact-sheet.png");
await sharp({ create: { width, height, channels: 3, background: "#0b0b0c" } }).composite(layers).png().toFile(sheetFile);
console.log(`Contact sheet: ${rel(sheetFile)} (${frames.length} cells, ${cols} x ${rows}, ${width} x ${height} px)`);

// ---- golden comparison ----
if (args.golden === true) {
  const goldenDir = path.join(ROOT, "docs", "reference", "golden");
  console.log(`\nGolden frames (SSIM against ${rel(goldenDir)}/fNNNN.png; below ${GOLDEN_SSIM_MIN} on a frame you did not mean to change is a regression, guide 11):`);
  let compared = 0;
  let low = 0;
  for (const f of GOLDEN_FRAMES) {
    const tag = `  f${String(f).padStart(4, "0")}  ${tl.shotAt(f).id}`;
    const gold = path.join(goldenDir, stillName(f));
    if (!fs.existsSync(gold)) {
      console.log(`${tag}  no golden copy yet`);
      continue;
    }
    if (scale !== 1) {
      console.log(`${tag}  not compared (rendered at scale ${scale}; the golden copies are 1920x1080)`);
      continue;
    }
    const a = await sharp(stillPath(f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(gold).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
      console.log(`${tag}  not compared (the golden copy is ${b.info.width}x${b.info.height}, the render ${a.info.width}x${a.info.height})`);
      continue;
    }
    const s = ssimRgb(a.data, b.data, a.info.width, a.info.height);
    compared++;
    const ok = s >= GOLDEN_SSIM_MIN;
    if (!ok) low++;
    console.log(`${tag}  SSIM ${s.toFixed(5)}  ${ok ? "ok" : `BELOW ${GOLDEN_SSIM_MIN}`}`);
  }
  if (compared === 0) console.log("  No golden copies yet (docs/reference/golden/ is filled in Patch 23). The ten frames were rendered.");
  else console.log(`  ${compared} of ${GOLDEN_FRAMES.length} compared, ${low} below ${GOLDEN_SSIM_MIN}.`);
}

console.log(`\nDone. ${frames.length} still${frames.length === 1 ? "" : "s"} in ${rel(dir)}/`);
