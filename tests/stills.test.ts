// PATCH 13C: the stills tool, by its rules. Which frames a request means, what is a usage error, where the files may go, the contact
// sheet's shape, and the shared SSIM. Rendering needs a browser and is not tested here (the script's own check is `npm run stills`).
import fs from "node:fs";
import path from "node:path";
import { SHOTS, TOTAL } from "../src/config/timeline";
import { prng } from "../src/lib/prng";
import { GOLDEN_FRAMES, GOLDEN_SSIM_MIN, StillsUsageError, resolveOutDir, selectFrames, sheetColumns, splitArgs, stillName } from "../scripts/lib/stills.mjs";
import { lumaOf, ssim, ssimRgb } from "../scripts/lib/ssim.mjs";
import { eq, near, test, throws, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const pick = (req: Parameters<typeof selectFrames>[0]): number[] => selectFrames(req, SHOTS, TOTAL);
const list = (a: readonly (number | string)[]): string => a.join(",");
const usage = (req: Parameters<typeof selectFrames>[0], contains: string): void => {
  try {
    pick(req);
  } catch (e) {
    truthy(e instanceof StillsUsageError, `expected a StillsUsageError, got ${(e as Error).name}`);
    truthy((e as Error).message.includes(contains), `message "${(e as Error).message}" does not contain "${contains}"`);
    return;
  }
  throw new Error(`expected a usage error containing "${contains}", but nothing was thrown`);
};

// ---------- the golden frames ----------

test("stills: the ten golden frames are the ones in guide 11, section 6", () => {
  const text = read("docs/guide/11-maintenance.md");
  const m = text.match(/golden stills\*\* of ten fixed frames \(([\d,\s]+)\)/);
  truthy(m, "guide 11 names the golden frames");
  const guide = (m as RegExpMatchArray)[1].split(",").map((s) => Number(s.trim()));
  eq(list(GOLDEN_FRAMES), list(guide));
  eq(GOLDEN_FRAMES.length, 10);
  truthy(GOLDEN_FRAMES.every((f) => Number.isInteger(f) && f >= 0 && f < TOTAL), "all inside the film");
  eq(GOLDEN_SSIM_MIN, 0.97, "the guide's threshold");
});

// ---------- which frames ----------

test("stills: --frames gives those frames, sorted and without repeats", () => {
  eq(list(pick({ frames: "0,840" })), "0,840");
  eq(list(pick({ frames: " 840 , 0,840, 5399" })), "0,840,5399");
});

test("stills: --shot gives the first, middle and last frame of the shot (lower case works)", () => {
  eq(list(pick({ shot: "S03" })), "840,899,959");
  eq(list(pick({ shot: "s03" })), "840,899,959");
  for (const sh of SHOTS) {
    const f = pick({ shot: sh.id });
    eq(f.length, 3, `${sh.id} has three frames`);
    eq(f[0], sh.from, `${sh.id} first`);
    eq(f[2], sh.to, `${sh.id} last`);
    truthy(f[1] > sh.from && f[1] < sh.to, `${sh.id} middle is inside`);
  }
});

test("stills: --shot with --every gives every Nth frame of the shot from its first; --every alone is the film", () => {
  const s05 = SHOTS.find((s) => s.id === "S05")!;
  const f = pick({ shot: "S05", every: "30" });
  eq(f[0], s05.from);
  eq(f.length, Math.floor((s05.to - s05.from) / 30) + 1);
  truthy(f.every((x) => x >= s05.from && x <= s05.to), "all inside the shot");
  const film = pick({ every: "120" });
  eq(film.length, 45, "45 frames, as the patch says");
  eq(film[0], 0);
  eq(film[44], 5280);
  film.forEach((x, i) => eq(x, i * 120));
  eq(pick({ every: "1" }).length, TOTAL, "every frame");
  eq(list(pick({ every: "5399" })), "0,5399");
});

test("stills: --golden gives the ten frames, and the sources add up", () => {
  eq(list(pick({ golden: true })), list(GOLDEN_FRAMES));
  eq(list(pick({ shot: "S03", golden: true })), list([...new Set([840, 899, 959, ...GOLDEN_FRAMES])].sort((a, b) => a - b)));
  eq(list(pick({ frames: "0,7", golden: true })), list([...new Set([0, 7, ...GOLDEN_FRAMES])].sort((a, b) => a - b)));
});

// ---------- usage errors say what was wrong ----------

test("stills: a frame outside 0-5399 is a usage error that names the frame", () => {
  usage({ frames: "5400" }, "frame 5400 is outside the film (frames 0 to 5399)");
  usage({ frames: "0,99999" }, "99999");
  usage({ frames: "-1" }, '"-1" is not a whole frame number');
  usage({ frames: "1.5" }, '"1.5" is not a whole frame number');
  usage({ frames: "abc" }, '"abc"');
  usage({ frames: "0,,5" }, "empty entry");
  usage({ frames: true }, "--frames needs a list");
  usage({ frames: "" }, "--frames needs a list");
});

test("stills: an unknown shot, a bad --every and an empty request are usage errors", () => {
  usage({ shot: "S26" }, '"S26" is not a shot (the film has S00 to S25)');
  usage({ shot: "5" }, '"5" is not a shot');
  usage({ shot: true }, "--shot needs a shot id");
  usage({ every: "0" }, "--every needs a whole number");
  usage({ every: "abc" }, '"abc"');
  usage({ every: "1.5" }, '"1.5"');
  usage({ every: true }, "--every needs a whole number");
  usage({ shot: "S03", every: "-30" }, "--every");
  usage({}, "nothing to render");
  usage({ golden: false }, "nothing to render");
});

test("stills: --every is refused next to --frames or --golden, where it would not be clear what it counts", () => {
  usage({ every: "120", golden: true }, "cannot be mixed");
  usage({ every: "120", frames: "0" }, "cannot be mixed");
  eq(pick({ shot: "S03", every: "60", golden: true }).includes(900), true, "with a shot it is fine");
});

// ---------- arguments ----------

test("stills: --every 120 and --every=120 both work, and no other script's flags change", () => {
  const vf = ["frames", "shot", "every", "out"];
  eq(list(splitArgs(["--every", "120"], vf)), "--every=120");
  eq(list(splitArgs(["--every=120"], vf)), "--every=120");
  eq(list(splitArgs(["--frames", "0,600", "--golden", "--shot", "S05", "--every", "30"], vf)), "--frames=0,600,--golden,--shot=S05,--every=30");
  eq(list(splitArgs(["--every", "--golden"], vf)), "--every,--golden", "a flag after a value flag leaves it bare");
  eq(list(splitArgs(["--every"], vf)), "--every", "nothing after it leaves it bare");
  eq(list(splitArgs(["--golden", "5"], vf)), "--golden,5", "a flag that takes no value is not joined");
  eq(list(splitArgs(["--frames", "-5"], vf)), "--frames=-5", "a negative number is still the value (and then refused)");
});

// ---------- where the files go ----------

test("stills: files go under out/ and nowhere else (never public/ or docs/reference/)", () => {
  const root = path.resolve("/repo");
  eq(resolveOutDir(root), path.join(root, "out", "stills"));
  eq(resolveOutDir(root, "out/stills-b"), path.join(root, "out", "stills-b"));
  eq(resolveOutDir(root, "out/a/b"), path.join(root, "out", "a", "b"));
  for (const bad of ["public/stills", "docs/reference/golden", "public/plates/original", "..", "../out", "out/../public", "/tmp/x", "."]) {
    throws(() => resolveOutDir(root, bad), "outside out/", `"${bad}"`);
  }
  throws(() => resolveOutDir(root, true), "--out needs a folder");
  eq(stillName(0), "f0000.png");
  eq(stillName(840), "f0840.png");
  eq(stillName(5399), "f5399.png", "the names `npm run sheets` looks for");
});

// ---------- the contact sheet ----------

test("stills: the contact sheet is a block of about 16:9, at most 8 wide, never wider than its cells", () => {
  eq(sheetColumns(45), 8);
  eq(sheetColumns(10), 5);
  eq(sheetColumns(3), 3);
  eq(sheetColumns(2), 2);
  eq(sheetColumns(1), 1);
  for (let n = 1; n <= 200; n++) {
    const c = sheetColumns(n);
    truthy(c >= 1 && c <= 8 && c <= n, `n ${n} gives ${c} columns`);
  }
  eq(sheetColumns(45, "4"), 4);
  eq(sheetColumns(3, "10"), 3, "an override is cut to the cell count");
  throws(() => sheetColumns(5, "0"), "--cols needs a whole number");
  throws(() => sheetColumns(5, "x"), "--cols needs a whole number");
});

// ---------- SSIM, shared with plate:verify ----------

test("ssim: the same picture scores 1, a different one less, and the order does not matter", () => {
  const w = 64;
  const h = 48;
  const r = prng(99);
  const a = new Float32Array(w * h).map(() => Math.floor(r() * 256));
  const b = a.map((v) => Math.min(255, Math.max(0, v + Math.floor((r() - 0.5) * 60))));
  near(ssim(a, a, w, h), 1, 1e-6, "identical");
  const s = ssim(a, b, w, h);
  truthy(s < 0.99 && s > 0, `noisy copy scores ${s}`);
  near(ssim(b, a, w, h), s, 1e-9, "symmetric");
  const flat = new Float32Array(w * h).fill(128);
  truthy(ssim(a, flat, w, h) < s, "a flat grey is further from the noise than a noisy copy");
});

test("ssim: ssimRgb is the SSIM of the luma, and refuses a buffer of the wrong size", () => {
  const w = 40;
  const h = 30;
  const r = prng(7);
  const rgb = Uint8Array.from({ length: w * h * 3 }, () => Math.floor(r() * 256));
  near(ssimRgb(rgb, rgb, w, h), 1, 1e-6);
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) luma[i] = lumaOf(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
  const other = Uint8Array.from(rgb, (v) => Math.min(255, v + 20));
  const lumaOther = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lumaOther[i] = lumaOf(other[i * 3], other[i * 3 + 1], other[i * 3 + 2]);
  near(ssimRgb(rgb, other, w, h), ssim(luma, lumaOther, w, h), 1e-12);
  throws(() => ssimRgb(rgb, rgb.slice(3), w, h), "expected");
  near(lumaOf(255, 255, 255), 255, 1e-9, "the weights add to 1");
});

// ---------- the rules of the patch, as the source says them ----------

test("stills: the script is wired in, plate:verify uses the shared SSIM, and nothing writes outside out/", () => {
  const pkg = JSON.parse(read("package.json"));
  eq(pkg.scripts.stills, "node scripts/make-stills.mjs");
  const v = read("scripts/verify-plate.mjs");
  truthy(v.includes('from "./lib/ssim.mjs"'), "verify-plate imports the shared SSIM");
  eq(/function ssim\(/.test(v), false, "the SSIM is no longer defined in verify-plate.mjs");
  eq(/function blur\(/.test(v), false, "nor its blur");
  const s = read("scripts/make-stills.mjs");
  truthy(s.includes("resolveOutDir("), "the output folder goes through resolveOutDir");
  // the only place the script touches docs/reference is to READ the golden copies
  eq(/writeFile|toFile\([^)]*golden|copyFile|rmSync|unlink/.test(s.replace(/sheetFile/g, "")), false, "no write, copy or delete next to the golden copies");
});
