// THE CAMERA PATH (Patch 05): the authored keyframes of src/config/camera.ts, the operator model of ./operator.ts on top, the margin rule
// of src/plate/PlateFollow.ts, and the lens of ./focus.ts, as ONE pure function of the frame. `cameraAt(frame)` is what the film draws
// (CameraRig.tsx), what the dev sheet prints (DevCamera.tsx) and what the audit measures (audit.ts). No React, no three.js.
//
// How a frame is made:
//   1. AUTHORED. Find the two keyframes around the frame; the progress between them goes through the ease of the first one. M moves in
//      1 / M (what a dolly does: a straight line in 1 / M is a constant-speed move toward the plate), everything else linearly.
//      After the last keyframe the camera holds its last state.
//   2. OPERATOR. `operatorAt` adds breathing, the walk, tremor, the lean-in and the reach (cm and degrees of a camera body). They become
//      a shift of the window (cm x plate px per cm at the plate), a change of M (a dolly toward the plate) and a tilt.
//   3. MARGIN RULE. `clampView` keeps the window 40 px inside the photo. Below M = 1.319 the view is centred, so the operator cannot
//      move the opening shot at all: frame 0 is still the bare plate.
// A TILT of the camera is a shift of the window by focalPx x tan(tilt) photo px (the photo is flat; guide 05, section 1).

import { FOCUS_PILE_GUIDE_CM, mixState, type CameraKeyframe } from "../config/camera";
import { ZONES } from "../config/placement";
import { shotAt, type Regime } from "../config/timeline";
import { FILM_CAMERA_KEYFRAMES } from "../shots";
import { EASES } from "../lib/ease";
import { PLATE_MATCH, clampView, type PlateMatch, type PlateView } from "../plate/PlateFollow";
import { focalPx, pxPerCm } from "../plate/plateCamera";
import { plateDistanceCm, type Lens } from "./focus";
import { NO_OFFSET, operatorAt, type OperatorOffset } from "./operator";

const rad = (d: number): number => (d * Math.PI) / 180;

/** The camera's authored numbers at one frame: a keyframe without its frame, ease and regime. */
export type CameraState = Omit<CameraKeyframe, "frame" | "ease" | "regime">;

/** Everything about the camera at one frame. */
export interface CameraFrame {
  frame: number;
  /** regime of the authored segment this frame is in */
  regime: Regime;
  /** the authored numbers (keyframes only, no operator) */
  authored: CameraState;
  /** the authored view: M and the photo pixel at the centre of the frame, the tilt included; NOT passed through the margin rule */
  authoredView: PlateView;
  /** what the operator adds (all zero when the operator is off) */
  operator: OperatorOffset;
  /** the view that is drawn: authored + operator, after the margin rule */
  view: PlateView;
  /** true when the margin rule had to move the view */
  clamped: boolean;
  /** roll of the picture, degrees clockwise (authored; the operator does not roll) */
  rollDeg: number;
  /** the lens of src/camera/focus.ts (focus in real cm: the guide's column is rescaled, D-33) */
  lens: Lens;
  /** where the camera body is, photo px: the centre of the drawn view with the tilt taken out. Its change from frame to frame is the sideways speed. */
  slidePx: { x: number; y: number };
}

export interface CameraOptions {
  /** the keyframes to follow; default is the camera of the film, the keyframes of every shot file joined in order (`FILM_CAMERA_KEYFRAMES`, src/shots) */
  keys?: readonly CameraKeyframe[];
  match?: PlateMatch;
  /** add the operator model (default true); the audit turns it off to look at the authored path alone */
  operator?: boolean;
}

/** A tilt of the camera as a shift of the window, photo px (positive looks down, so the window moves down the photo). */
export function turnShiftPx(tiltDeg: number, match: PlateMatch = PLATE_MATCH): number {
  return focalPx(match) * Math.tan(rad(tiltDeg));
}

/**
 * The lens of a keyframe's focus / aperture / focal length. The guide's focus column is in the cm of a viewer who walks to the desk;
 * the match camera never moves, so the numbers are rescaled: the guide's 36 is the pile (`FOCUS_PILE_GUIDE_CM`), at `camDist + Zd` from
 * the camera, and every other value keeps its ratio to it (260 is far, 38 is just behind the pile). Decision D-33.
 */
export function lensOf(guideFocusCm: number, aperture: number, focalMm: number, match: PlateMatch = PLATE_MATCH): Lens {
  const pile = match.camDistCm + ZONES.L.anchor.Zd;
  return { focusCm: (guideFocusCm / FOCUS_PILE_GUIDE_CM) * pile, focalMm, fNumber: aperture };
}

const stateOf = (k: CameraKeyframe): CameraState => ({ M: k.M, panX: k.panX, panY: k.panY, tiltDeg: k.tiltDeg, rollDeg: k.rollDeg, focusCm: k.focusCm, aperture: k.aperture, focalMm: k.focalMm });

/** The authored state at a frame, and the regime of the segment it is in. Pure. */
export function authoredAt(frame: number, keys: readonly CameraKeyframe[] = FILM_CAMERA_KEYFRAMES): { state: CameraState; regime: Regime } {
  const last = keys[keys.length - 1];
  // after the last keyframe the camera holds; the shot table says which regime the frame is in (the last keyframe's own regime is ignored)
  if (frame >= last.frame) return { state: stateOf(last), regime: shotAt(frame).regime };
  if (frame <= keys[0].frame) return { state: stateOf(keys[0]), regime: keys[0].regime };
  let lo = 0;
  let hi = keys.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].frame <= frame) lo = mid;
    else hi = mid;
  }
  const a = keys[lo];
  const b = keys[hi];
  const t = (frame - a.frame) / (b.frame - a.frame);
  const p = EASES[a.ease](t);
  if (p <= 0) return { state: stateOf(a), regime: a.regime };
  return { state: mixState(stateOf(a), stateOf(b), p), regime: a.regime };
}

/** The camera at a frame. A pure function of the frame and of the data passed in. */
export function cameraAt(frame: number, o: CameraOptions = {}): CameraFrame {
  const keys = o.keys ?? FILM_CAMERA_KEYFRAMES;
  const match = o.match ?? PLATE_MATCH;
  const { state, regime } = authoredAt(frame, keys);
  const authoredView: PlateView = { M: state.M, cx: state.panX, cy: state.panY + turnShiftPx(state.tiltDeg, match) };
  const operator = o.operator === false ? NO_OFFSET : operatorAt(frame, regime);

  // the operator's cm and degrees, as the flat photo sees them
  const ppc = pxPerCm(match, match.plateDepthCm);
  const D = plateDistanceCm(match);
  const drawn: PlateView = {
    M: authoredView.M * (D / (D - operator.forwardCm)),
    cx: authoredView.cx + operator.rightCm * ppc,
    cy: authoredView.cy - operator.upCm * ppc + turnShiftPx(operator.tiltDownDeg, match),
  };
  const chk = clampView(drawn, state.rollDeg);
  const tilt = turnShiftPx(state.tiltDeg + operator.tiltDownDeg, match);
  return {
    frame,
    regime,
    authored: state,
    authoredView,
    operator,
    view: chk.view,
    clamped: chk.clamped,
    rollDeg: state.rollDeg,
    lens: lensOf(state.focusCm, state.aperture, state.focalMm, match),
    slidePx: { x: chk.view.cx, y: chk.view.cy - tilt },
  };
}
