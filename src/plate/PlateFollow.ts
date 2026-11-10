// How the flat photo follows the camera. In this first version the camera is fixed and only the photo moves: the whole story of
// a "dolly" or a "slide" is a scale and a shift of one flat card (guide 02, "Plate-follow"). Patch 03 replaces the placeholder
// match with the calibrated one; Patch 05 drives `PlateView` from the camera rig.

import { EDGE_MARGIN, M_FIT_HEIGHT, PLATE_H, PLATE_W } from "../config/plate";
import { HEIGHT, WIDTH } from "../config/timeline";

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

/** The 3D scene camera the plate is placed in front of (placeholder until Patch 03). */
export interface PlateMatch {
  /** vertical field of view of the scene camera, degrees */
  fovDeg: number;
  /** distance from the camera to the photo plane, cm */
  plateDistanceCm: number;
}
export const PLACEHOLDER_MATCH: PlateMatch = { fovDeg: 25, plateDistanceCm: 600 };

export interface PlateTransform {
  /** world cm per photo pixel */
  cmPerPx: number;
  /** world size of the whole photo plane, cm */
  width: number;
  height: number;
  /** world position of the plane centre; the camera is at the origin looking down -Z */
  position: [number, number, number];
}

/**
 * The plane the photo is drawn on, for a view. The plane faces the camera exactly, so one photo pixel covers exactly M screen
 * pixels (no perspective distortion) and a view maps to a pure scale and shift.
 */
export function plateTransform(view: PlateView, match: PlateMatch = PLACEHOLDER_MATCH): PlateTransform {
  const visibleH = 2 * match.plateDistanceCm * Math.tan((match.fovDeg * Math.PI) / 360); // cm seen by the camera at the plate
  const cmPerScreenPx = visibleH / HEIGHT;
  const cmPerPx = cmPerScreenPx * view.M;
  return {
    cmPerPx,
    width: PLATE_W * cmPerPx,
    height: PLATE_H * cmPerPx,
    position: [(PLATE_W / 2 - view.cx) * cmPerPx, (view.cy - PLATE_H / 2) * cmPerPx, -match.plateDistanceCm],
  };
}

/** Where a photo pixel lands on screen (output px, origin top-left) for a view. */
export function photoToScreen(view: PlateView, x: number, y: number): { x: number; y: number } {
  return { x: WIDTH / 2 + (x - view.cx) * view.M, y: HEIGHT / 2 + (y - view.cy) * view.M };
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

/**
 * Applies the camera's margin rule: while the photo is larger than the frame, the window keeps EDGE_MARGIN photo px from the
 * photo's edge. A view that shows the whole photo (or more) is left alone, only centred.
 */
export function clampView(v: PlateView): ViewCheck {
  const visW = WIDTH / v.M;
  const visH = HEIGHT / v.M;
  let { cx, cy } = v;
  if (visW <= PLATE_W - 2 * EDGE_MARGIN) cx = Math.min(Math.max(cx, EDGE_MARGIN + visW / 2), PLATE_W - EDGE_MARGIN - visW / 2);
  else cx = PLATE_W / 2;
  if (visH <= PLATE_H - 2 * EDGE_MARGIN) cy = Math.min(Math.max(cy, EDGE_MARGIN + visH / 2), PLATE_H - EDGE_MARGIN - visH / 2);
  else cy = PLATE_H / 2;
  const pillarbox = PLATE_W * v.M < WIDTH - 1e-6;
  return { view: { M: v.M, cx, cy }, clamped: Math.abs(cx - v.cx) > 1e-9 || Math.abs(cy - v.cy) > 1e-9, pillarbox };
}
