// How the flat photo follows the camera. The scene camera is the MATCH camera of Patch 03 (src/config/plateMatch.json): a pinhole
// camera whose desk plane lies on the plate's desk strip. The photo is a flat card square to its axis, and a `PlateView` is a
// WINDOW of that camera's sensor (a scale and a shift, guide 02, "Plate-follow"). The camera and the card do not move when the
// view changes, so a 3D object standing on the desk stays on the desk at every zoom and pan. The camera rig (`src/camera/path.ts`,
// `src/camera/CameraRig.tsx`, Patch 05) drives `PlateView` and the roll from the keyframes and the operator model.

import plateMatchJson from "../config/plateMatch.json";
import { EDGE_MARGIN, M_FIT_HEIGHT, PLATE_H, PLATE_W } from "../config/plate";
import { HEIGHT, WIDTH } from "../config/timeline";
import { cardTransform, matchCameraRig, parsePlateMatch, photoToOutput, type MatchCameraRig, type MatchParams } from "./plateCamera";

/** Which part of the photo is on screen: magnification M and the photo pixel at the centre of the frame. */
export interface PlateView {
  /** on-screen photo width / 1536 */
  M: number;
  /** photo px at the screen centre */
  cx: number;
  cy: number;
}

/** The opening view: the whole photo, centred; at 16:9 it fills the frame exactly. */
export const VIEW_FIT: PlateView = { M: M_FIT_HEIGHT, cx: PLATE_W / 2, cy: PLATE_H / 2 };

/** The match camera: the numbers of `src/config/plateMatch.json` (see `plateCamera.ts` for what each one means). */
export type PlateMatch = MatchParams;
export const PLATE_MATCH: PlateMatch = parsePlateMatch(plateMatchJson);

export interface PlateTransform {
  /** world cm per photo pixel on the card */
  cmPerPx: number;
  /** world size of the whole photo card, cm */
  width: number;
  height: number;
  /** centre of the card in CAMERA space (the camera at the origin looking down -Z); the card sits in a group that carries the camera's pose */
  position: [number, number, number];
}

/**
 * The card the photo is drawn on. It is square to the camera's axis, `plateDepthCm` behind the desk's front edge, so one photo
 * pixel covers exactly M screen pixels (no perspective distortion). It does NOT depend on the view: the view is a window of the
 * camera (`plateCameraRig`). `view` is accepted so callers written for Patch 02 keep working.
 */
export function plateTransform(_view: PlateView, match: PlateMatch = PLATE_MATCH): PlateTransform {
  return cardTransform(match);
}

/** The three.js camera for a view: fov, aspect, position, pitch, roll and the view offset (see `matchCameraRig`). */
export function plateCameraRig(view: PlateView, match: PlateMatch = PLATE_MATCH, rollDeg = 0): MatchCameraRig {
  return matchCameraRig(match, view, rollDeg);
}

/** Where a photo pixel lands on screen (output px, origin top-left) for a view. `rollDeg` turns the picture clockwise about the frame's centre. */
export function photoToScreen(view: PlateView, x: number, y: number, rollDeg = 0): { x: number; y: number } {
  if (rollDeg === 0) return { x: WIDTH / 2 + (x - view.cx) * view.M, y: HEIGHT / 2 + (y - view.cy) * view.M };
  return photoToOutput(view, x, y, rollDeg);
}

/** Which photo pixel is at a screen position. */
export function screenToPhoto(view: PlateView, sx: number, sy: number): { x: number; y: number } {
  return { x: view.cx + (sx - WIDTH / 2) / view.M, y: view.cy + (sy - HEIGHT / 2) / view.M };
}

/** The photo rectangle on screen (it can extend past the frame). */
export function plateScreenRect(view: PlateView): { left: number; top: number; width: number; height: number } {
  const a = photoToScreen(view, 0, 0);
  return { left: a.x, top: a.y, width: PLATE_W * view.M, height: PLATE_H * view.M };
}

export interface ViewCheck {
  /** the view with the margin rule applied */
  view: PlateView;
  /** true if the input had to be moved */
  clamped: boolean;
  /** true if the photo does not reach the left/right edges of the frame (bars visible) */
  pillarbox: boolean;
}

/** Size, in photo px, of the axis-aligned box that holds the (rolled) frame when it is laid on the photo. With no roll it is the frame's own size / M. */
export function windowBox(M: number, rollDeg = 0): { w: number; h: number } {
  const th = (rollDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  return { w: (WIDTH * c + HEIGHT * s) / M, h: (WIDTH * s + HEIGHT * c) / M };
}

/**
 * Applies the camera's margin rule: while the photo is larger than the frame, the window keeps EDGE_MARGIN photo px from the
 * photo's edge. A view that shows the whole photo (or more) is left alone, only centred. With a roll the window is the rolled
 * frame's bounding box, so the corners of a rolled picture keep the margin too.
 */
export function clampView(v: PlateView, rollDeg = 0): ViewCheck {
  const { w: visW, h: visH } = windowBox(v.M, rollDeg);
  let { cx, cy } = v;
  if (visW <= PLATE_W - 2 * EDGE_MARGIN) cx = Math.min(Math.max(cx, EDGE_MARGIN + visW / 2), PLATE_W - EDGE_MARGIN - visW / 2);
  else cx = PLATE_W / 2;
  if (visH <= PLATE_H - 2 * EDGE_MARGIN) cy = Math.min(Math.max(cy, EDGE_MARGIN + visH / 2), PLATE_H - EDGE_MARGIN - visH / 2);
  else cy = PLATE_H / 2;
  const pillarbox = PLATE_W * v.M < WIDTH - 1e-6;
  return { view: { M: v.M, cx, cy }, clamped: Math.abs(cx - v.cx) > 1e-9 || Math.abs(cy - v.cy) > 1e-9, pillarbox };
}
