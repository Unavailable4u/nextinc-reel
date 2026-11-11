// The placeholder scenes (boxes with the right footprints) shared by `DevLighting` and by the benchmark (`npm run bench`).
// No React and no three.js, so Node (the bench script, the tests) can read it. Real books come in Patch 06; a box costs about what
// a book costs for lights and shadows, and the boxes of S10 and S11 stand in for the many thin pages with many thin boxes.
import { FOOTPRINTS, ZONES } from "../config/placement";
import { PLATE_MATCH, VIEW_FIT, type PlateView } from "../plate/PlateFollow";
import { defaultLens, matchFocalMm, plateDistanceCm, type Lens } from "../camera/focus";

export interface PlaceholderBox {
  X: number;
  Zd: number;
  /** height of the box's bottom above the desk, cm */
  lift: number;
  w: number;
  d: number;
  h: number;
  yawDeg: number;
  /** flat colour, a hex string; the box is lit like a matt cover */
  color: string;
  /** a glossy (physical) material, so the probe has something to reflect in */
  glossy?: boolean;
}

export type BenchSceneId = "S02" | "S05" | "S10" | "S11" | "S23";

export interface BenchScene {
  id: BenchSceneId;
  name: string;
  view: PlateView;
  /** the lens at the start and at the end of the sample frames of this scene */
  lens0: Lens;
  lens1: Lens;
  boxes: PlaceholderBox[];
}

const COVERS = ["#6E4B36", "#3E5A63", "#7A6A3A", "#5B3F52"] as const;
const BOOK_H = 2.2;
const base = defaultLens(PLATE_MATCH);
const lens = (focusCm: number, fNumber: number): Lens => ({ focusCm, focalMm: matchFocalMm(PLATE_MATCH), fNumber });
const pileFocus = PLATE_MATCH.camDistCm + ZONES.L.anchor.Zd;
const riserFocus = PLATE_MATCH.camDistCm + ZONES.R.anchor.Zd;

/** a pile of `n` books at an anchor, each turned a little, stacked */
function pile(X: number, Zd: number, n: number, yaws: number[], lift = 0, glossy = false): PlaceholderBox[] {
  return Array.from({ length: n }, (_, i) => ({
    X: X + (i % 2 === 0 ? 0.4 : -0.5),
    Zd: Zd + (i % 3 === 0 ? 0.3 : -0.2),
    lift: lift + i * BOOK_H,
    w: FOOTPRINTS.book.w,
    d: FOOTPRINTS.book.d,
    h: BOOK_H,
    yawDeg: yaws[i % yaws.length],
    color: COVERS[i % COVERS.length],
    glossy,
  }));
}

/** thin boxes fanned like pages being riffled */
function fan(X: number, Zd: number, n: number, lift: number): PlaceholderBox[] {
  return Array.from({ length: n }, (_, i) => ({
    X,
    Zd,
    lift: lift + i * 0.12,
    w: FOOTPRINTS.book.w * 0.92,
    d: FOOTPRINTS.book.d * 0.95,
    h: 0.1,
    yawDeg: -14 + (i / Math.max(1, n - 1)) * 28,
    color: "#D9D2C0",
  }));
}

const L = ZONES.L.anchor;
const R = ZONES.R.anchor;

export const SCENES: Record<BenchSceneId, BenchScene> = {
  S02: { id: "S02", name: "Approach B: the pile resolves", view: { M: 4.49, cx: 418, cy: 545 }, lens0: lens(pileFocus, 2.8), lens1: lens(pileFocus, 2.8), boxes: pile(L.X, L.Zd, 3, [0, 5, -4]) },
  S05: { id: "S05", name: "Cover hero: one book lifted, glossy", view: { M: 6.51, cx: 418, cy: 545 }, lens0: lens(pileFocus - 20, 2), lens1: lens(pileFocus - 20, 2), boxes: [...pile(L.X, L.Zd, 2, [0, 5]), ...pile(L.X, L.Zd, 1, [18], 2 * BOOK_H + 6, true)] },
  S10: { id: "S10", name: "Riffle: many thin pages", view: { M: 6.51, cx: 418, cy: 545 }, lens0: lens(pileFocus, 2.8), lens1: lens(pileFocus, 2.8), boxes: [...pile(L.X, L.Zd, 1, [0]), ...fan(L.X, L.Zd, 40, BOOK_H)] },
  S11: {
    id: "S11",
    name: "Gallery spread: an open book",
    view: { M: 6.51, cx: 418, cy: 545 },
    lens0: lens(pileFocus, 2.8),
    lens1: lens(pileFocus, 2.8),
    boxes: [
      { X: L.X - 8, Zd: L.Zd, lift: 0, w: FOOTPRINTS.book.w, d: FOOTPRINTS.book.d, h: 1.2, yawDeg: 6, color: "#D9D2C0" },
      { X: L.X + 8, Zd: L.Zd, lift: 0, w: FOOTPRINTS.book.w, d: FOOTPRINTS.book.d, h: 1.2, yawDeg: -6, color: "#D9D2C0" },
      ...pile(R.X, R.Zd, 3, [0, 4]),
    ],
  },
  S23: {
    id: "S23",
    name: "Riser reveal: the four books",
    view: { M: 3.98, cx: 971, cy: 540 },
    lens0: lens(riserFocus, 2.8),
    lens1: lens(riserFocus, 4),
    boxes: [
      { X: R.X, Zd: R.Zd, lift: 0, w: FOOTPRINTS.riser.w, d: FOOTPRINTS.riser.d, h: 5, yawDeg: 0, color: "#2A2623" },
      ...[-13, -4.5, 4.5, 13].map((dx, i): PlaceholderBox => ({ X: R.X + dx, Zd: R.Zd, lift: 5, w: 8, d: FOOTPRINTS.book.d * 0.7, h: FOOTPRINTS.book.w * 0.7, yawDeg: (i - 1.5) * 3, color: COVERS[i], glossy: i % 2 === 0 })),
    ],
  },
};

/** The 12 sample frames of the benchmark (frame index -> scene and how far along its lens change it is, 0 to 1). */
export const BENCH_FRAMES: { scene: BenchSceneId; t: number }[] = [
  { scene: "S02", t: 0 },
  { scene: "S02", t: 0.5 },
  { scene: "S02", t: 1 },
  { scene: "S05", t: 0 },
  { scene: "S05", t: 1 },
  { scene: "S10", t: 0 },
  { scene: "S10", t: 1 },
  { scene: "S11", t: 0 },
  { scene: "S11", t: 1 },
  { scene: "S23", t: 0 },
  { scene: "S23", t: 0.5 },
  { scene: "S23", t: 1 },
];

/** Which sampled scene stands in for each shot when the benchmark estimates the whole film (the heavier of the plausible ones). */
export const SHOT_PROXY: Record<string, BenchSceneId> = {
  S00: "S02", S01: "S02", S02: "S02", S03: "S02",
  S04: "S05", S05: "S05", S06: "S05", S07: "S05", S08: "S05", S09: "S05",
  S10: "S10",
  S11: "S11", S12: "S11", S13: "S11",
  S14: "S05", S15: "S05", S16: "S05", S17: "S05", S18: "S05", S19: "S10", S20: "S11", S21: "S05",
  S22: "S23", S23: "S23", S24: "S23", S25: "S23",
};

export const sceneLens = (s: BenchScene, t: number): Lens => ({
  focusCm: 1 / (1 / s.lens0.focusCm + (1 / s.lens1.focusCm - 1 / s.lens0.focusCm) * t),
  focalMm: s.lens0.focalMm + (s.lens1.focalMm - s.lens0.focalMm) * t,
  fNumber: s.lens0.fNumber + (s.lens1.fNumber - s.lens0.fNumber) * t,
});

/** where the boxes are, nearest and furthest from the camera along the axis, cm (to decide whether the object blur pass is needed) */
export function sceneDepthRange(s: BenchScene): { near: number; far: number } {
  let near = Infinity;
  let far = 0;
  for (const b of s.boxes) {
    // half the box's extent along the camera axis: its footprint is w across X and d along Zd, turned by yaw
    const yaw = (b.yawDeg * Math.PI) / 180;
    const half = (Math.abs(b.w * Math.sin(yaw)) + Math.abs(b.d * Math.cos(yaw))) / 2;
    near = Math.min(near, PLATE_MATCH.camDistCm + b.Zd - half);
    far = Math.max(far, PLATE_MATCH.camDistCm + b.Zd + half);
  }
  return { near, far };
}

export { VIEW_FIT, base as BASE_LENS, plateDistanceCm };
