import fs from "node:fs";
import path from "node:path";
import { TOTAL, shotAt } from "../src/config/timeline";
import { CAMERA_KEYFRAMES } from "../src/config/camera";
import { GRAIN, VIGNETTE } from "../src/config/fx";
import { cameraAt } from "../src/camera/path";
import { FILM_CAMERA_KEYFRAMES, activeShot } from "../src/shots";
import { booksAt } from "../src/config/ledger";
import { riserBooksAt } from "../src/scene/Riser";
import { grainOffset, grainTile } from "../src/fx/grainField";
import { vignetteAlpha, vignetteBackground } from "../src/fx/vignetteField";
import { eq, near, test, throws, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
/** the source without its comments, so a rule about code is not tripped by a sentence in a comment */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const sameBytes = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

// ---------- the camera of the film ----------

test("film: cameraAt follows the registry's keyframes by default, and they are Patch 05's camera for S00-S03", () => {
  for (const f of [0, 1, 65, 239, 240, 479, 480, 600, 839, 840, 959, 960, 2000, TOTAL - 1]) {
    const a = cameraAt(f);
    const b = cameraAt(f, { keys: FILM_CAMERA_KEYFRAMES });
    eq(JSON.stringify(a), JSON.stringify(b), `frame ${f}: default keys are the film's`);
  }
  // S00-S03 give the same 13 keys as before, so the default did not move the camera anywhere the old default reached
  for (const f of [0, 30, 100, 240, 300, 479, 520, 700, 839, 900, 959, 960, 1500]) {
    eq(JSON.stringify(cameraAt(f)), JSON.stringify(cameraAt(f, { keys: CAMERA_KEYFRAMES })), `frame ${f}`);
  }
});

test("film: the camera holds its last state after its last keyframe (S04-S25 add none yet)", () => {
  const last = FILM_CAMERA_KEYFRAMES[FILM_CAMERA_KEYFRAMES.length - 1].frame;
  const held = cameraAt(last, { operator: false });
  for (const f of [last + 1, last + 600, TOTAL - 1]) {
    const c = cameraAt(f, { operator: false });
    near(c.view.M, held.view.M, 1e-9, `M at ${f}`);
    near(c.view.cx, held.view.cx, 1e-9, `cx at ${f}`);
    near(c.view.cy, held.view.cy, 1e-9, `cy at ${f}`);
  }
});

test("film: the overlay layer asks the registry, and the shot at every boundary is the table's", () => {
  for (const f of [0, 239, 240, 959, 960, 4319, 4320, TOTAL - 1]) eq(activeShot(f).id, shotAt(f).id, `frame ${f}`);
});

// ---------- the set ----------

test("film: the riser is not on the desk before the ledger puts a book on it (frame 0 is not changed by it)", () => {
  // `riserBooksAt` is what ReelFilm asks before it draws the riser at all
  for (const f of [0, 959, 2880, 4139]) eq(riserBooksAt(f).length, 0, `frame ${f}`);
  truthy(riserBooksAt(4140).length > 0, "from the first frame of the swap");
  eq(riserBooksAt(TOTAL - 1).length, 4, "all four at the end");
  eq(riserBooksAt(4200).length, booksAt(4200).riser.length, "the ledger and the riser agree");
});

// ---------- the grain ----------

test("grain: a pure function of the frame and the seed (same inputs, same bytes; another frame or seed, other bytes)", () => {
  const a = grainTile(300);
  eq(a.length, GRAIN.tilePx * GRAIN.tilePx * 4);
  truthy(sameBytes(a, grainTile(300)), "the same frame twice");
  truthy(sameBytes(a, grainTile(300, { seed: GRAIN.seed })), "the default seed is the film's");
  truthy(!sameBytes(a, grainTile(301)), "the next frame is different");
  truthy(!sameBytes(a, grainTile(300, { seed: GRAIN.seed + 1 })), "another seed is different");
  // frame 0 and frame 1 share nothing: count pixels whose alpha is equal and not zero
  const b = grainTile(301);
  let same = 0;
  for (let i = 3; i < a.length; i += 4) if (a[i] === b[i] && a[i] > 0) same++;
  truthy(same < (a.length / 4) * 0.2, `neighbouring frames share ${same} pixels`);
});

test("grain: faint (never above `amount`), black and white in equal parts, and nothing when `amount` is 0", () => {
  const t = grainTile(1234);
  const peak = Math.round(GRAIN.amount * 255);
  let maxA = 0;
  let white = 0;
  let black = 0;
  let sumA = 0;
  for (let i = 0; i < t.length; i += 4) {
    maxA = Math.max(maxA, t[i + 3]);
    sumA += t[i + 3];
    eq(t[i], t[i + 1], "grey: red equals green");
    eq(t[i + 1], t[i + 2], "grey: green equals blue");
    if (t[i + 3] > 0) {
      if (t[i] === 255) white++;
      else black++;
    }
  }
  truthy(maxA <= peak, `strongest pixel ${maxA} is above ${peak}`);
  truthy(maxA >= peak * 0.6, `strongest pixel ${maxA} is far below ${peak}: the grain would not show`);
  near(white / (white + black), 0.5, 0.03, "share of white grain");
  truthy(sumA / (t.length / 4) < peak * 0.5, "most pixels are fainter than half the peak");
  eq(grainTile(1234, { amount: 0 }).every((v, i) => i % 4 !== 3 || v === 0), true, "amount 0 draws nothing");
});

test("grain: the tile's offset is a whole number inside the tile, the same for the same frame, and moves from frame to frame", () => {
  const seen = new Set<string>();
  for (let f = 0; f < 60; f++) {
    const o = grainOffset(f);
    truthy(Number.isInteger(o.x) && Number.isInteger(o.y), `frame ${f} offset is whole`);
    truthy(o.x >= 0 && o.x < GRAIN.tilePx && o.y >= 0 && o.y < GRAIN.tilePx, `frame ${f} offset is inside the tile`);
    eq(JSON.stringify(o), JSON.stringify(grainOffset(f)), `frame ${f} offset is repeatable`);
    seen.add(`${o.x},${o.y}`);
  }
  truthy(seen.size > 50, `only ${seen.size} different offsets in 60 frames`);
});

// ---------- the vignette ----------

test("vignette: clear inside the inner radius, rising smoothly, `strength` at the corner", () => {
  eq(vignetteAlpha(0), 0);
  eq(vignetteAlpha(VIGNETTE.innerRadius), 0);
  near(vignetteAlpha(1), VIGNETTE.strength, 1e-12, "corner");
  let prev = 0;
  for (let i = 0; i <= 100; i++) {
    const a = vignetteAlpha(i / 100);
    truthy(a >= prev - 1e-12, `non-decreasing at ${i / 100}`);
    prev = a;
  }
  truthy(VIGNETTE.strength > 0 && VIGNETTE.strength <= 0.5, "faint: a placeholder until Patch 22");
});

test("vignette: the CSS is a radial gradient from clear to the warm black, with no pure black", () => {
  const css = vignetteBackground();
  truthy(css.startsWith("radial-gradient("), css);
  truthy(css.includes("rgba(10, 6, 5, 0) "), "starts clear");
  truthy(css.includes(`rgba(10, 6, 5, ${VIGNETTE.strength.toFixed(4)}) 100.00%`), "ends at `strength` on the corner");
  truthy(!css.includes("rgba(0, 0, 0"), "never pure black");
  eq(vignetteBackground(), vignetteBackground(), "the same every time");
  throws(() => vignetteBackground({ color: "red" }), "not a #rrggbb colour");
});

// ---------- the rules of the patch, as the source says them ----------

test("film: ReelFilm never names a shot (it asks the registry), and the layers read no clock and no random", () => {
  eq(/\bS[0-2]\d\b/.test(code("src/ReelFilm.tsx")), false, "ReelFilm.tsx names a shot");
  for (const f of ["src/ReelFilm.tsx", "src/fx/Grain.tsx", "src/fx/Vignette.tsx", "src/fx/grainField.ts", "src/fx/vignetteField.ts"]) {
    const c = code(f);
    for (const bad of ["Math.random", "Date.now", "performance.now", "useFrame", "setTimeout", "setInterval", "requestAnimationFrame", "localStorage"]) {
      eq(c.includes(bad), false, `${f} uses ${bad}`);
    }
  }
});

test("film: plate:verify renders frame 0 with the set, grain and vignette off, so it still compares the bare photo (gate G0)", () => {
  const v = read("scripts/verify-plate.mjs");
  truthy(/inputProps:\s*\{\s*hud:\s*false,\s*feather,\s*scene:\s*false,\s*grain:\s*false,\s*vignette:\s*false\s*\}/.test(v), "verify-plate.mjs inputProps");
});
