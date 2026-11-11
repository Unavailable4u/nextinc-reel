// The lens model and the plate's defocus rule (Patch 04).
import { MAGNIFICATION, minBlurPx } from "../src/config/plate";
import { PLATE_MATCH } from "../src/plate/PlateFollow";
import { NEUTRAL_BLUR_PX, PLATE_PX_PER_MM, cocRadiusPx, defaultLens, isBlurDrawn, lensAt, matchFocalMm, objectsNeedDefocus, plateBlurPx, plateDistanceCm, type Lens } from "../src/camera/focus";
import { eq, near, throws, truthy, test } from "./harness";

const L = (focusCm: number, fNumber = 2.8, focalMm = 44): Lens => ({ focusCm, focalMm, fNumber });

test("focus: a point exactly at the focus distance is sharp", () => {
  near(cocRadiusPx(500, L(500), 4.49), 0, 1e-12, "at focus");
});

test("focus: the thin lens matches the textbook formula", () => {
  // f 50 mm, f/2, focus 1 m, object 2 m: c = f^2 / (N (S - f)) * |D - S| / D = 2500 / (2 * 950) * 0.5 = 0.65789 mm on the sensor
  const lens = { focusCm: 100, focalMm: 50, fNumber: 2 };
  const radius = cocRadiusPx(200, lens, 1);
  near(radius, 0.5 * 0.657894737 * PLATE_PX_PER_MM, 1e-6, "radius in plate px at M = 1");
});

test("focus: blur grows with the aperture, with the distance from focus, and with the plate magnification", () => {
  const a = cocRadiusPx(700, L(500, 2.8), 2);
  truthy(cocRadiusPx(700, L(500, 1.4), 2) > a, "wider aperture, more blur");
  truthy(cocRadiusPx(900, L(500, 2.8), 2) > a, "further from focus, more blur");
  near(cocRadiusPx(700, L(500, 2.8), 4) / a, 2, 1e-9, "twice the magnification, twice the blur");
});

test("focus: it refuses nonsense (focus nearer than the focal length, a zero distance)", () => {
  throws(() => cocRadiusPx(500, { focusCm: 3, focalMm: 44, fNumber: 2 }, 1), "must be longer than the focal length");
  throws(() => cocRadiusPx(0, L(500), 1), "must be positive");
});

test("focus: the match camera is about a 44 mm lens on the 36 mm sensor", () => {
  near(matchFocalMm(PLATE_MATCH), 44.4, 0.3, "focal length");
  near(plateDistanceCm(PLATE_MATCH), 540.4, 0.1, "plate distance");
});

test("focus: the plate's blur is the magnification table's minimum when the thin lens gives less", () => {
  const lens = defaultLens(PLATE_MATCH);
  for (const M of [3, 3.5, 4.49, 5, 6.51]) {
    const lensOnly = cocRadiusPx(plateDistanceCm(PLATE_MATCH), { ...lens, fNumber: 2.8 }, M);
    truthy(lensOnly < minBlurPx(M), `at M ${M} a real lens at 5 m blurs the card by ${lensOnly.toFixed(2)} px, less than the table's ${minBlurPx(M).toFixed(1)}`);
    near(plateBlurPx(M, { ...lens, fNumber: 2.8 }, PLATE_MATCH), minBlurPx(M), 1e-9, `rule at M ${M}`);
  }
});

test("focus: the plate's blur is never below the table, and a close focus (R3) can exceed it", () => {
  const close = { focusCm: 100, focalMm: 50, fNumber: 2 };
  truthy(plateBlurPx(6.51, close, PLATE_MATCH) >= MAGNIFICATION.minBlurAtBokeh, "R3 backdrop is at least the bokeh minimum");
  truthy(plateBlurPx(6.51, close, PLATE_MATCH) > minBlurPx(6.51), "a real close focus blurs the far plate more than the table needs");
});

test("focus: the opening view (M 1.25, f/8, focused on the pile) draws no blur, so the plate stays the bare photo", () => {
  const r = plateBlurPx(1.25, defaultLens(PLATE_MATCH), PLATE_MATCH);
  truthy(r < NEUTRAL_BLUR_PX, `radius ${r}`);
  eq(isBlurDrawn(r), false, "not drawn");
  eq(isBlurDrawn(NEUTRAL_BLUR_PX), true, "the threshold itself is drawn");
});

test("focus: at M 4.49 the pile (508 to 532 cm) is within focus on the pile and the plate is soft", () => {
  const lens = L(PLATE_MATCH.camDistCm + 16);
  eq(objectsNeedDefocus(lens, 4.49, PLATE_MATCH.camDistCm + 4, PLATE_MATCH.camDistCm + 28), false, "the pile is sharp");
  truthy(plateBlurPx(4.49, lens, PLATE_MATCH) > 10, "the plate is soft");
});

test("focus: a focus pull is eased, starts and ends exactly, and moves in 1 / distance", () => {
  const a = L(120);
  const b = L(38, 2.8, 50);
  near(lensAt(100, 100, 200, a, b).focusCm, 120, 1e-9, "start");
  near(lensAt(200, 100, 200, a, b).focusCm, 38, 1e-9, "end");
  near(lensAt(50, 100, 200, a, b).focusCm, 120, 1e-9, "before the pull");
  near(lensAt(300, 100, 200, a, b).focusCm, 38, 1e-9, "after the pull");
  const mid = lensAt(150, 100, 200, a, b);
  near(1 / mid.focusCm, (1 / 120 + 1 / 38) / 2, 1e-9, "halfway in 1 / distance");
  near(mid.focalMm, 47, 1e-9, "focal length is linear");
  eq(lensAt(150, 100, 200, a, b).focusCm, mid.focusCm, "deterministic");
});
