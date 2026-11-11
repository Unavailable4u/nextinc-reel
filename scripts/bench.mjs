// THE BENCHMARK (Patch 04).   npm run bench
//
// Renders the 12 frames of the `DevBench` composition (sample scenes of shots S02, S05, S10, S11 and S23: placeholder boxes under
// the whole light rig, with shadows, the probe and the plate's defocus), times each one inside the page, and estimates how long the
// film will take: seconds per frame of the scene that stands in for each shot (src/dev/benchScenes.ts, SHOT_PROXY) times the shot's
// frames. Prints the tables and writes out/bench.json. Paste the tables into docs/PATCH_NOTES.md.
//
// Time is measured with ONE render at a time (concurrency 1), after a warm-up frame, so the numbers are seconds per frame on this
// machine, one worker. A real render can use more workers; divide by roughly the number of cores that have a GPU or enough RAM.
// Flags: --skip-probe (do not make the probe image when it is missing)  --keep (keep the rendered frames in out/bench/frames)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { ROOT, OUT, browserOptions, ensureDir, fail, makeBundle, parseArgs } from "./lib/env.mjs";
import { PROBE_PATH, makeProbe } from "./make-probe.mjs";

const args = parseArgs(process.argv.slice(2), ["skip-probe", "keep", "help"]);
if (args.help) {
  console.log("npm run bench [-- --skip-probe --keep]");
  process.exit(0);
}

if (!fs.existsSync(PROBE_PATH)) {
  if (args["skip-probe"]) fail("public/plates/derived/probe-front.png is missing and --skip-probe was given.", "Run npm run probe.");
  console.log("The probe image is missing; making it (npm run probe) ...");
  await makeProbe();
}

// the scene table and the shot list, bundled so this script cannot drift from the code
const tmp = ensureDir(path.join(OUT, ".tests"));
async function load(entry, name) {
  const outfile = path.join(tmp, `${name}.mjs`);
  await build({ entryPoints: [path.join(ROOT, entry)], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent", loader: { ".json": "json" } });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}
const { BENCH_FRAMES, SHOT_PROXY } = await load("src/dev/benchScenes.ts", "bench-scenes");
const { SHOTS } = await load("src/config/timeline.ts", "bench-timeline");

console.log("\nBundling the project");
const serveUrl = await makeBundle();
const { selectComposition, renderFrames } = await import("@remotion/renderer");
const opts = browserOptions();
const composition = await selectComposition({ serveUrl, id: "DevBench", ...opts });
const framesDir = ensureDir(path.join(OUT, "bench", "frames"));

const render = async (range, onFrame) =>
  renderFrames({
    composition,
    serveUrl,
    outputDir: framesDir,
    imageFormat: "jpeg",
    jpegQuality: 90,
    frameRange: range,
    concurrency: 1,
    timeoutInMilliseconds: 240000,
    onStart: () => {},
    onFrameUpdate: (_done, frame, ms) => onFrame(frame, ms),
    ...opts,
  });

console.log("\nWarm-up frame (loads the plate and the probe; not counted)");
await render([0, 0], () => {});
console.log("Timing the 12 sample frames");
const ms = new Array(BENCH_FRAMES.length).fill(NaN);
await render([0, BENCH_FRAMES.length - 1], (frame, t) => {
  ms[frame] = t;
  process.stdout.write(`\r  frame ${frame + 1} of ${BENCH_FRAMES.length}   `);
});
process.stdout.write("\n");

const rows = BENCH_FRAMES.map((b, i) => ({ frame: i, scene: b.scene, t: b.t, seconds: ms[i] / 1000 }));
console.log("\nSample frames");
console.log("  frame  scene  lens   seconds");
for (const r of rows) console.log(`  ${String(r.frame).padStart(5)}  ${r.scene}    ${r.t.toFixed(1)}   ${r.seconds.toFixed(2).padStart(7)}`);

const perScene = {};
for (const r of rows) (perScene[r.scene] ??= []).push(r.seconds);
const sceneSeconds = Object.fromEntries(Object.entries(perScene).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
console.log("\nSeconds per frame, by scene");
for (const [k, v] of Object.entries(sceneSeconds)) console.log(`  ${k}  ${v.toFixed(2)}`);

console.log("\nShot-by-shot estimate (one worker)");
console.log("  shot  frames  stands in   s/frame   minutes");
let totalSeconds = 0;
const table = SHOTS.map((s) => {
  const frames = s.to - s.from + 1;
  const proxy = SHOT_PROXY[s.id];
  const spf = sceneSeconds[proxy];
  const secs = spf * frames;
  totalSeconds += secs;
  console.log(`  ${s.id}   ${String(frames).padStart(5)}   ${proxy}        ${spf.toFixed(2).padStart(6)}   ${(secs / 60).toFixed(1).padStart(7)}`);
  return { shot: s.id, name: s.name, frames, proxy, secondsPerFrame: spf, minutes: secs / 60 };
});
const totalFrames = SHOTS.reduce((a, s) => a + (s.to - s.from + 1), 0);
console.log(`\nWHOLE FILM: ${totalFrames} frames, about ${(totalSeconds / 3600).toFixed(1)} hours with one worker (${(totalSeconds / totalFrames).toFixed(2)} s per frame on average).`);
console.log(`Machine: ${os.cpus().length} cores, ${os.cpus()[0]?.model ?? "unknown cpu"}, REMOTION_GL=${process.env.REMOTION_GL || "angle"}. Estimates only: shots that are lighter than their stand-in are over-counted.`);

ensureDir(path.join(OUT, "bench"));
fs.writeFileSync(
  path.join(OUT, "bench.json"),
  JSON.stringify({ madeBy: "npm run bench", machine: { cores: os.cpus().length, cpu: os.cpus()[0]?.model ?? null, gl: process.env.REMOTION_GL || "angle", node: process.version }, frames: rows, secondsPerFrameByScene: sceneSeconds, shots: table, totalFrames, totalHours: totalSeconds / 3600 }, null, 2) + "\n",
);
console.log("Wrote out/bench.json");
if (!args.keep) fs.rmSync(path.join(OUT, "bench"), { recursive: true, force: true });
