// REFERENCE IMPLEMENTATION for Patch 03 (the match lab). Self-contained and tested (tests/calibration-seed.test.ts).
// Not used by the film yet: Patch 03 decides how the match camera enters src/ (it may lift this file to src/plate/ whole).
//
// It answers two questions with the fitted camera of calibration-seed.json:
//   1. projectDesk(): where does a desk point land on the 1536 x 864 plate?
//   2. threeCameraParams(): how must a three.js PerspectiveCamera be set (fov, aspect, setViewOffset) so that 3D objects sit on
//      the desk at ANY zoom/pan of a 16:9 window onto the photo? Verified against three.js itself to 0.01 output px.

export const PLATE_REF = { w: 1536, h: 864 } as const;
export const OUTPUT = { w: 1920, h: 1080 } as const;

export interface Calib {
  f: number;
  cx: number;
  horizonY: number;
  camHeightCm: number;
  camDistCm: number;
  desk: { xMin: number; xMax: number; depth: number };
}

export const CALIB_SEED: Calib = {
  f: 1895,
  cx: 544.7,
  horizonY: 395.6,
  camHeightCm: 45.6,
  camDistCm: 508,
  desk: { xMin: -88.6, xMax: 144.4, depth: 65 },
};

export interface PlateWindow {
  /** centre of the 16:9 window on the photo, photo px */
  cx: number;
  cy: number;
  /** output px per photo px (this is the film's magnification M) */
  zoom: number;
}

/** px per cm at depth Zd */
export const pxPerCm = (c: Calib, Zd: number): number => c.f / (c.camDistCm + Zd);

/** A desk point (X cm, Y cm above the desk top, Zd cm from the front edge) -> photo px. */
export function projectDesk(c: Calib, X: number, Y: number, Zd: number): { x: number; y: number } {
  const z = c.camDistCm + Zd;
  return { x: c.cx + (c.f * X) / z, y: c.horizonY + (c.f * (c.camHeightCm - Y)) / z };
}

/** A photo px that lies ON the desk top -> desk coordinates. Only valid below the horizon. */
export function unprojectToDesk(c: Calib, px: number, py: number): { X: number; Zd: number } {
  const dy = py - c.horizonY;
  if (dy <= 0) throw new Error(`y=${py} is at or above the horizon (${c.horizonY})`);
  const z = (c.f * c.camHeightCm) / dy;
  return { X: ((px - c.cx) * z) / c.f, Zd: z - c.camDistCm };
}

/** The photo rectangle a window shows. */
export function windowRect(win: PlateWindow): { x0: number; y0: number; w: number; h: number } {
  const w = OUTPUT.w / win.zoom;
  const h = OUTPUT.h / win.zoom;
  return { x0: win.cx - w / 2, y0: win.cy - h / 2, w, h };
}

/** Photo px -> output px for a window. */
export function photoToScreen(win: PlateWindow, x: number, y: number): { x: number; y: number } {
  const r = windowRect(win);
  return { x: (x - r.x0) * win.zoom, y: (y - r.y0) * win.zoom };
}

export interface ThreeCameraParams {
  fovDeg: number;
  aspect: number;
  /** world cm; the desk top is y = 0 and desk depth runs along -z (see deskToWorld) */
  position: [number, number, number];
  view: { fullW: number; fullH: number; x: number; y: number; w: number; h: number };
}

/**
 * The calibrated camera as a three.js PerspectiveCamera windowed to `win`: a sensor centred on the principal point that contains the
 * whole photo, and setViewOffset for the window. Use: camera.fov = fovDeg; camera.aspect = aspect; camera.position.set(...position);
 * camera.setViewOffset(fullW, fullH, x, y, w, h); camera.updateProjectionMatrix().
 */
export function threeCameraParams(c: Calib, win: PlateWindow): ThreeCameraParams {
  const sensorW = 2 * Math.max(c.cx, PLATE_REF.w - c.cx);
  const sensorH = 2 * Math.max(c.horizonY, PLATE_REF.h - c.horizonY);
  const dx = sensorW / 2 - c.cx;
  const dy = sensorH / 2 - c.horizonY;
  const r = windowRect(win);
  return {
    fovDeg: (2 * Math.atan(sensorH / 2 / c.f) * 180) / Math.PI,
    aspect: sensorW / sensorH,
    position: [0, c.camHeightCm, 0],
    view: { fullW: sensorW, fullH: sensorH, x: r.x0 + dx, y: r.y0 + dy, w: r.w, h: r.h },
  };
}

/** Desk coordinates -> three.js world position (cm). Camera at (0, camHeightCm, 0) looking down -Z. */
export function deskToWorld(c: Calib, X: number, Y: number, Zd: number): [number, number, number] {
  return [X, Y, -(c.camDistCm + Zd)];
}
