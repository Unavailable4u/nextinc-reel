// The light data, the lamp's place, the shimmer, the probe faces, and the placeholder scenes (Patch 04).
import { LIGHTS, keyIrradianceAt, keyShimmer, lampWorld } from "../src/config/lights";
import { PLATE_MATCH } from "../src/plate/PlateFollow";
import { lampBulb } from "../src/plate/plateCamera";
import { FACE_ORDER, PROBE_SIZE, buildProbeFaces } from "../src/light/PlateProbe";
import { BENCH_FRAMES, SCENES, SHOT_PROXY, sceneDepthRange } from "../src/dev/benchScenes";
import { SHOTS } from "../src/config/timeline";
import { ZONES, footprintInZone } from "../src/config/placement";
import { eq, near, truthy, test } from "./harness";
import * as THREE from "three";

const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const colorLum = (hex: string): number => {
  const c = new THREE.Color(hex);
  return lum(c.r, c.g, c.b);
};

test("lights: the colours are the ones guide 03 names", () => {
  eq(LIGHTS.key.color, "#F0CEA0", "key");
  eq(LIGHTS.rim.color, "#EBAF7B", "rim");
  eq(LIGHTS.fill.color, "#28292E", "fill");
});

test("lights: the lamp is where the match puts the bulb: desk (X, Y, Zd) is world (X, Y, -Zd)", () => {
  const b = lampBulb(PLATE_MATCH);
  const w = lampWorld(PLATE_MATCH);
  near(w[0], b.X, 1e-12, "X");
  near(w[1], b.Y, 1e-12, "Y");
  near(w[2], -b.Zd, 1e-12, "z");
  // the numbers Patch 03 recorded
  near(w[0], -35.33, 0.05, "X recorded");
  near(w[1], 12.26, 0.05, "Y recorded");
  near(w[2], -58.99, 0.05, "z recorded");
});

test("lights: the lamp shines on the pile from behind and to the left, so the shadow falls towards the camera and to the right", () => {
  const w = lampWorld(PLATE_MATCH);
  truthy(w[0] < ZONES.L.anchor.X, "the lamp is left of the pile");
  truthy(-w[2] > ZONES.L.anchor.Zd, "the lamp is deeper (towards the wall) than the pile");
  truthy(w[1] > 0, "the bulb is above the desk");
});

test("lights: the key's irradiance falls with the square of the distance", () => {
  const a = keyIrradianceAt(0, 0, 16);
  const l = lampWorld(PLATE_MATCH);
  const d2 = (0 - l[0]) ** 2 + (0 - l[1]) ** 2 + (-16 - l[2]) ** 2;
  near(a, LIGHTS.key.intensityCd / d2, 1e-9, "I / d^2");
  // twice as far along the same ray gives a quarter
  const x = l[0] + 2 * (0 - l[0]);
  const y = l[1] + 2 * (0 - l[1]);
  const z = l[2] + 2 * (-16 - l[2]);
  near(keyIrradianceAt(x, y, -z) / a, 0.25, 1e-9, "inverse square");
});

test("lights: the fill is about 8% of the key at the pile (between 2% and 20%), the kicker is far weaker than the key", () => {
  const fill = LIGHTS.fill.intensity * colorLum(LIGHTS.fill.color);
  const ratio = fill / keyIrradianceAt(ZONES.L.anchor.X, 2, ZONES.L.anchor.Zd);
  truthy(ratio > 0.02 && ratio < 0.2, `fill ratio ${ratio.toFixed(3)}`);
  truthy(LIGHTS.kicker.intensityCd < LIGHTS.key.intensityCd / 10, "kicker");
});

test("lights: the shimmer is a pure function of the frame, within +-0.4%, and not constant", () => {
  eq(keyShimmer(123), keyShimmer(123), "same frame, same value");
  let lo = 2;
  let hi = 0;
  for (let f = 0; f < 600; f++) {
    const s = keyShimmer(f);
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
  }
  truthy(lo >= 1 - LIGHTS.key.shimmer.amount - 1e-12 && hi <= 1 + LIGHTS.key.shimmer.amount + 1e-12, `range ${lo}..${hi}`);
  truthy(hi - lo > LIGHTS.key.shimmer.amount, "it moves");
});

test("lights: the shadow map size is fixed and a power of two, and its penumbra is about a centimetre at the pile", () => {
  const s = LIGHTS.key.shadow;
  eq(s.mapSize & (s.mapSize - 1), 0, "power of two");
  // a texel at distance d covers 2 d / mapSize cm (a cube face spans 90 degrees); the PCF radius is in texels
  const d = Math.hypot(lampWorld()[0] - 0, lampWorld()[2] + 16);
  const penumbraCm = ((2 * d) / s.mapSize) * s.radius;
  truthy(penumbraCm > 0.4 && penumbraCm < 2.5, `penumbra ${penumbraCm.toFixed(2)} cm`);
});

test("probe: six faces of the right size; the camera's side is nearly black; the plate's face carries the lamp brighter than white", () => {
  const w = 16;
  const h = 9;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 120;
    data[i * 4 + 1] = 90;
    data[i * 4 + 2] = 70;
    data[i * 4 + 3] = 255;
  }
  const faces = buildProbeFaces({ data, width: w, height: h });
  eq(FACE_ORDER.length, 6, "faces");
  for (const n of FACE_ORDER) {
    eq(faces[n].size, PROBE_SIZE, `${n} size`);
    eq(faces[n].data.length, PROBE_SIZE * PROBE_SIZE * 4, `${n} length`);
  }
  const g = (f: Uint16Array, i: number): number => THREE.DataUtils.fromHalfFloat(f[i]);
  const mid = (PROBE_SIZE / 2 + PROBE_SIZE * (PROBE_SIZE / 2)) * 4;
  truthy(g(faces.pz.data, mid) < 0.01, "the camera's side is nearly black");
  let max = 0;
  for (let i = 0; i < faces.nz.data.length; i += 4) max = Math.max(max, g(faces.nz.data, i));
  truthy(max > 1.5, `the lamp's hot spot is brighter than white (${max.toFixed(2)})`);
  // away from the lamp the plate's face is the plate's colour, in linear light (sRGB 120 = 0.188)
  near(g(faces.nz.data, (PROBE_SIZE - 1 + PROBE_SIZE * (PROBE_SIZE - 1)) * 4), 0.188, 0.01, "plate colour, linear");
});

test("benchmark scenes: 12 sample frames over the five scenes; every shot has a stand-in that exists", () => {
  eq(BENCH_FRAMES.length, 12, "frames");
  const used = new Set(BENCH_FRAMES.map((b) => b.scene));
  eq([...used].sort().join(","), "S02,S05,S10,S11,S23", "scenes");
  for (const s of SHOTS) truthy(SHOT_PROXY[s.id] && SCENES[SHOT_PROXY[s.id]], `stand-in for ${s.id}`);
  eq(Object.keys(SHOT_PROXY).length, SHOTS.length, "no extra shots");
});

test("benchmark scenes: the boxes of the pile and the riser stand inside their zones and in front of the plate card is not required", () => {
  for (const b of SCENES.S02.boxes) truthy(footprintInZone(ZONES.L, b.X, b.Zd, b.w, b.d, b.yawDeg), "S02 box in zone L");
  const riser = SCENES.S23.boxes[0];
  truthy(footprintInZone(ZONES.R, riser.X, riser.Zd, riser.w, riser.d, riser.yawDeg), "riser in zone R");
  for (const id of Object.keys(SCENES) as (keyof typeof SCENES)[]) {
    const r = sceneDepthRange(SCENES[id]);
    truthy(r.near > PLATE_MATCH.camDistCm && r.far < PLATE_MATCH.camDistCm + PLATE_MATCH.deskDepthCm, `${id} depth range ${r.near.toFixed(0)}..${r.far.toFixed(0)}`);
  }
});
