// THE CAMERA, AS DATA (Patch 05). Authored keyframes for the whole film, one array, plus the limits the audit (`npm run motion`) holds
// them to. The numbers of S00-S03 are the table of docs/guide/05-camera-and-motion.md section 4; the rest of the film is added by
// Patches 14-20 as more keyframes in the same array. The operator model (breathing, walking, lean-in) is NOT here: it lives in
// src/camera/operator.ts and is added on top of these keyframes (src/camera/path.ts).
//
// What a keyframe says. It is the state of the camera AT its frame, and the way to the next keyframe:
//   - `M`, `panX`, `panY`: the view. M is the plate magnification (on-screen photo width / 1536); panX and panY are the photo pixel that
//     sits at the centre of the frame (plate px, origin top-left). A slide of the camera is a change of panX / panY; the margin rule
//     (40 px, guide 05) decides where they may go, and below M = 1.319 only M may change.
//   - `tiltDeg`: the camera looks up (negative) or down (positive) by this much. On the flat photo a turn of the camera is a shift of
//     the window, so it moves the centre by focalPx x tan(tilt) photo px. `rollDeg`: the picture is turned clockwise on screen.
//   - `focusCm`: the distance the lens is focused at, in the units of the guide's table (260, 120, 38, 36 ...). 36 cm is the pile; see
//     FOCUS_PILE_GUIDE_CM and src/camera/path.ts (`lensOf`) for how it becomes the lens of src/camera/focus.ts.
//   - `aperture` (f-number), `focalMm` (focal length on the 36 mm sensor; the match camera is about 44 mm).
//   - `ease` and `regime` describe the segment that STARTS at this keyframe (they are ignored on the last keyframe).
// Every keyframe frame is a multiple of 30 (a beat): authored events land on beats (guide 05, rule 4). Between two keyframes with
// the same view the camera holds still; M moves in 1 / M (what a dolly does), the rest linearly, all through the eased progress.
//
// No React and no three.js, so a plain Node can read it (the audit does).

import { BEAT, type Regime } from "./timeline";
import { SIGNATURE_PEAK_SLOPE, type EaseName } from "../lib/ease";
import { PLATE_H, PLATE_W, MAGNIFICATION, M_FIT_HEIGHT } from "./plate";
import { PLATE_MATCH } from "../plate/PlateFollow";
import { pxPerCm } from "../plate/plateCamera";
import { matchFocalMm } from "../camera/focus";
import { ZONES } from "./placement";

export interface CameraKeyframe {
  /** film frame (a multiple of 30) */
  frame: number;
  /** plate magnification */
  M: number;
  /** photo px at the centre of the frame */
  panX: number;
  panY: number;
  /** degrees; positive looks down */
  tiltDeg: number;
  /** degrees; positive turns the picture clockwise */
  rollDeg: number;
  /** focus distance in the guide's units (36 = the pile) */
  focusCm: number;
  /** f-number */
  aperture: number;
  /** focal length, mm on the 36 mm sensor */
  focalMm: number;
  /** easing of the segment that starts here */
  ease: EaseName;
  /** regime of the segment that starts here */
  regime: Regime;
}

// ---------- limits (guide 05, sections 1, 2 and 6) ----------

/** Nothing a camera does is shorter than this (frames); guide 05, rule 2. */
export const MIN_MOVE_FRAMES = 48;
/** Frames of stillness between two moves, at least; guide 05, rule 2. */
export const MIN_GAP_FRAMES = 20;
/** A hold longer than this (frames) must drift; guide 05, rule 1. */
export const STILL_FRAMES = 60;
/** ... and "drift" means more than this much movement (relative: change of M, or shift of the picture over the frame's width). */
export const STILL_MOVEMENT = 0.005;
/** Peak change of plate magnification: 1.5 x per second (guide 05, rule 3). */
export const MAX_M_RATE_PER_SEC = 1.5;
/** A frame-to-frame jump of the picture above this fraction of the frame's width (or of M) is a pop (guide 05, section 7). */
export const POP_FRACTION = 0.02;
/** The camera window keeps this many photo px from the photo's edge; the same number as `EDGE_MARGIN` in config/plate.ts. */
export { EDGE_MARGIN } from "./plate";

export interface RegimeLimit {
  /** peak sideways speed of the camera, cm per second at the plate */
  lateralCmPerSec: number;
  /** the largest plate magnification the regime may show */
  maxM: number;
  /** the largest look up / down, degrees */
  maxTiltDeg: number;
  /** the largest roll, degrees */
  maxRollDeg: number;
}

/**
 * The camera budget per regime. R1 is the whole plate (it may only push a little); R2 follows the plate within the flat photo's budget;
 * R3 has the book in front of the camera and the plate only a glow, so it may tilt and roll more but must move slowly;
 * R4 slides and settles on the riser. A regime written "R3/2" or "R2/4" takes the stricter speed and the larger M of its two parts.
 */
export const REGIME_LIMITS: Record<"R1" | "R2" | "R3" | "R4", RegimeLimit> = {
  R1: { lateralCmPerSec: 40, maxM: 1.319, maxTiltDeg: 0, maxRollDeg: 0 },
  R2: { lateralCmPerSec: 40, maxM: 4.7, maxTiltDeg: 3, maxRollDeg: 1.2 },
  R3: { lateralCmPerSec: 10, maxM: 6.6, maxTiltDeg: 15, maxRollDeg: 3 },
  R4: { lateralCmPerSec: 40, maxM: 4.2, maxTiltDeg: 3, maxRollDeg: 1.2 },
};

/** The limit of a regime name, including the two-part names of the shot list. */
export function limitFor(regime: Regime): RegimeLimit {
  const parts = regime.split("/").map((p, i) => (i === 0 ? p : `R${p}`)) as ("R1" | "R2" | "R3" | "R4")[];
  const ls = parts.map((p) => REGIME_LIMITS[p]);
  return {
    lateralCmPerSec: Math.min(...ls.map((l) => l.lateralCmPerSec)),
    maxM: Math.max(...ls.map((l) => l.maxM)),
    maxTiltDeg: Math.min(...ls.map((l) => l.maxTiltDeg)),
    maxRollDeg: Math.min(...ls.map((l) => l.maxRollDeg)),
  };
}

// ---------- the lens ----------

/** The focal length of every shot so far: the match camera's (about 44 mm). A zoom is the window M, not the focal length. */
export const FOCAL_MM = matchFocalMm(PLATE_MATCH);
/**
 * The guide's focus column counts "cm" of a viewer who walks to the desk; the match camera stands 508 cm away and never moves, so those
 * numbers cannot be used as distances (38 cm would put the pile 185 px out of focus). They are rescaled instead: the focus of the
 * guide's S03 hold, 36, is the pile, and every other value keeps its ratio to it (src/camera/path.ts, `lensOf`). Decision D-33.
 */
export const FOCUS_PILE_GUIDE_CM = 36;
/** The pile's distance from the match camera, cm (the focus for FOCUS_PILE_GUIDE_CM). */
export const PILE_DISTANCE_CM = PLATE_MATCH.camDistCm + ZONES.L.anchor.Zd;

// ---------- building keyframes ----------

type State = Omit<CameraKeyframe, "frame" | "ease" | "regime">;

/**
 * The camera state a fraction `p` of the way from state `a` to state `b`. The ONE place that says how two keyframes are mixed (path.ts
 * uses it for every frame, the key builders below for the keys they place on the way): M in 1 / M (what a dolly does), the focus in
 * 1 / distance (what a focus ring does), everything else linearly.
 */
export function mixState(a: State, b: State, p: number): State {
  const lin = (x: number, y: number): number => x + (y - x) * p;
  return {
    M: 1 / (1 / a.M + (1 / b.M - 1 / a.M) * p),
    panX: lin(a.panX, b.panX),
    panY: lin(a.panY, b.panY),
    tiltDeg: lin(a.tiltDeg, b.tiltDeg),
    rollDeg: lin(a.rollDeg, b.rollDeg),
    focusCm: 1 / (1 / a.focusCm + (1 / b.focusCm - 1 / a.focusCm) * p),
    aperture: lin(a.aperture, b.aperture),
    focalMm: lin(a.focalMm, b.focalMm),
  };
}

export interface HoldOptions {
  /** the push over the whole shot, as a fraction of M: 0.02 to 0.05 (guide 05: "a 3% push") */
  push?: number;
  /** a slide over the shot, photo px */
  slide?: { x: number; y: number };
  /** frames of ease-in before the push becomes linear (a multiple of 30, at least 48 so the start is not a jerk; default 60) */
  easeFrames?: number;
  /** a focus / aperture change over the shot, and over how many of its last frames (default: from the end of the ease-in) */
  lensTo?: { focusCm: number; aperture: number };
  pullFrames?: number;
  /** ease and regime of the segment that starts at `to` (the next shot's first move) */
  next?: { ease: EaseName; regime: Regime };
  /** regime of the hold itself */
  regime: Regime;
}

/**
 * A shot that holds with a slow push: the camera eases in over `easeFrames`, then pushes in at a constant rate, so it never sits dead
 * still (guide 05, rule 1). Returns three keyframes (at `from`, `from + easeFrames` and `to`); the last one is the state the next move
 * starts from, so put the next keyframe AFTER it, not on it. The push is 2 to 5 percent of M over the whole shot.
 */
export function holdShot(from: number, to: number, base: State, o: HoldOptions): CameraKeyframe[] {
  const push = o.push ?? 0.04;
  const easeFrames = o.easeFrames ?? 2 * BEAT;
  if (!(push >= 0.02 && push <= 0.05)) throw new Error(`holdShot: the push must be 2 to 5 percent, got ${(push * 100).toFixed(2)}`);
  if (from % BEAT !== 0 || to % BEAT !== 0 || easeFrames % BEAT !== 0) throw new Error(`holdShot: frames must be on a beat (multiples of ${BEAT}), got ${from}, ${to}, ${easeFrames}`);
  if (easeFrames < 48) throw new Error(`holdShot: the ease-in must last at least 48 frames, got ${easeFrames}`);
  if (to - from <= easeFrames) throw new Error(`holdShot: the shot (${to - from} frames) must be longer than its ease-in (${easeFrames})`);
  const L = to - from;
  // an ease that ends at rest is followed by a straight line, so the line is steeper by L / (L - E/2); the middle key sits E/2 / (L - E/2) of the way
  const share = easeFrames / 2 / (L - easeFrames / 2);
  const endM = base.M * (1 + push);
  const slide = o.slide ?? { x: 0, y: 0 };
  const mid = (a: number, b: number): number => a + (b - a) * share;
  const lensEnd = o.lensTo ?? { focusCm: base.focusCm, aperture: base.aperture };
  const pull = Math.min(o.pullFrames ?? to - (from + easeFrames), to - (from + easeFrames));
  const keys: CameraKeyframe[] = [
    { frame: from, ...base, ease: "signature", regime: o.regime },
    { frame: from + easeFrames, ...base, M: mid(base.M, endM), panX: mid(base.panX, base.panX + slide.x), panY: mid(base.panY, base.panY + slide.y), ease: "linear", regime: o.regime },
  ];
  if (o.lensTo && pull < to - (from + easeFrames)) {
    // the focus pull only happens in the last `pull` frames: a key where it starts, on the straight line of the push
    const f = (to - pull - from - easeFrames) / (L - easeFrames);
    const m0 = keys[1].M;
    const invM = 1 / m0 + (1 / endM - 1 / m0) * f;
    keys.push({ frame: to - pull, ...base, M: 1 / invM, panX: keys[1].panX + (base.panX + slide.x - keys[1].panX) * f, panY: keys[1].panY + (base.panY + slide.y - keys[1].panY) * f, ease: "linear", regime: o.regime });
  }
  keys.push({ frame: to, ...base, M: endM, panX: base.panX + slide.x, panY: base.panY + slide.y, focusCm: lensEnd.focusCm, aperture: lensEnd.aperture, ease: o.next?.ease ?? "signature", regime: o.next?.regime ?? o.regime });
  return keys;
}

export interface GlideOptions {
  /** frames of ease-in and of ease-out (multiples of 30, each at least 48) */
  inFrames: number;
  outFrames: number;
  /** regime of the move itself */
  regime: Regime;
  /** ease and regime of the segment that starts at `to` (what the camera does next) */
  next?: { ease: EaseName; regime: Regime };
}

/**
 * A long move that never jumps in speed: it eases in (`signatureIn`), runs straight, and eases out (`signatureOut`), so its peak speed is
 * the speed of the straight part, below the 2.86 x the mean that a single `signature` peaks at (2.3 x for the S01 walk: 90 + 120 of its 240
 * frames are easing, and the longer the eases the closer the peak gets to the mean). The two keys on the way are placed so
 * that the speeds meet exactly: with v the share of the move covered per frame in the straight part, the ease-in covers v x in / s, the
 * ease-out v x out / s (s = the peak slope of `signature`), and v = 1 / (L - (in + out) (1 - 1 / s)). Returns four keyframes (at `from`,
 * `from + inFrames`, `to - outFrames` and `to`); the last is the state the next move starts from.
 */
export function glideShot(from: number, to: number, a: State, b: State, o: GlideOptions): CameraKeyframe[] {
  const L = to - from;
  if (from % BEAT !== 0 || to % BEAT !== 0 || o.inFrames % BEAT !== 0 || o.outFrames % BEAT !== 0) throw new Error(`glideShot: frames must be on a beat (multiples of ${BEAT}), got ${from}, ${to}, ${o.inFrames}, ${o.outFrames}`);
  if (o.inFrames < 48 || o.outFrames < 48) throw new Error(`glideShot: the ease-in and the ease-out must last at least 48 frames, got ${o.inFrames} and ${o.outFrames}`);
  if (L <= o.inFrames + o.outFrames) throw new Error(`glideShot: the move (${L} frames) must be longer than its two eases (${o.inFrames + o.outFrames})`);
  const s = SIGNATURE_PEAK_SLOPE;
  const v = 1 / (L - (o.inFrames + o.outFrames) * (1 - 1 / s));
  const p1 = (v * o.inFrames) / s;
  const p2 = 1 - (v * o.outFrames) / s;
  return [
    { frame: from, ...a, ease: "signatureIn", regime: o.regime },
    { frame: from + o.inFrames, ...mixState(a, b, p1), ease: "linear", regime: o.regime },
    { frame: to - o.outFrames, ...mixState(a, b, p2), ease: "signatureOut", regime: o.regime },
    { frame: to, ...b, ease: o.next?.ease ?? "signature", regime: o.next?.regime ?? o.regime },
  ];
}

/** Throws unless the keyframes are in order, on whole frames, start at 0 and carry usable numbers. Runs when this module loads. */
export function checkKeyframes(keys: readonly CameraKeyframe[]): void {
  if (keys.length < 2) throw new Error("camera: at least two keyframes are needed");
  keys.forEach((k, i) => {
    const at = `camera: keyframe ${i} (frame ${k.frame})`;
    if (!Number.isInteger(k.frame)) throw new Error(`${at} is not on a whole frame`);
    if (i === 0 && k.frame !== 0) throw new Error(`${at}: the first keyframe must be at frame 0`);
    if (i > 0 && k.frame <= keys[i - 1].frame) throw new Error(`${at} is not after the previous keyframe (${keys[i - 1].frame})`);
    for (const [name, v] of Object.entries({ M: k.M, panX: k.panX, panY: k.panY, tiltDeg: k.tiltDeg, rollDeg: k.rollDeg, focusCm: k.focusCm, aperture: k.aperture, focalMm: k.focalMm })) {
      if (!Number.isFinite(v)) throw new Error(`${at}: ${name} is not a number`);
    }
    if (!(k.M > 0)) throw new Error(`${at}: M must be positive`);
    if (!(k.focusCm > 0) || !(k.aperture > 0) || !(k.focalMm > 0)) throw new Error(`${at}: focus, aperture and focal length must be positive`);
  });
}

// ---------- S00-S03: the keyframes of guide 05, section 4 ----------

const CX = PLATE_W / 2;
const CY = PLATE_H / 2;
const lens = (focusCm: number, aperture: number) => ({ focusCm, aperture, focalMm: FOCAL_MM });
const still = (M: number, panX: number, panY: number, focusCm: number, aperture: number): State => ({ M, panX, panY, tiltDeg: 0, rollDeg: 0, ...lens(focusCm, aperture) });

/** Where S01 ends (the camera has walked to the desk) and where S02 ends (the pile fills the view); photo px. */
export const VIEW_ARRIVED = { M: 2.46, panX: 600, panY: 490 } as const;
export const VIEW_PILE = { M: 4.49, panX: 418, panY: 545 } as const;

/** a keyframe without its frame, ease and regime: the state a glide starts from */
const stateOf = (k: CameraKeyframe): State => ({ M: k.M, panX: k.panX, panY: k.panY, tiltDeg: k.tiltDeg, rollDeg: k.rollDeg, focusCm: k.focusCm, aperture: k.aperture, focalMm: k.focalMm });

const ARRIVED = still(VIEW_ARRIVED.M, VIEW_ARRIVED.panX, VIEW_ARRIVED.panY, 120, 4);
const PILE = still(VIEW_PILE.M, VIEW_PILE.panX, VIEW_PILE.panY, 38, 2.8);

// S00: the opening hold. Its last key (frame 240) is the state the walk starts from; the walk's own first key replaces it.
const S00 = holdShot(0, 240, still(M_FIT_HEIGHT, CX, CY, FOCUS_PILE_GUIDE_CM, 8), {
  regime: "R1",
  push: 0.03,
  lensTo: { focusCm: 260, aperture: 4 },
  pullFrames: 60,
});

// S01: the walk to the desk. A glide, so the speed of M and of the slide never jumps (a single `signature` peaks at 2.86 x the mean
// and breaks the 1.5 x per second limit on M and the 40 cm/s limit with the walking bob on top).
const S01 = glideShot(240, 480, stateOf(S00[S00.length - 1]), ARRIVED, { inFrames: 90, outFrames: 120, regime: "R2", next: { ease: "linear", regime: "R2" } });

// S02 and S03 are one move: the lean in slows to the pile and the pile hold's push carries on from there, so the camera does not stop
// dead at the pile (the glide's last key is the first key of S03, so it is left out).
const S02 = glideShot(510, 840, ARRIVED, PILE, { inFrames: 60, outFrames: 120, regime: "R2" }).slice(0, -1);

const S03 = holdShot(840, 960, PILE, {
  regime: "R2",
  push: 4.63 / VIEW_PILE.M - 1,
  slide: { x: 1.5 * pxPerCm(PLATE_MATCH, PLATE_MATCH.plateDepthCm), y: 0 },
  lensTo: { focusCm: FOCUS_PILE_GUIDE_CM, aperture: 2.8 },
  next: { ease: "signature", regime: "R3" },
});

/**
 * PLACEHOLDERS for S00-S03 (frames 0-959), taken from the table of guide 05 section 4:
 *   S00 0-239    micro push, all in focus, f/8 (the last second pulls to the S01 lens, so the focus does not jump at the cut)
 *   S01 240-479  the walk: M to 2.46 toward the lamp side, focus 260 to 120, f/4; the camera arrives at 480 and holds one beat
 *   S02 480-839  the lean in: M 2.46 to 4.49, focus 120 to 38, f/2.8; the move starts at 510 (the first beat is still)
 *   S03 840-959  the pile hold: a 3% push and a 1.5 cm slide, focus 36, f/2.8; it carries on from the end of S02's glide
 * From frame 960 the camera holds its last state until Patch 14 adds S04 onward.
 *
 * Two numbers differ from the guide's table, both found with `npm run motion`: the S00 push is 3% (M 1.2875 at frame 240; the table says
 * 2.5%, M 1.28), because with 2.5% the walking bob lands on the margin rule just as the window opens and the sideways speed reaches 48 cm/s
 * (limit 40); and S02 ends in S03's push instead of coming to rest at frame 810, which removes a 66 frame stop at the pile.
 *
 * ONE deliberate exception, STILL at frames 0-65: the film opens from rest. The ease-in of a hold is at least 60 frames (a multiple of
 * 30, so its key is on a beat) and R1 can only change M, so the picture moves less than 0.5% for the first 66 frames. See docs/PATCH_NOTES.md.
 */
export const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [...S00.slice(0, -1), ...S01, ...S02, ...S03];
checkKeyframes(CAMERA_KEYFRAMES);

/**
 * Findings of `npm run motion` that are deliberate, each with the reason (guide 05, section 7: "a deliberate exception is written in
 * docs/PATCH_NOTES.md with the frame"). The audit labels a finding that lies inside one of these ranges as a KNOWN EXCEPTION and does
 * not fail on it; any other finding fails. Keep this list short and give every entry its frames.
 */
export const KNOWN_EXCEPTIONS: readonly { code: "STILL" | "FAST" | "DEEP" | "EDGE" | "POP" | "LATE"; from: number; to: number; why: string }[] = [
  { code: "STILL", from: 0, to: 65, why: "the film opens from rest: the hold's ease-in is 60 frames and R1 can only change M (see the note above CAMERA_KEYFRAMES)" },
];

/** The magnification band the budget allows without any defocus; re-exported so the audit and the dev sheet read one number. */
export const SHARP_UP_TO = MAGNIFICATION.sharpUpTo;
