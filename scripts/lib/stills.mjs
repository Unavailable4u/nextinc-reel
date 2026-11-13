// WHICH FRAMES `npm run stills` RENDERS (Patch 13C): the argument handling and the choice of frames, as pure functions so the tests can
// read them (tests/stills.test.ts) and no browser is needed to check them. Pure Node 20+, no dependencies.
//
// The shot table and the film's length are passed in by the caller (the script reads them from src/config/timeline.ts), so this file
// types no frame range of the film. The ten golden frames are the one list typed here: they come from guide 11, section 6, and a
// test compares this list with that guide.
import path from "node:path";

/** The ten golden frames of docs/guide/11-maintenance.md, section 6 ("Regression safety net"). */
export const GOLDEN_FRAMES = Object.freeze([0, 600, 840, 1250, 1500, 2100, 2640, 3250, 4580, 5100]);

/** SSIM below this on a frame you did not mean to change is a regression (guide 11, section 6). */
export const GOLDEN_SSIM_MIN = 0.97;

/** A mistake in what the person asked for (a frame outside the film, an unknown shot, nothing chosen). The script prints it and exits 2. */
export class StillsUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "StillsUsageError";
  }
}

/**
 * Lets `--every 120` work as well as `--every=120`: a flag in `valueFlags` that has no `=` and is followed by something that is not
 * itself a flag takes that as its value. The shared `parseArgs` (scripts/lib/env.mjs) only knows `=`, and it is not changed, so what
 * the other scripts accept stays as it was. A value flag with nothing after it is left bare (the selection then says it needs a value).
 */
export function splitArgs(argv, valueFlags) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--") && !a.includes("=") && valueFlags.includes(a.slice(2))) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out.push(`${a}=${next}`);
        i++;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

const wholeNumber = (text) => /^\d+$/.test(text.trim());

/** "0,600, 840" -> [0, 600, 840]; every entry must be a whole number inside the film. */
function parseFrameList(value, total) {
  if (value === true || String(value).trim() === "") throw new StillsUsageError("--frames needs a list of film frames, for example --frames 0,600,840");
  const out = [];
  for (const part of String(value).split(",")) {
    const t = part.trim();
    if (t === "") throw new StillsUsageError(`--frames has an empty entry in "${value}" (a stray comma?)`);
    if (!wholeNumber(t)) throw new StillsUsageError(`--frames: "${t}" is not a whole frame number`);
    const f = Number(t);
    if (f > total - 1) throw new StillsUsageError(`--frames: frame ${f} is outside the film (frames 0 to ${total - 1})`);
    out.push(f);
  }
  return out;
}

function parseEvery(value) {
  if (value === true || !wholeNumber(String(value)) || Number(value) < 1) throw new StillsUsageError(`--every needs a whole number of frames, at least 1, for example --every 120 (got ${value === true ? "nothing" : `"${value}"`})`);
  return Number(value);
}

function findShot(value, shots) {
  if (value === true || String(value).trim() === "") throw new StillsUsageError("--shot needs a shot id, for example --shot S05");
  const id = String(value).trim().toUpperCase();
  const hit = shots.find((s) => s.id === id);
  if (!hit) throw new StillsUsageError(`--shot: "${value}" is not a shot (the film has ${shots[0].id} to ${shots[shots.length - 1].id})`);
  return hit;
}

/**
 * The frames to render, sorted and without repeats.
 *   frames  "0,600,840"   film frames
 *   shot    "S05"         the shot's first, middle and last frame; with `every`, every Nth frame of the shot from its first
 *   every   "120"         every Nth frame of the film from frame 0 (on its own; with `shot` it belongs to the shot)
 *   golden  true          the ten golden frames
 * The sources add up (`--shot S03 --golden` renders both). `every` next to `frames` or `golden` but no `shot` is refused: it would not be
 * clear what it counts. Throws StillsUsageError, naming what was wrong, for a frame outside 0 to total - 1, an unknown shot, a bad
 * number, or nothing chosen.
 */
export function selectFrames(req, shots, total) {
  const picked = new Set();
  const any = req.frames !== undefined || req.shot !== undefined || req.every !== undefined || req.golden === true;
  if (!any) throw new StillsUsageError("nothing to render: choose frames with --frames 0,600 | --shot S05 | --every 120 | --golden");
  if (req.every !== undefined && req.shot === undefined && (req.frames !== undefined || req.golden === true)) {
    throw new StillsUsageError("--every counts the frames of a shot (--shot S05 --every 30) or of the whole film on its own (--every 120); it cannot be mixed with --frames or --golden");
  }
  if (req.frames !== undefined) for (const f of parseFrameList(req.frames, total)) picked.add(f);
  if (req.shot !== undefined) {
    const sh = findShot(req.shot, shots);
    if (req.every !== undefined) {
      const n = parseEvery(req.every);
      for (let f = sh.from; f <= sh.to; f += n) picked.add(f);
    } else {
      picked.add(sh.from);
      picked.add(Math.floor((sh.from + sh.to) / 2));
      picked.add(sh.to);
    }
  } else if (req.every !== undefined) {
    const n = parseEvery(req.every);
    for (let f = 0; f <= total - 1; f += n) picked.add(f);
  }
  if (req.golden === true) for (const f of GOLDEN_FRAMES) picked.add(f);
  const out = [...picked].sort((a, b) => a - b);
  if (out.length === 0) throw new StillsUsageError("the selection is empty");
  return out;
}

/** `fNNNN.png`, the name `scripts/make-sheets.mjs` already looks for. */
export const stillName = (frame) => `f${String(frame).padStart(4, "0")}.png`;

/**
 * Where the stills go: `out/stills` by default, and anything the person names must lie inside `out/`. Stills are never written under
 * `public/` or `docs/reference/` (the original plate is read-only), so a path outside `out/` is refused. Returns an absolute path.
 */
export function resolveOutDir(root, requested) {
  const outRoot = path.resolve(root, "out");
  const dir = requested === undefined ? path.join(outRoot, "stills") : path.resolve(root, String(requested));
  const rel = path.relative(outRoot, dir);
  if (requested === true) throw new StillsUsageError("--out needs a folder inside out/, for example --out=out/stills-b");
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new StillsUsageError(`--out: "${requested}" is outside out/. Stills are only written under out/`);
  return dir;
}

/** The number of columns of a contact sheet of `n` cells: roughly a 16:9 block, at most 8 wide, never wider than there are cells. */
export function sheetColumns(n, requested) {
  if (requested !== undefined) {
    const c = Number(requested);
    if (requested === true || !Number.isInteger(c) || c < 1) throw new StillsUsageError(`--cols needs a whole number, at least 1 (got ${requested === true ? "nothing" : `"${requested}"`})`);
    return Math.min(c, n);
  }
  return Math.min(n, 8, Math.max(1, Math.ceil(Math.sqrt((n * 16) / 9))));
}
