// Proves the numbers in docs/reference/calibration-seed/ are internally consistent and agree with three.js. Patch 03 starts here.
import * as THREE from "three";
import { CALIB_SEED, deskToWorld, photoToScreen, projectDesk, threeCameraParams, unprojectToDesk, type PlateWindow } from "../docs/reference/calibration-seed/plateCamera.seed";
import seed from "../docs/reference/calibration-seed/calibration-seed.json";
import { prng } from "../src/lib/prng";
import { near, test } from "./harness";

test("seed: the model predicts the hand-measured desk corners (back corners were NOT used in the fit)", () => {
  const m = seed.measuredOnThePhoto;
  const d = CALIB_SEED.desk;
  near(projectDesk(CALIB_SEED, d.xMin, 0, d.depth).x, m.deskTopBackLeftX, 2.5, "back-left x");
  near(projectDesk(CALIB_SEED, d.xMax, 0, d.depth).x, m.deskTopBackRightX, 2.5, "back-right x");
  near(projectDesk(CALIB_SEED, d.xMin, 0, d.depth).y, m.deskTopBackEdgeY, 2.5, "back y");
  near(projectDesk(CALIB_SEED, d.xMin, 0, 0).x, m.deskTopFrontLeftX, 1.5, "front-left x");
  near(projectDesk(CALIB_SEED, d.xMax, 0, 0).x, m.deskTopFrontRightX, 1.5, "front-right x");
  near(projectDesk(CALIB_SEED, d.xMin, 0, 0).y, m.deskTopFrontEdgeY, 1.5, "front y");
});
test("seed: unproject inverts project on the desk plane", () => {
  const r = prng(7);
  for (let i = 0; i < 40; i++) {
    const X = -110 + r() * 220;
    const Zd = r() * 60;
    const p = projectDesk(CALIB_SEED, X, 0, Zd);
    const u = unprojectToDesk(CALIB_SEED, p.x, p.y);
    near(u.X, X, 1e-6);
    near(u.Zd, Zd, 1e-6);
  }
});
test("seed: a three.js camera with setViewOffset projects exactly like the analytic model, for random windows", () => {
  const r = prng(11);
  for (let i = 0; i < 60; i++) {
    const win: PlateWindow = { cx: 100 + r() * 540, cy: 250 + r() * 300, zoom: 1.6 + r() * 9 };
    const p = threeCameraParams(CALIB_SEED, win);
    const cam = new THREE.PerspectiveCamera(p.fovDeg, p.aspect, 1, 5000);
    cam.position.set(...p.position);
    cam.setViewOffset(p.view.fullW, p.view.fullH, p.view.x, p.view.y, p.view.w, p.view.h);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    const X = -110 + r() * 220;
    const Y = r() * 25;
    const Zd = r() * 60;
    const ndc = new THREE.Vector3(...deskToWorld(CALIB_SEED, X, Y, Zd)).project(cam);
    const sx = ((ndc.x + 1) / 2) * 1920;
    const sy = ((1 - ndc.y) / 2) * 1080;
    const a = projectDesk(CALIB_SEED, X, Y, Zd);
    const s = photoToScreen(win, a.x, a.y);
    near(sx, s.x, 0.01, "screen x");
    near(sy, s.y, 0.01, "screen y");
  }
});
test("seed: the pitch equivalent in the json is atan((336 - horizonY) / f)", () => {
  const deg = (Math.atan((336 - CALIB_SEED.horizonY) / CALIB_SEED.f) * 180) / Math.PI;
  near(deg, seed.equivalentToThePatch03Sliders.pitchDegEquivalent, 0.02);
  const vfov = (2 * Math.atan(336 / CALIB_SEED.f) * 180) / Math.PI;
  near(vfov, seed.equivalentToThePatch03Sliders.verticalFovDeg, 0.05);
});
