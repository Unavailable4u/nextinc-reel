// THE MATCH CAMERA (Patch 03). A pinhole camera whose desk plane (y = 0) lands on the desk strip of the plate.
// Pure functions, no three.js import, so plain Node (tests, scripts) can use it. `tests/plate-match.test.ts` proves that a
// three.js PerspectiveCamera set from `matchCameraRig` projects exactly like `projectDesk`, at any zoom and pan.
//
// WORLD (guide 02): 1 unit = 1 cm. Y up; the desk top is y = 0. The ORIGIN is the front edge of the desk top at the centre of
// the pile zone. X runs left to right as seen from the camera. The desk runs away from the camera along -Z, so a desk point
// is written (X, Y, Zd) with Zd = distance from the front edge towards the wall, and its world position is (X, Y, -Zd). The
// camera stands at (camXCm, camHeightCm, camDistCm) and looks towards -Z, pitched DOWN by pitchDeg.
//
// PHOTO: pixels of the 1536 x 864 plate, origin top-left. The camera has a vertical field of view `fovDeg` over the plate's
// 864 px, so f = 432 / tan(fov / 2) px. The HORIZON (where the desk's side edges converge) is at `horizonY`; the principal
// point is at (principalX, horizonY + f tan(pitch)). With pitch 0 that is a pure lens shift, which keeps the plate's vertical
// lines vertical (measured-calibration.md, section 3).

import { PLATE_H, PLATE_W } from "../config/plate";
import { HEIGHT, WIDTH } from "../config/timeline";

export interface MatchParams {
  /** the camera's X in the world, cm (the pile centre is X = 0, so the camera is to the right of it) */
  camXCm: number;
  camHeightCm: number;
  /** distance from the camera to the desk's FRONT edge, cm */
  camDistCm: number;
  /** vertical field of view over the plate's 864 px, degrees */
  fovDeg: number;
  /** pitch down, degrees (0 = level; the lens shift does the rest) */
  pitchDeg: number;
  /** where the horizon lands in the plate, photo px */
  horizonY: number;
  /** where the camera's centre line (the vanishing point of the desk's depth lines) lands, photo px */
  principalX: number;
  deskXMinCm: number;
  deskXMaxCm: number;
  deskDepthCm: number;
  /** the plate card stands this far behind the desk's front edge (the desk's middle by default) */
  plateDepthCm: number;
}

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** focal length in plate px */
export const focalPx = (p: MatchParams): number => PLATE_H / 2 / Math.tan(rad(p.fovDeg) / 2);
/** the principal point's y in the plate, photo px */
export const principalY = (p: MatchParams): number => p.horizonY + focalPx(p) * Math.tan(rad(p.pitchDeg));
/** horizontal field of view over the plate's 1536 px, degrees */
export const hfovDeg = (p: MatchParams): number => deg(2 * Math.atan(PLATE_W / 2 / focalPx(p)));
/** plate px per cm on the desk plane at depth Zd (level camera; exact for pitch 0) */
export const pxPerCm = (p: MatchParams, Zd: number): number => focalPx(p) / (p.camDistCm + Zd);

/** camera axes in the world: right, up and forward (the camera looks down by pitchDeg) */
function axes(p: MatchParams): { R: [number, number, number]; U: [number, number, number]; F: [number, number, number] } {
  const s = Math.sin(rad(p.pitchDeg));
  const c = Math.cos(rad(p.pitchDeg));
  return { R: [1, 0, 0], U: [0, c, -s], F: [0, -s, -c] };
}
const dot = (a: readonly number[], b: readonly number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** A desk point (X, Y above the desk, Zd from the front edge) to plate px. `depth` is the distance along the optical axis. */
export function projectDesk(p: MatchParams, X: number, Y: number, Zd: number): { x: number; y: number; depth: number } {
  const { R, U, F } = axes(p);
  const d = [X - p.camXCm, Y - p.camHeightCm, -Zd - p.camDistCm];
  const depth = dot(d, F);
  const f = focalPx(p);
  return { x: p.principalX + (f * dot(d, R)) / depth, y: principalY(p) - (f * dot(d, U)) / depth, depth };
}

/** A plate pixel that lies ON the desk top, as desk coordinates. Null above the horizon. */
export function unprojectToDesk(p: MatchParams, px: number, py: number): { X: number; Zd: number } | null {
  const { R, U, F } = axes(p);
  const f = focalPx(p);
  const a = (px - p.principalX) / f;
  const b = -(py - principalY(p)) / f;
  const dir = [R[0] * a + U[0] * b + F[0], R[1] * a + U[1] * b + F[1], R[2] * a + U[2] * b + F[2]];
  if (dir[1] >= -1e-12) return null;
  const t = -p.camHeightCm / dir[1];
  return { X: p.camXCm + t * dir[0], Zd: -(p.camDistCm + t * dir[2]) };
}

/** The four corners of a desk-plane rectangle in plate px, in the order (x0,zd0) (x1,zd0) (x1,zd1) (x0,zd1). */
export function deskRectPx(p: MatchParams, x0: number, x1: number, zd0: number, zd1: number, Y = 0): { x: number; y: number }[] {
  return [
    [x0, zd0],
    [x1, zd0],
    [x1, zd1],
    [x0, zd1],
  ].map(([X, Zd]) => projectDesk(p, X, Y, Zd));
}

/** The desk top's two long edges in plate px: y, and x of the left and right corners. */
export function deskEdgesPx(p: MatchParams): { front: EdgePx; back: EdgePx } {
  const edge = (Zd: number): EdgePx => {
    const l = projectDesk(p, p.deskXMinCm, 0, Zd);
    const r = projectDesk(p, p.deskXMaxCm, 0, Zd);
    return { y: l.y, xLeft: l.x, xRight: r.x };
  };
  return { front: edge(0), back: edge(p.deskDepthCm) };
}
export interface EdgePx {
  y: number;
  xLeft: number;
  xRight: number;
}

/** What was read off the plate by hand (measured-calibration.md, section 1). The only measured numbers; the rest is chosen. */
export const MEASURED_DESK = {
  front: { y: 565.7, xLeft: 214.3, xRight: 1084 },
  back: { y: 546.4, xLeft: 251.8, xRight: 1022.8 },
  /** where the desk's side edges converge */
  horizonFromDeskEdges: 395.6,
  /** where the ceiling and baseboard lines converge (decision D-25) */
  horizonFromRoomLines: 464,
} as const;

/** The horizon slider's range (D-25). */
export const HORIZON_RANGE = { min: 380, max: 470 } as const;

/**
 * The camera that makes the desk edges land where they were measured, for a chosen horizon. Level camera (pitch 0). Three
 * numbers are CHOSEN, not measured: the desk's real width and depth in cm (the scale, a design assumption), and the horizon.
 *   distance = depth * (backY - h) / (frontY - backY)       height = (frontY - h) * distance / f
 *   f = (front edge width in px) * distance / (desk width in cm)
 * Use it to slide the horizon without losing the desk match.
 */
export function solveFromDeskEdges(o: { horizonY: number; principalX: number; deskWidthCm: number; deskDepthCm: number; camXCm: number; plateDepthCm?: number }): MatchParams {
  const m = MEASURED_DESK;
  if (o.horizonY >= m.back.y - 1) throw new Error(`the horizon (y ${o.horizonY}) must be above the desk's back edge (y ${m.back.y})`);
  const camDistCm = (o.deskDepthCm * (m.back.y - o.horizonY)) / (m.front.y - m.back.y);
  const frontW = m.front.xRight - m.front.xLeft;
  const f = (frontW * camDistCm) / o.deskWidthCm;
  const camHeightCm = ((m.front.y - o.horizonY) * camDistCm) / f;
  const xMinCm = ((m.front.xLeft - o.principalX) * camDistCm) / f + o.camXCm;
  return {
    camXCm: o.camXCm,
    camHeightCm,
    camDistCm,
    fovDeg: deg(2 * Math.atan(PLATE_H / 2 / f)),
    pitchDeg: 0,
    horizonY: o.horizonY,
    principalX: o.principalX,
    deskXMinCm: xMinCm,
    deskXMaxCm: xMinCm + o.deskWidthCm,
    deskDepthCm: o.deskDepthCm,
    plateDepthCm: o.plateDepthCm ?? o.deskDepthCm / 2,
  };
}

// ---------- the three.js rig ----------

export interface PlateWindowView {
  /** on-screen photo width / 1536 */
  M: number;
  /** photo px at the screen centre */
  cx: number;
  cy: number;
}

export interface MatchCameraRig {
  /** vertical field of view of the FULL sensor (the one that holds the whole plate), degrees */
  fovDeg: number;
  /** full sensor width / height */
  aspect: number;
  /** world position, cm */
  position: [number, number, number];
  /** rotation about X, radians (negative = looking down) */
  rotationX: number;
  /** for camera.setViewOffset(fullW, fullH, x, y, w, h): the window of the sensor that fills the 1920 x 1080 frame */
  viewOffset: { fullW: number; fullH: number; x: number; y: number; w: number; h: number };
}

/**
 * The calibrated camera as a three.js PerspectiveCamera: a sensor centred on the principal point that holds the whole plate,
 * and a view offset that cuts the window `view` out of it. The scene camera never moves when the view changes, so a 3D object
 * standing on the desk stays on the desk at every zoom and pan (the plate and the objects share one camera).
 */
export function matchCameraRig(p: MatchParams, view: PlateWindowView): MatchCameraRig {
  const f = focalPx(p);
  const cx = p.principalX;
  const cy = principalY(p);
  const sensorW = 2 * Math.max(cx, PLATE_W - cx);
  const sensorH = 2 * Math.max(cy, PLATE_H - cy);
  const w = WIDTH / view.M;
  const h = HEIGHT / view.M;
  return {
    fovDeg: deg(2 * Math.atan(sensorH / 2 / f)),
    aspect: sensorW / sensorH,
    position: [p.camXCm, p.camHeightCm, p.camDistCm],
    rotationX: -rad(p.pitchDeg),
    viewOffset: { fullW: sensorW, fullH: sensorH, x: view.cx - w / 2 + (sensorW / 2 - cx), y: view.cy - h / 2 + (sensorH / 2 - cy), w, h },
  };
}

export interface CardTransform {
  /** cm on the card per plate px */
  cmPerPx: number;
  width: number;
  height: number;
  /** centre of the card in CAMERA space (camera at the origin looking down -Z) */
  position: [number, number, number];
}

/**
 * The plate as a flat card in front of the camera, square to the optical axis, `plateDepthCm` behind the desk's front edge
 * (the desk's middle). It does not depend on the view: the view is a window onto the camera's sensor.
 */
export function cardTransform(p: MatchParams): CardTransform {
  const f = focalPx(p);
  const D = p.camDistCm + p.plateDepthCm;
  const cmPerPx = D / f;
  return {
    cmPerPx,
    width: PLATE_W * cmPerPx,
    height: PLATE_H * cmPerPx,
    position: [(PLATE_W / 2 - p.principalX) * cmPerPx, (principalY(p) - PLATE_H / 2) * cmPerPx, -D],
  };
}

/** Plate px to output px for a view (the same mapping as PlateFollow.photoToScreen, repeated here so this file stands alone). */
export const photoToOutput = (v: PlateWindowView, x: number, y: number): { x: number; y: number } => ({ x: WIDTH / 2 + (x - v.cx) * v.M, y: HEIGHT / 2 + (y - v.cy) * v.M });

// ---------- landmarks read off the plate ----------

/**
 * The desk lamp, read off the plate by eye (about +-3 px): where its base touches the desk, and the height of the bulb's glow.
 * The lamp's place in the world follows from the match, so it is computed again whenever the match changes (Patch 04 puts the key light there).
 */
export const LAMP_PX = { baseBottom: { x: 309.5, y: 548 }, bulbY: 507 } as const;

/** Where the lamp bulb is in desk coordinates for this match: X and Zd from the base, Y from the height of the glow above it. */
export function lampBulb(p: MatchParams): { X: number; Y: number; Zd: number } {
  const base = unprojectToDesk(p, LAMP_PX.baseBottom.x, LAMP_PX.baseBottom.y);
  if (!base) throw new Error("the lamp base is above the horizon of this match");
  const f = focalPx(p);
  const s = Math.sin(rad(p.pitchDeg));
  const c = Math.cos(rad(p.pitchDeg));
  const v = LAMP_PX.bulbY - principalY(p);
  const dz = -base.Zd - p.camDistCm;
  const dy = (dz * (v * c - f * s)) / (f * c - v * s);
  return { X: base.X, Y: p.camHeightCm + dy, Zd: base.Zd };
}

// ---------- the JSON the lab prints ----------

/** The file `src/config/plateMatch.json`. `camera` and `desk` are the source of truth; the rest is derived and is checked against them by a test. */
export interface PlateMatchJson {
  version: 1;
  /** "seed" = the starting values of Patch 03, "chosen" = the person pasted the lab's output after looking */
  status: "seed" | "chosen";
  units: string;
  origin: string;
  camera: { xCm: number; heightCm: number; distanceCm: number; fovDeg: number; pitchDeg: number; horizonY: number; principalX: number };
  desk: { xMinCm: number; xMaxCm: number; depthCm: number };
  plate: { depthFromFrontEdgeCm: number; distanceFromCameraCm: number; widthCm: number; heightCm: number };
  scale: { pxPerCmAtFront: number; deskWidthCm: number; basis: string };
  derived: {
    focalPx: number;
    principalY: number;
    hfovDeg: number;
    deskEdgesPx: { front: EdgePx; back: EdgePx };
  };
  horizon: { chosenY: number; deskEdgesY: number; roomLinesY: number; choice: string };
  landmarks: { lampBulb: { X: number; Y: number; Zd: number; photoBaseBottom: { x: number; y: number }; photoBulbY: number; note: string } };
}

const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

export const MATCH_UNITS = "cm in the world, photo px (1536 x 864) in the image";
export const MATCH_ORIGIN = "front edge of the desk top, at the centre of the pile zone; X to the right, Y up from the desk top, Zd from the front edge towards the wall; world z = -Zd; the camera looks down -z";
export const SCALE_BASIS = "design assumption: the desk is taken as deskWidthCm wide, which sets the px per cm; the plate has no known real size";

export const LAMP_NOTE = "estimated by eye from the plate (about +-3 px); X and Zd from the base, Y from the glow; follows the match";

/** Everything the lab prints, rounded for reading. */
export function buildMatchJson(p: MatchParams, opts: { status: "seed" | "chosen"; horizonChoice: string }): PlateMatchJson {
  const f = focalPx(p);
  const lamp = lampBulb(p);
  const card = cardTransform(p);
  const e = deskEdgesPx(p);
  const round = (g: EdgePx): EdgePx => ({ y: r2(g.y), xLeft: r2(g.xLeft), xRight: r2(g.xRight) });
  return {
    version: 1,
    status: opts.status,
    units: MATCH_UNITS,
    origin: MATCH_ORIGIN,
    camera: { xCm: r2(p.camXCm), heightCm: r2(p.camHeightCm), distanceCm: r2(p.camDistCm), fovDeg: r3(p.fovDeg), pitchDeg: r3(p.pitchDeg), horizonY: r2(p.horizonY), principalX: r2(p.principalX) },
    desk: { xMinCm: r2(p.deskXMinCm), xMaxCm: r2(p.deskXMaxCm), depthCm: r2(p.deskDepthCm) },
    plate: { depthFromFrontEdgeCm: r2(p.plateDepthCm), distanceFromCameraCm: r2(p.camDistCm + p.plateDepthCm), widthCm: r2(card.width), heightCm: r2(card.height) },
    scale: { pxPerCmAtFront: r3(f / p.camDistCm), deskWidthCm: r2(p.deskXMaxCm - p.deskXMinCm), basis: SCALE_BASIS },
    derived: { focalPx: r2(f), principalY: r2(principalY(p)), hfovDeg: r3(hfovDeg(p)), deskEdgesPx: { front: round(e.front), back: round(e.back) } },
    horizon: { chosenY: r2(p.horizonY), deskEdgesY: MEASURED_DESK.horizonFromDeskEdges, roomLinesY: MEASURED_DESK.horizonFromRoomLines, choice: opts.horizonChoice },
    landmarks: { lampBulb: { X: r2(lamp.X), Y: r2(lamp.Y), Zd: r2(lamp.Zd), photoBaseBottom: { ...LAMP_PX.baseBottom }, photoBulbY: LAMP_PX.bulbY, note: LAMP_NOTE } },
  };
}

/** Compact, readable JSON: an object whose values are all plain numbers or short strings goes on one line. Still valid JSON. */
function fmtJson(v: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  const entries = Object.entries(v as Record<string, unknown>);
  const flat = entries.every(([, x]) => x === null || typeof x !== "object");
  const one = JSON.stringify(v);
  if (flat && one.length <= 110) return one.replace(/","/g, '", "').replace(/,"/g, ', "');
  return "{\n" + entries.map(([k, x]) => `${pad}  ${JSON.stringify(k)}: ${fmtJson(x, indent + 1)}`).join(",\n") + `\n${pad}}`;
}

/** The text the lab prints and you paste into plateMatch.json: readable, valid JSON, ending with a newline. */
export const formatMatchJson = (j: PlateMatchJson): string => fmtJson(j, 0) + "\n";

/** The reverse of `buildMatchJson`: the parameters, from the file. Errors name the missing path, like the data selectors do. */
export function parsePlateMatch(j: unknown): MatchParams {
  const num = (path: string): number => {
    let v: unknown = j;
    for (const k of path.split(".")) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`missing data: plateMatch.${path}`);
    return v;
  };
  return {
    camXCm: num("camera.xCm"),
    camHeightCm: num("camera.heightCm"),
    camDistCm: num("camera.distanceCm"),
    fovDeg: num("camera.fovDeg"),
    pitchDeg: num("camera.pitchDeg"),
    horizonY: num("camera.horizonY"),
    principalX: num("camera.principalX"),
    deskXMinCm: num("desk.xMinCm"),
    deskXMaxCm: num("desk.xMaxCm"),
    deskDepthCm: num("desk.depthCm"),
    plateDepthCm: num("plate.depthFromFrontEdgeCm"),
  };
}
