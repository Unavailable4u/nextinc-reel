// The motion audit (Patch 05): STILL, FAST, DEEP, EDGE, POP and LATE over the camera path, with frame numbers and a summary.
// Since Patch 13A the camera path is the one the shot files provide (src/shots, FILM_CAMERA_KEYFRAMES), and the audit also reports the
// shot registry: it fails when a shot file disagrees with the shot table (the registry checks itself when it loads).
//   npm run motion                       all frames the keyframes cover (S00-S03 for now)
//   npm run motion -- --from=480 --to=959
//   npm run motion -- --all              ignore the documented exceptions (config/camera.ts, KNOWN_EXCEPTIONS)
//   npm run motion -- --break            add a deliberate 20-frame move after the last keyframe and show that the audit reports it
// Exit code 1 when a finding is not a documented exception. Paste the summary into docs/PATCH_NOTES.md (guide 05, rule 9).
// The checks live in src/camera/audit.ts (they are tested in tests/camera.test.ts); this file only bundles them and prints.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { parseArgs } from "../scripts/lib/env.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2), ["from", "to", "all", "break"]);

const tmp = path.join(ROOT, "out", ".tests");
fs.mkdirSync(tmp, { recursive: true });
const entry = path.join(tmp, "motion-entry.ts");
fs.writeFileSync(
  entry,
  [
    `export { auditMotion, FINDING_CODES } from ${JSON.stringify(path.join(ROOT, "src/camera/audit.ts"))};`,
    `export { limitFor, MIN_MOVE_FRAMES, MIN_GAP_FRAMES, MAX_M_RATE_PER_SEC, POP_FRACTION } from ${JSON.stringify(path.join(ROOT, "src/config/camera.ts"))};`,
    `export { SHOTS, shotAt, timecode } from ${JSON.stringify(path.join(ROOT, "src/config/timeline.ts"))};`,
    `export { FILM_CAMERA_KEYFRAMES, SHOT_REGISTRY } from ${JSON.stringify(path.join(ROOT, "src/shots/index.ts"))};`,
  ].join("\n"),
);
const outfile = path.join(tmp, "motion-bundle.mjs");
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile, logLevel: "silent", loader: { ".json": "json" } });
let m;
try {
  m = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
} catch (e) {
  // the shot registry checks itself when it loads (src/shots/define.ts, checkShots): a bad shot file stops here, named
  console.error(`\nSHOT REGISTRY: INVALID\n  ${e.message}\n`);
  process.exit(1);
}

let keys = m.FILM_CAMERA_KEYFRAMES;
if (args.break) {
  // a still beat, then a 20-frame move (and its end 10 frames off a beat): FAST for the move, LATE for the key that is off the beat
  const last = keys[keys.length - 1];
  const moved = { ...last, frame: last.frame + 60, ease: "linear", regime: "R2" };
  keys = [...keys.slice(0, -1), { ...last, regime: "R2" }, moved, { ...moved, frame: moved.frame + 20, M: moved.M * 1.06, ease: "linear" }, { ...moved, frame: moved.frame + 20 + 90, M: moved.M * 1.06 }];
  console.log("--break: added a still 60 frames after the last keyframe, then a 20 frame move (M +6%).\n");
}

const lastKey = keys[keys.length - 1].frame;
const from = args.from !== undefined ? Number(args.from) : 0;
const to = args.to !== undefined ? Number(args.to) : lastKey - 1;
let r;
try {
  r = m.auditMotion({ keys, from, to, exceptions: args.all ? [] : undefined });
} catch (e) {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
}

const f4 = (n) => `f${String(n).padStart(4, "0")}`;
const first = m.shotAt(r.range[0]);
const lastShot = m.shotAt(r.range[1]);
console.log(`npm run motion: frames ${r.range[0]}-${r.range[1]} (${first.id}${lastShot.id !== first.id ? `-${lastShot.id}` : ""}, ${m.timecode(r.range[0])}-${m.timecode(r.range[1] + 1)}), ${keys.length} keyframes, keyframes end at ${f4(lastKey)}`);
console.log(`camera moves: ${r.stats.moves.map((mv) => `${mv.from}-${mv.to} (${mv.to - mv.from} f)`).join(", ") || "none"}\n`);

if (r.findings.length === 0) console.log("No findings.\n");
else {
  console.log("Findings");
  for (const f of r.findings) {
    const where = f.to === f.from ? f4(f.from) : `${f4(f.from)}-${f4(f.to)}`;
    console.log(`  ${f.code.padEnd(5)} ${where.padEnd(12)} ${f.detail}${f.known ? `\n        known exception: ${f.known}` : ""}`);
  }
  console.log("");
}

const known = r.findings.filter((f) => f.known).length;
console.log("Summary");
console.log("  " + m.FINDING_CODES.map((c) => `${c} ${r.counts[c]}`).join("   "));
const lim = m.limitFor("R2");
console.log(`  peak sideways speed ${r.stats.peakLateralCmPerSec.toFixed(1)} cm/s (R2 limit ${lim.lateralCmPerSec}), peak change of M ${r.stats.peakMRatePerSec.toFixed(3)} x per second (limit ${m.MAX_M_RATE_PER_SEC}), largest jump ${(r.stats.peakPopFraction * 100).toFixed(2)}% (limit ${m.POP_FRACTION * 100}%), largest M ${r.stats.maxM.toFixed(3)}`);
console.log(`  shot table: ${r.timeline.shots} shots, ${r.timeline.frames} frames`);
{
  // the registry is valid if we got here (it throws when it loads); say what is in it
  const reg = m.SHOT_REGISTRY;
  const withKeys = reg.filter((s) => s.camera.length > 0).map((s) => `${s.id} ${s.camera.length}`);
  const empty = reg.filter((s) => s.camera.length === 0).map((s) => Number(s.id.slice(1)));
  const ranges = [];
  for (const n of empty) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  const id = (n) => `S${String(n).padStart(2, "0")}`;
  const none = ranges.map(([a, b]) => (a === b ? id(a) : `${id(a)}-${id(b)}`)).join(", ");
  console.log(`  shot registry: VALID, ${reg.length} shot files (${reg[0].id}-${reg[reg.length - 1].id}), each on its table frames; keyframes ${withKeys.join(", ") || "none"}${none ? ` (none yet: ${none})` : ""}`);
}
if (r.unexplained > 0) {
  console.log(`\nMOTION AUDIT: ${r.unexplained} finding${r.unexplained === 1 ? "" : "s"} to fix${known ? ` (and ${known} documented exception${known === 1 ? "" : "s"})` : ""}.`);
  process.exit(1);
}
console.log(`\nMOTION AUDIT: PASSED${known ? ` (${known} documented exception${known === 1 ? "" : "s"})` : ""}.`);
