// Prints the timeline summary (works on Node 20+, no TypeScript loader needed).   npm run timeline
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import { build } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = path.join(ROOT, "out", ".tests");
fs.mkdirSync(tmp, { recursive: true });
const outfile = path.join(tmp, "timeline.mjs");
await build({ entryPoints: [path.join(ROOT, "src/config/timeline.ts")], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent" });
const t = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
console.log(`FPS ${t.FPS}  BEAT ${t.BEAT}  BAR ${t.BAR}  TOTAL ${t.TOTAL}  (${t.timecode(t.TOTAL)})`);
console.log(`${t.SHOTS.length} shots, contiguous, whole bars.\n`);
for (const s of t.SHOTS) {
  const n = s.to - s.from + 1;
  console.log(`${s.id}  ${String(s.from).padStart(4)}-${String(s.to).padStart(4)}  ${String(n).padStart(3)} f  ${(n / t.FPS).toFixed(2).padStart(5)} s  ${s.regime.padEnd(5)} ${s.name}`);
}
