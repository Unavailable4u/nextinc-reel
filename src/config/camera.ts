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

export type State = Omit<CameraKeyframe, "frame" | "ease" | "regime">;

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
export const stateOf = (k: CameraKeyframe): State => ({ M: k.M, panX: k.panX, panY: k.panY, tiltDeg: k.tiltDeg, rollDeg: k.rollDeg, focusCm: k.focusCm, aperture: k.aperture, focalMm: k.focalMm });

/**
 * Where S04 ends (Patch 14): the plate magnification the lift hands over at, and the lens of the held book. The pan is the pile hold's
 * (the handover is a dolly toward the pile, so the plate does not slide behind the book). The guide's table asks for M 6.51 "hidden";
 * it is 6.0 here (the notes of Patch 05 wrote the first plan's 9 as 6), because the signature ease over the 120 frames of S04
 * changes M faster than 1.5 x per second above about 6.15 (decision D-59). Patches 15 and 17 start from it.
 */
export const VIEW_LIFT = { M: 6.0, focusCm: 30, aperture: 2 } as const;

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
 * Where the cover hero ends and the reading camera starts (Patch 15): S05 re-centres the held book and pushes in 4 percent
 * (M 6.0 to 6.24, the window from the pile hold's pan to the photo pixel under the middle of the held book), with the lens of S04
 * (focus 30, f/2). At M 6.0 the held book's top edge is 2 px above the frame and its middle 285 px above the middle of it, so the
 * window has to slide down the photo by 48 px; the book's middle is at plate px (415, 497) (D-64). 6.24 is inside the R3 budget (6.6)
 * with room for the operator's lean and breathing on top.
 */
export const VIEW_HERO = { M: 6.24, panX: 415, panY: 497, focusCm: VIEW_LIFT.focusCm, aperture: VIEW_LIFT.aperture } as const;

/**
 * Where the camera is once the cover is open, on frame 1560 (the end of S06): the window has slid 20 photo px to the left, towards the
 * open book's middle (the spread is wider than the closed book and its middle is 7.4 cm left of it), a little further in (M 6.32) and
 * with the reading lens of guide 05 section 4 for S06-S09 (focus 32, f/2.8). The slide is 3.5 cm/s on average and 10 cm/s at its peak,
 * the R3 limit, which is why it takes the 120 frames of S06 and not fewer.
 */
export const VIEW_OPEN = { M: 6.32, panX: 395, panY: 500, focusCm: 32, aperture: 2.8 } as const;

/**
 * Where the reading camera ends, on frame 1920 (the first frame of S10, which starts from it): the window drifted a little further
 * to the left and 12 photo px down the page, towards the caption of the right page, and in to M 6.52 (under the R3 budget of 6.6
 * with the operator's breathing on top). From frame 1560 it is one straight run, so the camera never stands still. The "tilt down
 * 10 degrees" of the guide's table is the book's pitch (`config/heroMotion.ts`, D-65): the match camera cannot tilt, a tilt of the
 * window would take the book out of the frame.
 */
export const VIEW_READ = { M: 6.52, panX: 392, panY: 512, focusCm: 32, aperture: 2.8 } as const;

/**
 * Where the pull-back of the riffle ends, on frame 2040 (the first frame of S11, which starts from it; Patch 16): the window is centred on
 * the open spread as the raised book holds it (the spread's middle is plate px (387, 497) at a pitch of 87 degrees, measured in
 * `tests/acts4.test.ts`), M 5.8 (a pull back of 11 percent from the reading view: the guide's "pull back 6 cm" at the focus of 36 is 14
 * percent), focus 36 and f/2.8 as the table says for S10. S11-S13 then push in 4 percent a spread from here.
 */
export const VIEW_BLOCK = { M: 5.8, panX: 387, panY: 497, focusCm: 36, aperture: 2.8 } as const;

/**
 * Where the middle of the book ends, on frame 2760 (the first frame of S14): three pushes of 4 percent from `VIEW_BLOCK` end at M 6.52, the
 * reading view's M, under the R3 budget of 6.6; the window has slid 18 photo px towards the right page, where the QR codes are (the
 * right page's middle is plate px 415), and the lens is the table's for S11-S13 (focus 28, f/2.8).
 */
export const VIEW_LINKS = { M: 6.52, panX: 405, panY: 497, focusCm: 28, aperture: 2.8 } as const;

/** The camera state S04 ends in (its closing key on frame 1080, `src/shots/S04.tsx`): S03's last key with the lift's view and lens. */
const LIFT_STATE: State = { ...stateOf(S03[S03.length - 1]), M: VIEW_LIFT.M, focusCm: VIEW_LIFT.focusCm, aperture: VIEW_LIFT.aperture };
const HERO_STATE: State = { ...LIFT_STATE, M: VIEW_HERO.M, panX: VIEW_HERO.panX, panY: VIEW_HERO.panY };
const OPEN_STATE: State = { ...HERO_STATE, M: VIEW_OPEN.M, panX: VIEW_OPEN.panX, panY: VIEW_OPEN.panY, focusCm: VIEW_OPEN.focusCm, aperture: VIEW_OPEN.aperture };
const READ_STATE: State = { ...OPEN_STATE, M: VIEW_READ.M, panX: VIEW_READ.panX, panY: VIEW_READ.panY };

// S05: one glide from S04's key on frame 1080 to the hero view on frame 1440 (60 frames of ease-in, a straight run, 60 of ease-out). Its
// first key is S04's and its last is S06's, so S05 owns the two keys on the way.
const S05 = glideShot(1080, 1440, LIFT_STATE, HERO_STATE, { inFrames: 60, outFrames: 60, regime: "R3" });
// S06: the hero view on frame 1440 to the open view on frame 1560, one `signature` ease (a stop on 1440 of less than 60 frames: the glide
// before it eases out and this eases in); the camera slides to the open book's middle while the cover swings.
// S07-S09: from the open view straight to the reading view on frame 1920 (S09's closing key), a run at constant speed with no stop.
const READING: readonly CameraKeyframe[] = [
  { frame: 1440, ...HERO_STATE, ease: "signature", regime: "R3" },
  { frame: 1560, ...OPEN_STATE, ease: "linear", regime: "R3" },
  { frame: 1920, ...READ_STATE, ease: "signature", regime: "R3" },
];

// S10: the pull back from the reading view to the block view, one `signature` ease (the ease of S09's key on frame 1920) with the book
// raised and the riffle under it. S11-S13: one straight push from there to the links view, 720 frames at a constant rate: 4 percent a
// spread, no stop and no corner, so the QR hold is a flat, steady, slowly growing picture. The push starts at its own speed (about 1
// percent of M per second) straight from the pull back's rest: an ease-in would have left the camera still for 80 frames at the turn
// (the audit's STILL), and a jump from rest to 0.017 percent of M a frame is not seen. The lens racks from the table's focus of S10 (36)
// to that of S11-S13 (28) over the first 60 frames of the push, with the key that carries the rack on the straight line.
const BLOCK_STATE: State = { ...READ_STATE, M: VIEW_BLOCK.M, panX: VIEW_BLOCK.panX, panY: VIEW_BLOCK.panY, focusCm: VIEW_BLOCK.focusCm, aperture: VIEW_BLOCK.aperture };
const LINKS_STATE: State = { ...BLOCK_STATE, M: VIEW_LINKS.M, panX: VIEW_LINKS.panX, panY: VIEW_LINKS.panY, focusCm: VIEW_LINKS.focusCm, aperture: VIEW_LINKS.aperture };
const PUSH_FROM = 2040;
const PUSH_TO = 2760;
const PUSH_RACK_FRAMES = 60;
const PUSH_KEY: State = { ...mixState(BLOCK_STATE, LINKS_STATE, PUSH_RACK_FRAMES / (PUSH_TO - PUSH_FROM)), focusCm: VIEW_LINKS.focusCm, aperture: VIEW_LINKS.aperture };
const MIDDLE: readonly CameraKeyframe[] = [
  { frame: PUSH_FROM, ...BLOCK_STATE, ease: "linear", regime: "R3" },
  { frame: PUSH_FROM + PUSH_RACK_FRAMES, ...PUSH_KEY, ease: "linear", regime: "R3" },
  { frame: PUSH_TO, ...LINKS_STATE, ease: "signatureIn", regime: "R3" },
];

/**
 * Where the camera is once Mini Me has been set down and the camera has come back to the pile, on frame 3000 (the first frame of S16,
 * which starts from it; Patch 17): the pile hold's own view (the last key of S03: M 4.63, the window the lift started from) with the lens
 * of guide 05 section 4 for S15 (focus 40, f/2.8). MiniLocker is the top book of the pile again, so the next lift is the lift of S04 over a
 * pile of two. The table's "M falls from 6.51 to 4.63" is this move: it starts from `VIEW_LINKS` (6.52).
 */
export const VIEW_SET = { M: S03[S03.length - 1].M, panX: S03[S03.length - 1].panX, panY: S03[S03.length - 1].panY, focusCm: 40, aperture: 2.8 } as const;
/** The focus of S14 (guide 05 section 4: 38, f/2.8): reached over the first 60 frames of the pull back, held until the book is down. */
export const FOCUS_CLOSE = 38;

// S14-S15: the pull back and the return to the pile are ONE glide from the links view (frame 2760, where S11-S13's push ends) to the pile
// view (frame 3000): 60 frames of ease-in, a straight run and 90 of ease-out, so the speed never jumps at the shot boundary on 2880 (two
// `signature` eases back to back stop the camera for a frame and the audit reads two moves less than 20 frames apart, as it did for S02
// and S03). The ease-out is the longer one so that the camera arrives at the pile gently while the book comes down, and so that the
// straight run is fast enough to clear the turn at 2760: with 60 and 60 the push has just ended, the pull back starts from rest and the
// audit finds 61 frames (2731-2791) whose ends are within 0.5 percent (STILL); with 60 and 90 it finds nothing. M goes 6.52 to 4.63 in
// 1 / M (what a dolly does): 5.29 on frame 2880, where the carry starts, so the book is smaller in the frame as it is carried across and the
// pile fills it as it comes down. The window slides to the pile hold's. The lens racks from 28 to the table's 38 over the first 60 frames,
// while the held book is being closed, stays there, and goes to 40 in the last 90 frames.
// The first key is S13's (its ease is `signatureIn` for this reason); the segment from 2910 is "R3/2": the plate is coming back (R2) with
// the held book still in front of it (R3), so it takes the stricter speed of the two and the larger M, as S21's does.
const SET_STATE: State = { ...stateOf(S03[S03.length - 1]), focusCm: VIEW_SET.focusCm, aperture: VIEW_SET.aperture };
const CLOSE_GLIDE = glideShot(2760, 3000, LINKS_STATE, SET_STATE, { inFrames: 60, outFrames: 90, regime: "R3", next: { ease: "signature", regime: "R3" } });
const CLOSING: readonly CameraKeyframe[] = [
  CLOSE_GLIDE[0],
  { ...CLOSE_GLIDE[1], focusCm: FOCUS_CLOSE, aperture: 2.8 },
  { ...CLOSE_GLIDE[2], focusCm: FOCUS_CLOSE, aperture: 2.8, regime: "R3/2" },
  CLOSE_GLIDE[3],
];

// ---------- Act 6: the second book (Patch 18), S16-S21, frames 3000-3959 ----------
//
// The same camera grammar as Mini Me's, with the views of Patches 15 to 17 reused (the held book is in the same place, so the same windows frame it), and
// faster where the book is: the guide's "30 percent faster" is the book's moves (`BOOK_SCRIPT.minilocker`); the camera has its own limits (guide 05, section 6).
//
//   S16 3000-3119  the lift of S04 over a pile of two: one `signature` ease from the pile view (`VIEW_SET`, M 4.63, focus 40) to `HERO_STATES.lift`
//                  (M 6.0, focus 30, f/2), 120 frames like S04's, 1.477 x per second at its peak
//   S17 3120-3359  the cover hero, 4 seconds: a glide (60 frames in, 60 out, a straight run) to `HERO_STATES.hero` (M 6.24, the window on the middle of the held book)
//   S18 3360-3479  the cover opens: one `signature` ease to `HERO_STATES.open` (M 6.32, 20 px to the left, focus 32, f/2.8), as S06's
//   S19 3480-3719  a rest of 30 frames on the title spread, the pull back to `HERO_STATES.block` (M 5.8, focus 36) over the riffle (3510-3570, 60 frames), then one
//                  straight push of 240 frames to `HERO_STATES.links` (M 6.52, focus 28, the window 18 px towards the right page), the focus racked over its first 60
//   S20-S21        the push ends on 3810 and carries on as one glide (60 in, a straight run of 30, 60 out) to the pile view on 3960, the state S22 starts from:
//                  it is slow enough at the start (the ease-in) that the QR page is as big as the first book's until the page-back sheet covers it (3834)
const BOOK2_KEYS = {
  lift: 3120,
  hero: 3360,
  open: 3480,
  openRest: 3510,
  block: 3570,
  rack: 3630,
  links: 3810,
  set: 3960,
};
const B2_RACK_FRAMES = 60;
// The push of the second book ends a little lower on the photo than the first book's (panY 520, not 497): the glide that follows has 150 frames and not 240 to get
// from here to the pile view, and with the window 48 photo px higher it slid at 14.6 cm/s, over the R3 limit of 10. The book stands 150 screen px above the middle of the
// frame at the end of the push instead of in it, which the spread's margins allow (`tests/acts6.test.ts` measures them); the slide left is 28 photo px, 8 cm/s at its peak.
const BOOK2_LINKS_PAN_Y = 520;
const B2_LINKS_STATE: State = { ...LINKS_STATE, panY: BOOK2_LINKS_PAN_Y };
const B2_PUSH_KEY: State = { ...mixState(BLOCK_STATE, B2_LINKS_STATE, B2_RACK_FRAMES / (BOOK2_KEYS.links - BOOK2_KEYS.block)), focusCm: VIEW_LINKS.focusCm, aperture: VIEW_LINKS.aperture };
const B2_HERO_GLIDE = glideShot(BOOK2_KEYS.lift, BOOK2_KEYS.hero, LIFT_STATE, HERO_STATE, { inFrames: 60, outFrames: 60, regime: "R3" });
// its last key (frame 3960) is S21's closing key and the first key of S22 (Patch 19): the segment that starts there is S22's pull back, an ease-in in "R2/4"
const B2_CLOSE_GLIDE = glideShot(BOOK2_KEYS.links, BOOK2_KEYS.set, B2_LINKS_STATE, SET_STATE, { inFrames: 60, outFrames: 60, regime: "R3", next: { ease: "signatureIn", regime: "R2/4" } });
const BOOK2: readonly CameraKeyframe[] = [
  { frame: BOOK2_KEYS.lift, ...LIFT_STATE, ease: "signatureIn", regime: "R3" },
  B2_HERO_GLIDE[1],
  B2_HERO_GLIDE[2],
  { frame: BOOK2_KEYS.hero, ...HERO_STATE, ease: "signature", regime: "R3" },
  { frame: BOOK2_KEYS.open, ...OPEN_STATE, ease: "linear", regime: "R3" },
  { frame: BOOK2_KEYS.openRest, ...OPEN_STATE, ease: "signature", regime: "R3" },
  { frame: BOOK2_KEYS.block, ...BLOCK_STATE, ease: "linear", regime: "R3" },
  { frame: BOOK2_KEYS.rack, ...B2_PUSH_KEY, ease: "linear", regime: "R3" },
  { ...B2_CLOSE_GLIDE[0] },
  // the lens goes to the table's focus for the close (38) over the first 60 frames of the glide and stays there while the book is carried, as S14's
  { ...B2_CLOSE_GLIDE[1], focusCm: FOCUS_CLOSE, aperture: 2.8 },
  { ...B2_CLOSE_GLIDE[2], focusCm: FOCUS_CLOSE, aperture: 2.8, regime: "R3/2" },
  B2_CLOSE_GLIDE[3],
];

// ---------- Act 7: to the right (Patch 19), S22-S23, frames 3960-4799 ----------
//
// The camera pulls back from the pile, slides right along the desk past the keyboard and the chair, and settles on the riser. It is TWO glides with one stop between them,
// and the stop is under the chair wipe (`config/chairWipe.ts`: the frame is covered from 4134 to 4206), so nobody sees the camera rest:
//
//   S22 3960-4170  pull back and truck (R2/4): M 4.63 to 2.46 (the table's pull back) and the window from the pile (plate px 423) to 700, focus racked from 40 to 90,
//                  a glide of 60 frames in, a straight run and 60 out. The ease-out is the part the wipe covers (4134-4170).
//   S22 4170-4380  settle and push (R2/4, then R4 from 4380): M 2.46 to 3.76 and the window on to 948, focus back to 50. A glide as well (60 in, 90 straight, 60 out), so
//                  the move is 210 frames: the 150 frames the table's 4320 would leave made the sideways speed 59 cm/s (limit 40) and M change 1.9 x a second. The
//                  ease-out starts on 4320 (S22's closing key, M 3.47) and the camera is settled on 4380, one second into S23, the frame the first label arrives on.
//   S23 4380-4800  one straight push of 5.9 percent (the table's 6) to M 3.98 with the window sliding 10 more plate px, the aperture closing to f/4 (the table's "all four sharp").
//                  It starts at its own speed from the settle's rest (as S11's push does from the pull back's) and carries on into S24's push (the closing key's ease is linear).
//
// The numbers of the table that this changes: S22 ends on M 3.47 and not 3.76 (that M is reached on 4380); the truck is +525 plate px (the table's +456 left the riser's
// right-hand label 100 px off the frame, see D-91); the pan y falls from the pile hold's 545 to 520 so the four books sit in the upper half with the desk's front below.
const TURN_FRAME = 4170;
const SETTLE_FRAME = 4380;
/** The wide view under the chair wipe (frame 4170): the table's M 2.46, the window half way along the desk (the chair's middle is plate px 806), focus 90 (the table's start). */
export const VIEW_TURN = { M: 2.46, panX: 700, panY: 535, focusCm: 90, aperture: 2.8 } as const;
/** The camera settled beside the riser (frame 4380): the table's S23 start M 3.76, the window 11 plate px short of the end of the push, focus 50, f/2.8. */
export const VIEW_RISER_IN = { M: 3.76, panX: 948, panY: 520, focusCm: 50, aperture: 2.8 } as const;
/** The end of S23 (frame 4800, the first frame of S24): M 3.98 (the table's 6 percent push), f/4, the window left of the lit shelf (the riser stands at plate px 898-1048). */
export const VIEW_RISER = { M: 3.98, panX: 958, panY: 520, focusCm: 50, aperture: 4 } as const;

const TURN_STATE: State = { ...SET_STATE, ...VIEW_TURN };
const RISER_IN_STATE: State = { ...SET_STATE, ...VIEW_RISER_IN };
const RISER_STATE: State = { ...SET_STATE, ...VIEW_RISER };
const PULL_BACK = glideShot(BOOK2_KEYS.set, TURN_FRAME, SET_STATE, TURN_STATE, { inFrames: 60, outFrames: 60, regime: "R2/4", next: { ease: "signatureIn", regime: "R2/4" } });
const SETTLE = glideShot(TURN_FRAME, SETTLE_FRAME, TURN_STATE, RISER_IN_STATE, { inFrames: 60, outFrames: 60, regime: "R2/4", next: { ease: "linear", regime: "R4" } });
const ACT7: readonly CameraKeyframe[] = [
  // frame 3960 is S21's closing key; the keys of S22 are the rest of the pull back (4020, 4110, 4170), then the settle's (4230, 4320), and S23's are 4380 and the closing key 4800
  PULL_BACK[1],
  PULL_BACK[2],
  PULL_BACK[3],
  SETTLE[1],
  SETTLE[2],
  SETTLE[3],
  { frame: 4800, ...RISER_STATE, ease: "linear", regime: "R4" },
];

// ---------- Act 8: the mark (Patch 20), S24-S25, frames 4800-5399 ----------
//
// The room dims and the wordmark draws in while the camera carries on, slower. It is ONE straight move from the end of S23's push (frame 4800, `VIEW_RISER`) to the end of the film, so the camera is
// never still under the card (guide 05, rule 1: a hold over 60 frames needs a drift) and there is no corner in speed where S24 ends and S25 begins:
//   S24 4800-5280  the table's push of 3 percent, M 3.98 to 4.09, the lens opening from f/4 to f/2.8 (the table: the riser falls off, so the plate behind the books goes soft and the
//                  wordmark sits over a soft background), focus 50. The window slides 17.6 plate px right and down, which is the part that keeps the audit's STILL quiet (M alone
//                  moves 0.5 percent only in 87 frames) and what gives the card room: the books drift towards the middle of the frame and rise, leaving the desk's front below them for the wordmark.
//   S25 5280-5400  the same line carried on at the same speed (the table's "hold with micro-drift"): M ends at 4.12 (0.7 percent more than 4.09), the lens does not change. The last key is on 5400,
//                  the frame after the film, as every shot's closing key is on the first frame of the next shot, so the audit's default range is the whole film, 0-5399.
// The speed of M drops at 4800 (S23's push is 5.9 percent in 420 frames, S24's 3 percent in 480): the table's two numbers, 0.8 percent a second to 0.34, with the dim starting on the same frame.
const MARK_FRAME = 5280;
const END_FRAME = 5400;
/** The camera at the end of S24 (frame 5280): the table's M 4.09 and f/2.8, focus 50, the window 17.6 plate px right and down of the riser view (the books sit near the middle of the frame, about y 125-570). */
export const VIEW_MARK = { M: 4.09, panX: 975.6, panY: 537.6, focusCm: 50, aperture: 2.8 } as const;
const MARK_STATE: State = { ...RISER_STATE, ...VIEW_MARK };
/** The end of the film (frame 5400): the line of S24 carried on for 120 more frames, the lens as it was. */
const END_STATE: State = { ...mixState(RISER_STATE, MARK_STATE, (END_FRAME - 4800) / (MARK_FRAME - 4800)), focusCm: VIEW_MARK.focusCm, aperture: VIEW_MARK.aperture };
export const VIEW_END = { M: END_STATE.M, panX: END_STATE.panX, panY: END_STATE.panY, focusCm: END_STATE.focusCm, aperture: END_STATE.aperture } as const;
const ACT8: readonly CameraKeyframe[] = [
  { frame: MARK_FRAME, ...MARK_STATE, ease: "linear", regime: "R4" },
  { frame: END_FRAME, ...END_STATE, ease: "linear", regime: "R4" },
];

/**
 * The keyframes of S00-S03, one array per shot (Patch 13A), of S05-S09 (Patch 15), of S10-S13 (Patch 16), of S14-S15 (Patch 17), of S16-S21 (Patch 18), of S22-S23 (Patch 19) and of S24-S25 (Patch 20). The shot files in `src/shots/` take their `camera` from here, so a shot owns
 * its keyframes and the registry (`src/shots/index.ts`, `FILM_CAMERA_KEYFRAMES`) can put them back together. A shot's keys lie inside its
 * own frames, plus one closing key on the first frame of the next shot (the state the next move starts from): S03's key at frame 960 is
 * the example. The arrays are the ones the builders above made, split where the shots split, in the order they were joined before.
 * Patch 15 adds S05-S09 (S04's one key is in `src/shots/S04.tsx`; S08 is inside the reading run and owns no key). Patch 17 adds S14 (the key
 * on 2820, where the focus rack ends) and S15 (2910, where the ease-out starts, and the closing key on 3000 that S16 starts from).
 */
export const SHOT_KEYFRAMES: Readonly<Record<"S00" | "S01" | "S02" | "S03" | "S05" | "S06" | "S07" | "S08" | "S09" | "S10" | "S11" | "S12" | "S13" | "S14" | "S15" | "S16" | "S17" | "S18" | "S19" | "S20" | "S21" | "S22" | "S23" | "S24" | "S25", readonly CameraKeyframe[]>> = {
  S00: S00.slice(0, -1),
  S01,
  S02,
  S03,
  S05: S05.slice(1, -1),
  S06: READING.filter((k) => k.frame < 1560),
  S07: READING.filter((k) => k.frame === 1560),
  S08: [],
  S09: READING.filter((k) => k.frame === 1920),
  S10: MIDDLE.filter((k) => k.frame === 2040),
  S11: MIDDLE.filter((k) => k.frame === 2100),
  S12: [],
  S13: MIDDLE.filter((k) => k.frame === 2760),
  S14: CLOSING.filter((k) => k.frame > 2760 && k.frame < 2880),
  S15: CLOSING.filter((k) => k.frame >= 2880),
  // Patch 18: the keys of the second book, each on the shot it lies in; S16 owns the closing key on 3120 (as S04 owns its closing key), S21 the one on 3960
  S16: BOOK2.filter((k) => k.frame === 3120),
  S17: BOOK2.filter((k) => k.frame > 3120 && k.frame < 3360),
  S18: BOOK2.filter((k) => k.frame === 3360),
  S19: BOOK2.filter((k) => k.frame >= 3480 && k.frame < 3720),
  S20: BOOK2.filter((k) => k.frame >= 3720 && k.frame < 3840),
  S21: BOOK2.filter((k) => k.frame >= 3840),
  // Patch 19: S22 owns the keys 4020 to 4320 (the settle's ease-out starts on its last frame, as S15's does), S23 the key on 4380 and its closing key on 4800
  S22: ACT7.filter((k) => k.frame < 4380),
  S23: ACT7.filter((k) => k.frame >= 4380),
  // Patch 20: S24 owns the closing key on 5280 (the table's M 4.09); S25 owns the closing key on 5400, the frame after the film, so the film's camera runs to its last frame
  S24: ACT8.filter((k) => k.frame === MARK_FRAME),
  S25: ACT8.filter((k) => k.frame === END_FRAME),
};

/** The state S04 ends in and the views of Patches 15 to 17 as states (the tests compare the shot files' keys with them). */
export const HERO_STATES = { lift: LIFT_STATE, hero: HERO_STATE, open: OPEN_STATE, read: READ_STATE, block: BLOCK_STATE, links: LINKS_STATE, set: SET_STATE, links2: B2_LINKS_STATE, turn: TURN_STATE, riserIn: RISER_IN_STATE, riser: RISER_STATE, mark: MARK_STATE, end: END_STATE } as const;

/**
 * PLACEHOLDERS for S00-S03 (frames 0-959), taken from the table of guide 05 section 4:
 *   S00 0-239    micro push, all in focus, f/8 (the last second pulls to the S01 lens, so the focus does not jump at the cut)
 *   S01 240-479  the walk: M to 2.46 toward the lamp side, focus 260 to 120, f/4; the camera arrives at 480 and holds one beat
 *   S02 480-839  the lean in: M 2.46 to 4.49, focus 120 to 38, f/2.8; the move starts at 510 (the first beat is still)
 *   S03 840-959  the pile hold: a 3% push and a 1.5 cm slide, focus 36, f/2.8; it carries on from the end of S02's glide
 * S04 (Patch 14) adds one key on frame 1080, in `src/shots/S04.tsx`, from `VIEW_LIFT`; from frame 1080 the camera holds its last state until Patch 15 adds S05 onward.
 *
 * Two numbers differ from the guide's table, both found with `npm run motion`: the S00 push is 3% (M 1.2875 at frame 240; the table says
 * 2.5%, M 1.28), because with 2.5% the walking bob lands on the margin rule just as the window opens and the sideways speed reaches 48 cm/s
 * (limit 40); and S02 ends in S03's push instead of coming to rest at frame 810, which removes a 66 frame stop at the pile.
 *
 * ONE deliberate exception, STILL at frames 0-65: the film opens from rest. The ease-in of a hold is at least 60 frames (a multiple of
 * 30, so its key is on a beat) and R1 can only change M, so the picture moves less than 0.5% for the first 66 frames. See docs/PATCH_NOTES.md.
 */
export const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [...SHOT_KEYFRAMES.S00, ...SHOT_KEYFRAMES.S01, ...SHOT_KEYFRAMES.S02, ...SHOT_KEYFRAMES.S03];
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
