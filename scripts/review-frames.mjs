// Review frames in ONE browser session (much lighter than `npm run stills`, which opens a browser per frame).
//   node scripts/review-frames.mjs --every=30 --scale=0.5 --out=out/review
// Writes out/review/fNNNN.png (the names `npm run sheets` expects). Frames that already exist are skipped, so a stopped run can be resumed.
import fs from "node:fs";
import path from "node:path";
import { ROOT, ensureDir, makeBundle, browserOptions } from "./lib/env.mjs";

const arg = (name, dflt) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const every = Number(arg("every", "30"));
const scale = Number(arg("scale", "0.5"));
const outRel = arg("out", "out/review");
const TOTAL = 5400;
if (!(every >= 1) || !(scale > 0 && scale <= 4)) {
  console.error("Usage: node scripts/review-frames.mjs --every=30 --scale=0.5 --out=out/review");
  process.exit(2);
}
const outDir = path.resolve(ROOT, outRel);
if (!outDir.startsWith(path.join(ROOT, "out") + path.sep)) {
  console.error("--out must be a folder inside out/");
  process.exit(2);
}
ensureDir(outDir);

const frames = [];
for (let f = 0; f < TOTAL; f += every) frames.push(f);
const file = (f) => path.join(outDir, `f${String(f).padStart(4, "0")}.png`);
const todo = frames.filter((f) => !fs.existsSync(file(f)));
console.log(`${frames.length} frames, ${frames.length - todo.length} already done, ${todo.length} to render into ${outRel}/`);
if (todo.length === 0) process.exit(0);

const { openBrowser, selectComposition, renderStill } = await import("@remotion/renderer");
const serveUrl = await makeBundle();
const opts = browserOptions();
const browser = await openBrowser("chrome", { browserExecutable: opts.browserExecutable, chromiumOptions: opts.chromiumOptions });
const inputProps = { hud: false, feather: true };
const composition = await selectComposition({ serveUrl, id: "ReelFilm", inputProps, puppeteerInstance: browser, ...opts });

const failed = [];
let n = 0;
const t0 = Date.now();
for (const f of todo) {
  try {
    await renderStill({ serveUrl, composition, frame: f, output: file(f), inputProps, scale, imageFormat: "png", timeoutInMilliseconds: 240000, puppeteerInstance: browser, ...opts });
  } catch (e) {
    failed.push(f);
    console.error(`\n  frame ${f} failed: ${String(e.message).split("\n")[0]}`);
  }
  n++;
  const per = (Date.now() - t0) / n / 1000;
  process.stdout.write(`\r  ${n} of ${todo.length}  f${String(f).padStart(4, "0")}  ${per.toFixed(1)} s/frame, about ${Math.round((per * (todo.length - n)) / 60)} min left   `);
}
process.stdout.write("\n");
await browser.close({ silent: true }).catch(() => {});
if (failed.length) {
  console.error(`\n${failed.length} frame(s) failed: ${failed.join(", ")}. Run the same command again to retry only those.`);
  process.exit(1);
}
console.log("Done.");
