// Patch 05: the camera rig, the operator model and the motion audit.
import * as THREE from "three";
import { CAMERA_KEYFRAMES, FOCAL_MM, FOCUS_PILE_GUIDE_CM, KNOWN_EXCEPTIONS, MIN_GAP_FRAMES, MIN_MOVE_FRAMES, PILE_DISTANCE_CM, glideShot, holdShot, limitFor, mixState, type CameraKeyframe } from "../src/config/camera";
import { M_FIT_HEIGHT, MAGNIFICATION, PLATE_H, PLATE_W, minBlurPx } from "../src/config/plate";
import { BEAT, HEIGHT, SHOTS, TOTAL, WIDTH } from "../src/config/timeline";
import { ZONES } from "../src/config/placement";
import { EASES, SIGNATURE_PEAK_SLOPE, signature, signatureIn, signatureOut } from "../src/lib/ease";
import { springAt } from "../src/lib/spring";
import { auditMotion, type FindingCode } from "../src/camera/audit";
import { isBlurDrawn, plateBlurPx, plateDistanceCm } from "../src/camera/focus";
import { LEAN_INS, MIN_LAYER_FRAMES, OPERATOR, OPERATOR_EVENT_FRAMES, REACH, STEADY_RANGES, operatorAt, steadyGain, walkEnvelope } from "../src/camera/operator";
import { authoredAt, cameraAt, lensOf, turnShiftPx } from "../src/camera/path";
import { PLATE_MATCH, VIEW_FIT, clampView, photoToScreen, windowBox } from "../src/plate/PlateFollow";
import { focalPx, matchCameraRig, photoToOutput, principalY, projectDesk, pxPerCm } from "../src/plate/plateCamera";
import { prng } from "../src/lib/prng";
import { eq, near, test, throws, truthy } from "./harness";

const peak = (e: (t: number) => number): number => {
  let p = 0;
  for (let i = 0; i < 2000; i++) p = Math.max(p, (e((i + 1) / 2000) - e(i / 2000)) * 2000);
  return p;
};

// ---------- easings ----------

test("camera: signatureIn and signatureOut are the two halves of signature, and signature peaks at 20/7", () => {
  near(signatureIn(0), 0, 1e-12);
  near(signatureIn(1), 1, 1e-9);
  near(signatureOut(0), 0, 1e-9);
  near(signatureOut(1), 1, 1e-9);
  near(peak(signature), SIGNATURE_PEAK_SLOPE, 1e-3, "peak slope of signature");
  // the in-half ENDS at the peak slope and the out-half STARTS at it, which is what lets a straight run join them without a jump in speed
  const h = 1e-5;
  near((signatureIn(1) - signatureIn(1 - h)) / h, SIGNATURE_PEAK_SLOPE, 1e-3, "end slope of signatureIn");
  near((signatureOut(h) - signatureOut(0)) / h, SIGNATURE_PEAK_SLOPE, 1e-3, "start slope of signatureOut");
  near(signatureIn(0.001) / 0.001, 0, 0.01, "signatureIn starts at rest");
  let a = 0;
  let b = 0;
  for (let i = 1; i <= 100; i++) {
    truthy(signatureIn(i / 100) >= a - 1e-12 && signatureOut(i / 100) >= b - 1e-12, "monotone");
    a = signatureIn(i / 100);
    b = signatureOut(i / 100);
  }
  eq(EASES.signatureIn, signatureIn);
  eq(EASES.signatureOut, signatureOut);
});

// ---------- keyframes and their builders ----------

test("camera keyframes: in order, every frame on a beat, S00 to S03 (frames 0 to 960)", () => {
  const k = CAMERA_KEYFRAMES;
  eq(k[0].frame, 0);
  eq(k[k.length - 1].frame, 960);
  k.forEach((x, i) => {
    eq(x.frame % BEAT, 0, `keyframe ${i} (frame ${x.frame}) is on a beat`);
    if (i) truthy(x.frame > k[i - 1].frame, `keyframe ${i} is after ${i - 1}`);
    near(x.focalMm, FOCAL_MM, 1e-9, "focal length");
  });
});

test("camera keyframes: the guide's table at the shot boundaries (S00 to S03)", () => {
  const at = (f: number) => authoredAt(f).state;
  near(at(0).M, M_FIT_HEIGHT, 1e-9, "S00 starts on the whole plate");
  near(at(240).M, 1.28, 0.01, "S00 end, S01 start (the table says 1.28; the push is 3%, see config/camera.ts)");
  near(at(480).M, 2.46, 1e-6, "S01 end");
  near(at(840).M, 4.49, 1e-6, "S02 end");
  near(at(960).M, 4.63, 1e-6, "S03 end");
  near(at(0).aperture, 8, 1e-9, "S00 f/8");
  near(at(240).aperture, 4, 1e-9, "S01 f/4");
  near(at(240).focusCm, 260, 1e-6, "S01 focus 260");
  near(at(480).focusCm, 120, 1e-6, "S01 focus 120");
  near(at(840).aperture, 2.8, 1e-9, "S02 f/2.8");
  near(at(840).focusCm, 38, 1e-6, "S02 focus 38");
  near(at(960).focusCm, 36, 1e-6, "S03 focus 36");
  near(at(960).aperture, 2.8, 1e-9);
  // S00's focus is on the pile and stays so until the last second, which pulls to the S01 lens
  near(at(180).focusCm, 36, 1e-9);
  truthy(at(239).focusCm > 36 && at(239).focusCm < 260, "the focus is on its way at 239");
});

test("camera keyframes: M only grows from 0 to 960, and the S03 hold ends 3% above where it began", () => {
  let last = 0;
  for (let f = 0; f <= 960; f++) {
    const M = authoredAt(f).state.M;
    truthy(M >= last - 1e-9, `M falls at frame ${f}`);
    last = M;
  }
  near(authoredAt(960).state.M / authoredAt(840).state.M, 1.031, 0.002);
});

test("camera: holdShot checks its numbers and puts its keys on beats", () => {
  const base = { M: 2, panX: 700, panY: 480, tiltDeg: 0, rollDeg: 0, focusCm: 36, aperture: 2.8, focalMm: FOCAL_MM };
  const keys = holdShot(300, 480, base, { regime: "R2", push: 0.04 });
  eq(keys.length, 3);
  keys.forEach((k) => eq(k.frame % BEAT, 0));
  near(keys[2].M, 2 * 1.04, 1e-9, "the push");
  eq(keys[0].ease, "signature");
  eq(keys[1].ease, "linear");
  throws(() => holdShot(300, 480, base, { regime: "R2", push: 0.2 }), "2 to 5 percent");
  throws(() => holdShot(300, 480, base, { regime: "R2", push: 0.01 }), "2 to 5 percent");
  throws(() => holdShot(310, 480, base, { regime: "R2" }), "on a beat");
  throws(() => holdShot(300, 480, base, { regime: "R2", easeFrames: 30 }), "at least 48");
  throws(() => holdShot(300, 360, base, { regime: "R2", easeFrames: 60 }), "longer than its ease-in");
});

test("camera: a hold's linear push starts at the speed its ease-in ends with (no kink beyond a small step) and covers the whole push", () => {
  const base = { M: 2, panX: 700, panY: 480, tiltDeg: 0, rollDeg: 0, focusCm: 36, aperture: 2.8, focalMm: FOCAL_MM };
  const keys = holdShot(0, 240, base, { regime: "R2", push: 0.04, slide: { x: 20, y: 0 } });
  const at = (f: number) => authoredAt(f, keys).state;
  near(at(240).M, 2.08, 1e-9);
  near(at(240).panX, 720, 1e-9);
  const v = at(121).M - at(120).M;
  near(at(151).M - at(150).M, v, 0.03 * v, "constant speed on the straight part (M moves in 1 / M, so within 3%)");
  truthy(at(30).M - base.M < 0.006, "the ease-in has hardly moved by frame 30");
});

test("camera: glideShot has no jump in speed where its three parts meet, and peaks below a single signature", () => {
  const a = { M: 1.3, panX: 768, panY: 432, tiltDeg: 0, rollDeg: 0, focusCm: 36, aperture: 4, focalMm: FOCAL_MM };
  const b = { M: 2.5, panX: 600, panY: 490, tiltDeg: 0, rollDeg: 0, focusCm: 36, aperture: 4, focalMm: FOCAL_MM };
  const keys = glideShot(240, 480, a, b, { inFrames: 90, outFrames: 120, regime: "R2" });
  eq(keys.length, 4);
  eq(keys.map((k) => k.frame).join(","), "240,330,360,480");
  const x = (f: number): number => 1 / authoredAt(f, keys).state.M;
  near(x(240), 1 / 1.3, 1e-9);
  near(x(480), 1 / 2.5, 1e-9);
  // speed on the frame before and the frame after each join
  for (const j of [330, 360]) near(x(j + 1) - x(j), x(j) - x(j - 1), 2e-5, `speed at the join ${j}`);
  let max = 0;
  for (let f = 241; f <= 480; f++) max = Math.max(max, Math.abs(x(f) - x(f - 1)));
  const mean = Math.abs(1 / 2.5 - 1 / 1.3) / 240;
  // the peak is the speed of the straight part: 1 / (L - (in + out)(1 - 1/s)) of the move per frame, 2.3 x the mean for these eases
  const v = Math.abs(1 / 2.5 - 1 / 1.3) / (240 - 210 * (1 - 1 / SIGNATURE_PEAK_SLOPE));
  near(max, v, 0.01 * v, "the peak is the straight part's speed");
  truthy(max < 0.85 * SIGNATURE_PEAK_SLOPE * mean, `the glide peaks at ${(max / mean).toFixed(2)} x its mean speed (a single signature would peak at 2.86 x)`);
  throws(() => glideShot(240, 480, a, b, { inFrames: 30, outFrames: 120, regime: "R2" }), "at least 48");
  throws(() => glideShot(240, 480, a, b, { inFrames: 150, outFrames: 150, regime: "R2" }), "longer than its two eases");
});

test("camera: mixState moves M and the focus in 1 / x and everything else linearly", () => {
  const a = { M: 1, panX: 0, panY: 0, tiltDeg: 0, rollDeg: 0, focusCm: 100, aperture: 2, focalMm: 40 };
  const b = { M: 4, panX: 10, panY: 20, tiltDeg: 2, rollDeg: 1, focusCm: 25, aperture: 4, focalMm: 60 };
  const m = mixState(a, b, 0.5);
  near(1 / m.M, (1 + 0.25) / 2, 1e-12);
  near(1 / m.focusCm, (0.01 + 0.04) / 2, 1e-12);
  near(m.panX, 5, 1e-12);
  near(m.aperture, 3, 1e-12);
  near(m.focalMm, 50, 1e-12);
});

// ---------- the path ----------

test("camera path: frame 0 is the whole plate, centred, even with the operator on, and draws no blur (so plate:verify still sees the bare photo)", () => {
  const c = cameraAt(0);
  eq(c.view.M, VIEW_FIT.M);
  eq(c.view.cx, VIEW_FIT.cx);
  eq(c.view.cy, VIEW_FIT.cy);
  eq(c.rollDeg, 0);
  truthy(!isBlurDrawn(plateBlurPx(c.view.M, c.lens, PLATE_MATCH)), "no blur at frame 0");
  // the whole opening beat, until M leaves 1.319, is centred: the margin rule leaves the operator no room
  for (let f = 0; f <= 240; f++) {
    const v = cameraAt(f).view;
    if (v.M < 1.319) {
      eq(v.cx, PLATE_W / 2, `centred at ${f}`);
      eq(v.cy, PLATE_H / 2, `centred at ${f}`);
    }
  }
});

test("camera path: the view never leaves the 40 px margin and is a pure function of the frame, S00 to S05", () => {
  for (let f = 0; f <= 1200; f++) {
    const c = cameraAt(f);
    const chk = clampView(c.view, c.rollDeg);
    truthy(!chk.clamped, `the view at frame ${f} is outside the margin`);
    const again = cameraAt(f);
    eq(JSON.stringify(again), JSON.stringify(c), `frame ${f} twice`);
  }
});

test("camera path: after the last keyframe the camera holds, and the regime comes from the shot table", () => {
  const last = authoredAt(1080).state;
  const later = authoredAt(1100);
  eq(JSON.stringify(later.state), JSON.stringify(last));
  eq(later.regime, "R3", "S04 is R3");
  eq(authoredAt(0).regime, "R1");
  eq(authoredAt(300).regime, "R2");
});

test("camera path: the guide's focus column is rescaled so 36 is the pile, and 260 and 120 are farther", () => {
  const pile = PLATE_MATCH.camDistCm + ZONES.L.anchor.Zd;
  near(PILE_DISTANCE_CM, pile, 1e-9);
  const l36 = lensOf(FOCUS_PILE_GUIDE_CM, 2.8, FOCAL_MM);
  near(l36.focusCm, pile, 1e-9);
  near(lensOf(72, 2.8, FOCAL_MM).focusCm, 2 * pile, 1e-9);
  truthy(lensOf(260, 4, FOCAL_MM).focusCm > lensOf(120, 4, FOCAL_MM).focusCm);
  // the opening lens is the Patch 04 default: focused on the pile at f/8
  const l0 = cameraAt(0).lens;
  near(l0.focusCm, pile, 1e-6);
  near(l0.fNumber, 8, 1e-12);
  // the pile hold (S03 end): the pile is sharp, the plate is soft by the table
  const c = cameraAt(959);
  near(c.lens.focusCm, pile, 0.02 * pile, "focus is on the pile at the end of S03");
  truthy(plateBlurPx(c.view.M, c.lens, PLATE_MATCH) >= minBlurPx(c.view.M) - 1e-9, "the plate gets at least the table's blur");
});

test("camera path: a tilt is a shift of the window by focalPx x tan, positive looks down", () => {
  truthy(turnShiftPx(1) > 0 && turnShiftPx(-1) < 0);
  near(turnShiftPx(0), 0, 1e-12);
  near(turnShiftPx(1), 33.08, 0.05, "about 33 photo px per degree");
});

// ---------- the operator model ----------

test("operator: a pure function of the frame, finite and within the table's amplitudes over the whole film", () => {
  const o = OPERATOR;
  const maxUp = o.breathing.cm + o.walkBob.cm + o.tremor.cm + o.reachDip.downCm + 0.8;
  for (let f = 0; f < TOTAL; f += 3) {
    const a = operatorAt(f, "R3");
    const b = operatorAt(f, "R3");
    eq(JSON.stringify(a), JSON.stringify(b));
    truthy(Object.values(a).every(Number.isFinite), `finite at ${f}`);
    truthy(Math.abs(a.rightCm) <= o.walkSway.cm + o.tremor.cm + 1e-9, `right at ${f}`);
    truthy(Math.abs(a.upCm) <= maxUp, `up at ${f}`);
    truthy(a.forwardCm >= -1e-9 && a.forwardCm <= o.leanIn.forwardCm + 1e-9, `forward at ${f}`);
  }
});

test("operator: no jumps from one frame to the next (nothing shorter than 6 frames)", () => {
  let prev = operatorAt(0, "R2");
  for (let f = 1; f < 1400; f++) {
    const cur = operatorAt(f, f < 960 ? "R2" : "R3");
    truthy(Math.abs(cur.upCm - prev.upCm) < 0.3, `up jumps at ${f}`);
    truthy(Math.abs(cur.rightCm - prev.rightCm) < 0.1, `right jumps at ${f}`);
    truthy(Math.abs(cur.forwardCm - prev.forwardCm) < 0.2, `forward jumps at ${f}`);
    truthy(Math.abs(cur.tiltDownDeg - prev.tiltDownDeg) < 0.1, `tilt jumps at ${f}`);
    prev = cur;
  }
  const gaps = OPERATOR_EVENT_FRAMES.slice(1).map((f, i) => f - OPERATOR_EVENT_FRAMES[i]);
  truthy(gaps.every((g) => g >= MIN_LAYER_FRAMES), "events are at least 6 frames apart");
  truthy((1 / OPERATOR.tremor.hz) * 60 >= MIN_LAYER_FRAMES, "the tremor's period is at least 6 frames");
  truthy(OPERATOR.walkBob.fadeInFrames >= MIN_LAYER_FRAMES && OPERATOR.walkBob.fadeOutFrames >= MIN_LAYER_FRAMES && OPERATOR.reachDip.frames >= MIN_LAYER_FRAMES && OPERATOR.leanIn.frames >= MIN_LAYER_FRAMES, "fades and ramps are at least 6 frames");
});

test("operator: every event frame is a multiple of 30", () => {
  for (const f of OPERATOR_EVENT_FRAMES) eq(f % BEAT, 0, `event at ${f}`);
  for (const l of LEAN_INS) eq((l.from % BEAT) + (l.until % BEAT), 0);
  eq((REACH.dip % BEAT) + (REACH.settle % BEAT), 0);
});

test("operator: the walk is S01 only, fades in over 30 frames and out over frames 440-480, and bobs at about 1.8 Hz", () => {
  const env = walkEnvelope;
  near(env(239), 0, 1e-12);
  near(env(240), 0, 1e-12);
  truthy(env(255) > 0.3 && env(255) < 0.7, "half faded in at 255");
  near(env(300), 1, 1e-12);
  near(env(439), 1, 1e-9);
  truthy(env(460) > 0.4 && env(460) < 0.6, "half faded out at 460");
  near(env(480), 0, 1e-12);
  near(env(481), 0, 1e-12);
  // outside S01 there is no sway at all, and no bob beyond breathing's 0.35 cm
  for (let f = 0; f < 240; f += 7) near(operatorAt(f, "R1").rightCm, 0, 1e-12, `no sway at ${f}`);
  for (let f = 500; f < 950; f += 7) near(operatorAt(f, "R2").rightCm, 0, 1e-12, `no sway at ${f}`);
  // the frequency: power of the vertical movement at 1.8 Hz against its neighbours, over frames 270-430
  const power = (hz: number): number => {
    let c = 0;
    let s = 0;
    for (let f = 270; f < 430; f++) {
      const u = operatorAt(f, "R2").upCm;
      c += u * Math.cos((2 * Math.PI * hz * f) / 60);
      s += u * Math.sin((2 * Math.PI * hz * f) / 60);
    }
    return c * c + s * s;
  };
  truthy(power(1.8) > 4 * power(1.2) && power(1.8) > 4 * power(2.5) && power(1.8) > 4 * power(0.9), "the bob is at 1.8 Hz");
});

test("operator: tremor is R3 only and not in a steady range; breathing is everywhere but fades out in a steady range", () => {
  const r2 = operatorAt(2000, "R2");
  const r3 = operatorAt(2000, "R3");
  truthy(Math.abs(r3.rightCm - r2.rightCm) > 0 || Math.abs(r3.upCm - r2.upCm) > 0, "R3 differs from R2 by the tremor");
  truthy(Math.abs(r3.rightCm - r2.rightCm) <= OPERATOR.tremor.cm + 1e-9);
  const s = STEADY_RANGES[0];
  const mid = Math.round((s.from + s.to) / 2);
  const st = operatorAt(mid, "R3");
  near(st.rightCm, 0, 1e-12, "no tremor in the QR hold");
  near(st.upCm, 0, 1e-12, "no breathing in the QR hold");
  near(steadyGain(s.from - 40), 1, 1e-12);
  near(steadyGain(mid), 0, 1e-12);
  near(steadyGain(s.to + 40), 1, 1e-12);
  truthy(steadyGain(s.from - 6) > 0 && steadyGain(s.from - 6) < 1, "blended at the edge");
  truthy(Math.abs(operatorAt(100, "R1").upCm) > 0, "breathing at frame 100");
});

test("operator: the lean-in is 3 cm forward and 0.6 degrees down over 1 s, and the S02 lean holds until it is released", () => {
  const lean = (f: number) => operatorAt(f, "R2");
  near(lean(480).forwardCm, 0, 1e-9);
  truthy(lean(510).forwardCm > 1 && lean(510).forwardCm < 2, "half way after 30 frames");
  near(lean(540).forwardCm, OPERATOR.leanIn.forwardCm, 1e-9, "full after 60 frames");
  near(lean(700).forwardCm, OPERATOR.leanIn.forwardCm, 1e-9, "held");
  near(lean(900).forwardCm, 0, 1e-9, "released by 900");
  // the tilt down is 0.6 degrees at the top of the lean, on top of breathing's 0.08
  near(lean(700).tiltDownDeg, OPERATOR.leanIn.downDeg, OPERATOR.breathing.deg + 1e-9);
});

test("operator: the reach dips 2 cm in 24 frames, then rings back up with about 0.7 cm of overshoot", () => {
  const d = OPERATOR.reachDip;
  const dipEnd = REACH.dip + d.frames;
  const up = (f: number) => operatorAt(f, "R3").upCm;
  truthy(up(dipEnd) < -1.5, "down by about 2 cm at the bottom of the dip");
  // the spring itself: from -2 to rest, overshoot 0.7 cm
  const s = OPERATOR.settle;
  let over = 0;
  for (let i = 0; i < 200; i++) over = Math.max(over, springAt(i / 60, s.spring, -d.downCm, 0));
  near(over, s.overshootCm, 0.05, "overshoot");
  let best = -9;
  for (let f = REACH.settle; f < REACH.settle + 90; f++) best = Math.max(best, up(f));
  truthy(best > 0.3, "the camera rings back up past its rest after the settle");
  // quiet again well after
  truthy(Math.abs(up(REACH.settle + 150)) < 0.6, "settled");
});

// ---------- roll ----------

function rolledCamera(p = PLATE_MATCH, view = { M: 2.4, cx: 640, cy: 520 }, rollDeg = 0) {
  const rig = matchCameraRig(p, view, rollDeg);
  const cam = new THREE.PerspectiveCamera(rig.fovDeg, rig.aspect, 1, 5000);
  cam.position.set(...rig.position);
  cam.rotation.set(rig.rotationX, 0, rig.rotationZ);
  cam.setViewOffset(rig.viewOffset.fullW, rig.viewOffset.fullH, rig.viewOffset.x, rig.viewOffset.y, rig.viewOffset.w, rig.viewOffset.h);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}
const toScreen = (v: THREE.Vector3, cam: THREE.PerspectiveCamera): { x: number; y: number } => {
  const n = v.clone().project(cam);
  return { x: ((n.x + 1) / 2) * WIDTH, y: ((1 - n.y) / 2) * HEIGHT };
};

test("roll: a rolled three.js camera turns the picture about the CENTRE OF THE FRAME, clockwise for a positive roll, and desk points stay on the plate", () => {
  const r = prng(55);
  for (let i = 0; i < 60; i++) {
    const view = { M: 1.5 + r() * 5, cx: 300 + r() * 900, cy: 350 + r() * 200 };
    const roll = (r() - 0.5) * 6;
    const cam = rolledCamera(PLATE_MATCH, view, roll);
    const X = -40 + r() * 190;
    const Zd = r() * 50;
    const Y = r() * 20;
    const a = projectDesk(PLATE_MATCH, X, Y, Zd);
    const want = photoToOutput(view, a.x, a.y, roll);
    const got = toScreen(new THREE.Vector3(X, Y, -Zd), cam);
    near(got.x, want.x, 0.02, "x");
    near(got.y, want.y, 0.02, "y");
  }
  // a point right of the centre moves DOWN on screen for a positive roll (clockwise)
  const view = { M: 2, cx: 700, cy: 480 };
  const level = photoToOutput(view, 900, 480, 0);
  const rolled = photoToOutput(view, 900, 480, 2);
  truthy(rolled.y > level.y, "clockwise: the right-hand point goes down");
  near(photoToOutput(view, 700, 480, 2).x, WIDTH / 2, 1e-9, "the centre stays");
  near(photoToOutput(view, 700, 480, 2).y, HEIGHT / 2, 1e-9, "the centre stays");
  near(photoToScreen(view, 900, 480, 2).x, rolled.x, 1e-12, "photoToScreen takes the roll");
  eq(photoToScreen(view, 900, 480).x, level.x);
});

test("roll: the plate card seen through a rolled camera lands where photoToOutput says, so the plate and a box on the desk roll together", () => {
  const view = { M: 2.4, cx: 640, cy: 520 };
  const roll = 1.5;
  const cam = rolledCamera(PLATE_MATCH, view, roll);
  const rig = matchCameraRig(PLATE_MATCH, view, roll);
  const f = PLATE_MATCH.camDistCm + PLATE_MATCH.plateDepthCm;
  const cmPerPx = f / focalPx(PLATE_MATCH);
  for (const [px, py] of [[640, 520], [418, 561], [900, 430]]) {
    // card point in camera space, then the camera's own pose (no roll in the card's group)
    const local = new THREE.Vector3((px - PLATE_MATCH.principalX) * cmPerPx, -(py - principalY(PLATE_MATCH)) * cmPerPx, -f);
    const group = new THREE.Group();
    group.position.set(...rig.position);
    group.rotation.set(rig.rotationX, 0, 0);
    group.updateMatrixWorld(true);
    const s = toScreen(local.applyMatrix4(group.matrixWorld), cam);
    const w = photoToOutput(view, px, py, roll);
    near(s.x, w.x, 0.05, "card x");
    near(s.y, w.y, 0.05, "card y");
  }
  near(toScreen(new THREE.Vector3((640 - PLATE_MATCH.principalX) * cmPerPx, -(520 - principalY(PLATE_MATCH)) * cmPerPx, -f).applyMatrix4(new THREE.Matrix4().makeTranslation(...rig.position)), cam).x, WIDTH / 2, 0.05, "the view's centre pixel is the frame centre");
  eq(matchCameraRig(PLATE_MATCH, view).rotationZ, 0, "no roll, no rotation");
});

test("roll: the margin rule counts the corners of a rolled frame", () => {
  near(windowBox(2, 0).w, WIDTH / 2, 1e-12);
  near(windowBox(2, 0).h, HEIGHT / 2, 1e-12);
  truthy(windowBox(2, 2).w > WIDTH / 2 && windowBox(2, 2).h > HEIGHT / 2, "the rolled frame's box is bigger");
  // a view that touches the margin level needs to move when it is rolled
  const edge = { M: 2, cx: 40 + WIDTH / 2 / 2, cy: 432 };
  truthy(!clampView(edge, 0).clamped, "level view is just inside");
  truthy(clampView(edge, 2).clamped, "rolled view is clamped");
  eq(clampView({ M: 1.3, cx: 100, cy: 100 }, 3).view.cx, PLATE_W / 2, "no room: still centred");
});

// ---------- the audit ----------

const BASE = { M: 2, panX: 700, panY: 480, tiltDeg: 0, rollDeg: 0, focusCm: 36, aperture: 2.8, focalMm: FOCAL_MM };
const key = (frame: number, over: Partial<CameraKeyframe> = {}): CameraKeyframe => ({ frame, ...BASE, ease: "linear", regime: "R2", ...over });
const codes = (keys: CameraKeyframe[], from?: number, to?: number): Record<FindingCode, number> => auditMotion({ keys, from, to, exceptions: [] }).counts;
const GOOD = [key(0), key(120, { M: 2.1, panX: 690 }), key(150, { M: 2.1, panX: 690 })];

test("audit: S00 to S04 (frames 0-1079) pass with the one documented exception (STILL at the opening), and the peaks are inside the limits", () => {
  const r = auditMotion();
  eq(r.range.join("-"), "0-1079", "the default keys are the film's (S00-S04 so far)");
  eq(r.unexplained, 0, JSON.stringify(r.findings));
  eq(r.counts.FAST + r.counts.DEEP + r.counts.EDGE + r.counts.POP + r.counts.LATE, 0, "zero FAST, DEEP, EDGE, POP and LATE");
  eq(r.counts.STILL, 1);
  eq(KNOWN_EXCEPTIONS.length, 1);
  truthy(r.findings[0].known, "the STILL is a documented exception");
  truthy(r.stats.peakLateralCmPerSec < limitFor("R2").lateralCmPerSec, `lateral ${r.stats.peakLateralCmPerSec}`);
  truthy(r.stats.peakMRatePerSec < 1.5, `M rate ${r.stats.peakMRatePerSec}`);
  truthy(r.stats.peakPopFraction < 0.02, "no pop");
  truthy(r.stats.maxM <= limitFor("R3").maxM, "the lift of S04 is R3");
  eq(r.timeline.frames, TOTAL);
  eq(r.timeline.shots, SHOTS.length);
  // without the exception list the opening STILL is reported
  const all = auditMotion({ exceptions: [] });
  eq(all.unexplained, 1);
  eq(all.findings[0].code, "STILL");
  eq(`${all.findings[0].from}-${all.findings[0].to}`, "0-65");
});

test("audit: a small clean path has no findings", () => {
  const c = codes(GOOD);
  eq(Object.values(c).reduce((a, b) => a + b, 0), 0, JSON.stringify(auditMotion({ keys: GOOD, exceptions: [] }).findings));
});

test("audit: a 20-frame move is reported as FAST (and the 48-frame minimum is the guide's)", () => {
  eq(MIN_MOVE_FRAMES, 48);
  eq(MIN_GAP_FRAMES, 20);
  const keys = [...GOOD, key(170, { M: 2.15, panX: 690 }), key(260, { M: 2.15, panX: 690 })];
  const r = auditMotion({ keys, exceptions: [] });
  const f = r.findings.filter((x) => x.code === "FAST" && /move of 20 frames/.test(x.detail));
  eq(f.length, 1, JSON.stringify(r.findings));
  eq(f[0].from, 150);
  eq(f[0].to, 170);
});

test("audit: two moves less than 20 frames apart are reported as FAST", () => {
  const keys = [key(0), key(60, { M: 2.1 }), key(70, { M: 2.1 }), key(150, { M: 2.2 }), key(210, { M: 2.2 })];
  const r = auditMotion({ keys, exceptions: [] });
  truthy(r.findings.some((x) => x.code === "FAST" && /only 10 frames between two camera moves/.test(x.detail)), JSON.stringify(r.findings));
});

test("audit: a magnification that changes more than 1.5 x per second is FAST", () => {
  const keys = [key(0), key(60, { M: 4 }), key(150, { M: 4.1 })];
  const r = auditMotion({ keys, exceptions: [] });
  truthy(r.findings.some((x) => x.code === "FAST" && /per second/.test(x.detail)), JSON.stringify(r.findings));
});

test("audit: a slide faster than 40 cm/s in R2 (and 10 cm/s in R3) is FAST", () => {
  const ppc = pxPerCm(PLATE_MATCH, PLATE_MATCH.plateDepthCm);
  const px = 60 * ppc; // 60 cm in 1 s
  const keys = [key(0, { panX: 600 }), key(60, { panX: 600 + px }), key(150, { panX: 600 + px + 5 })];
  truthy(auditMotion({ keys, exceptions: [] }).findings.some((x) => x.code === "FAST" && /sideways speed/.test(x.detail)), "R2");
  const slow = 20 * ppc; // 20 cm in 1 s: fine in R2, too fast in R3
  const k2 = (regime: "R2" | "R3") => [key(0, { panX: 600, regime }), key(60, { panX: 600 + slow, regime }), key(150, { panX: 600 + slow + 5, regime })];
  eq(auditMotion({ keys: k2("R2"), exceptions: [] }).findings.filter((x) => /sideways/.test(x.detail)).length, 0, "20 cm/s is allowed in R2");
  truthy(auditMotion({ keys: k2("R3"), exceptions: [] }).findings.some((x) => /sideways/.test(x.detail)), "20 cm/s is too fast in R3");
});

test("audit: a hold over 60 frames without a drift is STILL", () => {
  const keys = [key(0), key(120), key(180, { M: 2.2 }), key(300, { M: 2.2 })];
  const r = auditMotion({ keys, exceptions: [] });
  truthy(r.findings.some((x) => x.code === "STILL" && x.from === 0), JSON.stringify(r.findings));
});

test("audit: a keyframe off the beat is LATE", () => {
  const keys = [key(0), key(125, { M: 2.2 }), key(210, { M: 2.25 })];
  const r = auditMotion({ keys, exceptions: [] });
  const late = r.findings.filter((x) => x.code === "LATE");
  eq(late.length, 1, JSON.stringify(late));
  eq(late[0].from, 125);
  truthy(/f125 is not on a beat \(nearest: f120\)/.test(late[0].detail), late[0].detail);
});

test("audit: magnification above the regime's budget is DEEP (R2 stops at 4.7)", () => {
  const keys = [key(0, { M: 4.5 }), key(120, { M: 5.2 }), key(240, { M: 5.2 })];
  const r = auditMotion({ keys, exceptions: [] });
  truthy(r.findings.some((x) => x.code === "DEEP" && /budget/.test(x.detail)), JSON.stringify(r.findings));
  // the table's defocus is always applied, so the second DEEP test (not enough blur) cannot fire for a camera the rig draws
  for (let f = 0; f < 960; f += 7) {
    const c = cameraAt(f);
    if (c.view.M > MAGNIFICATION.sharpUpTo) truthy(plateBlurPx(c.view.M, c.lens, PLATE_MATCH) >= minBlurPx(c.view.M) - 1e-6, `blur at ${f}`);
  }
});

test("audit: a window outside the 40 px margin, and a tilt or roll above the budget, are EDGE", () => {
  const out = [key(0, { panX: 100 }), key(120, { panX: 100, M: 2.1 }), key(210, { panX: 100, M: 2.1 })];
  truthy(auditMotion({ keys: out, exceptions: [] }).findings.some((x) => x.code === "EDGE" && /margin/.test(x.detail)), "margin");
  // a pan while the whole plate is on screen (M below 1.319) is outside the margin rule too
  const early = [key(0, { M: 1.25, panX: 768, panY: 432 }), key(120, { M: 1.28, panX: 600, panY: 432 }), key(210, { M: 1.3, panX: 600, panY: 432 })];
  truthy(auditMotion({ keys: early, exceptions: [] }).findings.some((x) => x.code === "EDGE"), "pan below M 1.319");
  const tilt = [key(0, { tiltDeg: 0 }), key(120, { tiltDeg: 5, M: 2.1 }), key(210, { tiltDeg: 5, M: 2.2 })];
  truthy(auditMotion({ keys: tilt, exceptions: [] }).findings.some((x) => x.code === "EDGE" && /tilt/.test(x.detail)), "tilt");
  const roll = [key(0), key(120, { rollDeg: 2.5, M: 2.1 }), key(210, { rollDeg: 2.5, M: 2.2 })];
  truthy(auditMotion({ keys: roll, exceptions: [] }).findings.some((x) => x.code === "EDGE" && /roll/.test(x.detail)), "roll");
});

test("audit: a jump of the picture from one frame to the next is POP", () => {
  const keys = [key(0), key(1, { M: 2.6 }), key(120, { M: 2.7 }), key(210, { M: 2.75 })];
  const r = auditMotion({ keys, exceptions: [] });
  truthy(r.findings.some((x) => x.code === "POP"), JSON.stringify(r.findings));
});

test("audit: refuses an empty range and keyframes out of order", () => {
  throws(() => auditMotion({ from: 300, to: 300 }), "empty");
  throws(() => auditMotion({ keys: [key(0), key(60), key(30)] }), "not after the previous keyframe");
  throws(() => auditMotion({ keys: [key(30), key(60)] }), "first keyframe must be at frame 0");
});

test("audit: the plate's defocus table is what the rig gives at the pile hold (a sanity check of the numbers in the notes)", () => {
  const c = cameraAt(900);
  const blur = plateBlurPx(c.view.M, c.lens, PLATE_MATCH);
  truthy(blur >= minBlurPx(4.5) - 1, `blur ${blur}`);
  truthy(plateDistanceCm(PLATE_MATCH) > PILE_DISTANCE_CM);
});
