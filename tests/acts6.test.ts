// PATCH 18: the shots S16-S21 (the second book, MiniLocker): the camera 3000-3959 against the audit, the book's script (lift, open on the title spread, one short riffle,
// the gallery, the film spread, the page-back, the close, the set-down on beat 130), the hero tracks, the QR hold (square-on, flat, steady, at least 90 frames, the size of a
// module, a simulated decode), the readable spreads, the cropped screenshots, the cues. The pictures and the 60 fps look are for a person (see the notes of Patch 18).
import * as THREE from "three";
import fs from "node:fs";
import path from "node:path";
import jsQR from "jsqr";
import { BEAT, HEIGHT, SHOTS, WIDTH } from "../src/config/timeline";
import { HERO_STATES, VIEW_SET, limitFor, stateOf } from "../src/config/camera";
import { HERO, heroOffsetAt, trackAt } from "../src/config/heroMotion";
import { BOOKS } from "../src/config/books";
import { BLANK_PAGE, BOOK_SCRIPT, FLUTTER_SEC, airSheetsAt, checkTurns, coverEventsOf, faceIndices, getBookLocation, getBookPose, getBookState, stacksAt, turnedAt, booksAt } from "../src/config/ledger";
import { BOOK_PAGES, actAt } from "../src/config/pageSpecs";
import { BOOK_TEXT } from "../src/config/bookText";
import { MOTION } from "../src/config/bookMotion";
import { auditMotion } from "../src/camera/audit";
import { STEADY_RANGES, steadyGain as cameraSteadyGain } from "../src/camera/operator";
import { authoredAt, cameraAt } from "../src/camera/path";
import { PLATE_MATCH, photoToScreen } from "../src/plate/PlateFollow";
import { projectDesk } from "../src/plate/plateCamera";
import { poseEuler } from "../src/book/geometry";
import { steadyGain as bookSteadyGain } from "../src/book/rig/hold";
import { closeFrames, coverAngleAt } from "../src/book/rig/cover";
import { liftTimes } from "../src/book/rig/lift";
import { riffleFrames } from "../src/book/rig/riffle";
import { setDownTimes } from "../src/book/rig/setDown";
import { turnFrames } from "../src/book/rig/turn";
import { dustSources } from "../src/scene/dustField";
import { booksAliveInAct } from "../src/paint/spread";
import { qrMatrix } from "../src/paint/qr";
import { PAGE_PX_PER_CM } from "../src/config/pages";
import { planBook } from "../src/paint/pages";
import { getQrTargets } from "../src/data/select";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, shotById } from "../src/shots";
import { eq, near, test, throws, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const ids = ["S16", "S17", "S18", "S19", "S20", "S21"] as const;
const LOCKER = BOOKS.minilocker;
const S = BOOK_SCRIPT.minilocker!;
const TURNS = S.turns;
const RIFFLE = TURNS.find((t) => t.riffle)!;
const FILM_TURN = TURNS.find((t) => !t.riffle && (t.dir ?? 1) === 1)!;
const BACK = TURNS.find((t) => t.dir === -1)!;
const DOWN = setDownTimes("minilocker", S.setDown.start, S.setDown.speed);

/** MiniLocker, open, through the film's camera (without the operator): the spread's box on screen, the page's angle to the camera, pixels per cm on the page. */
function measure(frame: number): { x0: number; x1: number; y0: number; y1: number; angleDeg: number; pxPerCm: number } {
  const W = LOCKER.trimW;
  const H = LOCKER.trimH;
  const T = LOCKER.spine + 2 * LOCKER.board;
  const st = getBookState("minilocker", frame)!;
  const view = cameraAt(frame, { operator: false }).view;
  const mat = new THREE.Matrix4().makeRotationFromEuler(poseEuler(st.pose));
  const screen = (local: THREE.Vector3): { x: number; y: number } => {
    const q = local.clone().applyMatrix4(mat);
    const pl = projectDesk(PLATE_MATCH, q.x + st.pose.position[0], q.y + st.pose.position[1], -(q.z + st.pose.position[2]));
    return photoToScreen(view, pl.x, pl.y);
  };
  const th = st.coverAngle * Math.PI;
  const xp = -W / 2;
  const ym = T / 2;
  const pts: THREE.Vector3[] = [];
  for (const x of [-W / 2, W / 2])
    for (const z of [-H / 2, H / 2]) {
      pts.push(new THREE.Vector3(x, 0, z));
      for (const y of [T - LOCKER.board, T]) pts.push(new THREE.Vector3(xp + (x - xp) * Math.cos(th) - (y - ym) * Math.sin(th), ym + (x - xp) * Math.sin(th) + (y - ym) * Math.cos(th), z));
    }
  const o = pts.map(screen);
  const centre = new THREE.Vector3(0, T, 0).applyMatrix4(mat).add(new THREE.Vector3(...st.pose.position));
  const normal = new THREE.Vector3(0, 1, 0).applyMatrix4(mat);
  const ray = new THREE.Vector3(PLATE_MATCH.camXCm, PLATE_MATCH.camHeightCm, PLATE_MATCH.camDistCm).sub(centre).normalize();
  const a = screen(new THREE.Vector3(-0.5, T, 0));
  const b = screen(new THREE.Vector3(0.5, T, 0));
  return {
    x0: Math.min(...o.map((p) => p.x)),
    x1: Math.max(...o.map((p) => p.x)),
    y0: Math.min(...o.map((p) => p.y)),
    y1: Math.max(...o.map((p) => p.y)),
    angleDeg: (Math.acos(Math.min(1, normal.dot(ray))) * 180) / Math.PI,
    pxPerCm: Math.hypot(a.x - b.x, a.y - b.y),
  };
}

// ---------- the camera ----------

test("patch 18: S16-S21 are on the table's frames, own their keys (one shot each, on beats, in R3, no roll, no tilt), and the film's camera ends on 3960", () => {
  eq(`${SHOTS[16].from}-${SHOTS[21].to}`, "3000-3959");
  const frames = Object.fromEntries(ids.map((id) => [id, shotById(id).camera.map((k) => k.frame)]));
  eq(JSON.stringify(frames), JSON.stringify({ S16: [3120], S17: [3180, 3300], S18: [3360], S19: [3480, 3510, 3570, 3630], S20: [3810], S21: [3870, 3900, 3960] }));
  for (const id of ids) for (const k of shotById(id).camera) {
    eq(k.frame % BEAT, 0, `${id} key ${k.frame}`);
    eq(k.rollDeg, 0, `${id} key ${k.frame}: no roll`);
    eq(k.tiltDeg, 0, `${id} key ${k.frame}: no tilt`);
    truthy(k.regime === "R3" || k.regime === "R3/2", `${id} key ${k.frame} is R3 (or R3/2)`);
  }
  eq(FILM_CAMERA_KEYFRAMES[FILM_CAMERA_KEYFRAMES.length - 1].frame, 3960, "the film's camera ends on the first frame of S22");
  eq(JSON.stringify(stateOf(shotById("S21").camera[2])), JSON.stringify(HERO_STATES.set), "S21 ends on the pile view S22 starts from");
});

test("patch 18: the camera starts from the pile view, hands over to the lift view on 3120 (as S04), reaches the hero and open views, then the block view and the QR view", () => {
  near(authoredAt(3000).state.M, VIEW_SET.M, 1e-9);
  near(authoredAt(3120).state.M, HERO_STATES.lift.M, 1e-9);
  near(authoredAt(3120).state.focusCm, 30, 1e-9);
  near(authoredAt(3120).state.aperture, 2, 1e-9);
  near(authoredAt(3360).state.M, HERO_STATES.hero.M, 1e-9);
  near(authoredAt(3360).state.panY, HERO_STATES.hero.panY, 1e-9);
  near(authoredAt(3480).state.M, HERO_STATES.open.M, 1e-9);
  near(authoredAt(3510).state.M, HERO_STATES.open.M, 1e-9, "a rest of 30 frames on the open view");
  near(authoredAt(3570).state.M, HERO_STATES.block.M, 1e-9);
  near(authoredAt(3810).state.M, HERO_STATES.links.M, 1e-9);
  near(authoredAt(3810).state.panY, HERO_STATES.links2.panY, 1e-9);
  near(authoredAt(3960).state.M, 4.63, 1e-9, "the table's M for the end of S21 (R2 again)");
  near(authoredAt(3630).state.focusCm, 28, 1e-6, "the focus is racked to the table's 28 over the first 60 frames of the push");
  for (let f = 3000; f <= 3960; f += 15) {
    eq(authoredAt(f).state.rollDeg, 0, `roll at ${f}`);
    eq(authoredAt(f).state.tiltDeg, 0, `tilt at ${f}`);
  }
});

test("patch 18: the audit is clean for frames 3000-3959 with no exception, the limits of R3 hold, and the whole film is clean but for the opening hold", () => {
  const r = auditMotion({ from: 3000, to: 3959, exceptions: [] });
  eq(r.findings.length, 0, JSON.stringify(r.findings));
  const all = auditMotion();
  eq(all.range.join("-"), "0-3959");
  eq(all.unexplained, 0, JSON.stringify(all.findings.filter((f) => !f.known)));
  eq(all.counts.STILL, 1, "only the documented opening hold");
  const lim = limitFor("R3");
  truthy(r.stats.peakLateralCmPerSec <= lim.lateralCmPerSec, `sideways ${r.stats.peakLateralCmPerSec} cm/s`);
  truthy(r.stats.peakMRatePerSec <= 1.5, `M rate ${r.stats.peakMRatePerSec}`);
  truthy(r.stats.peakPopFraction < 0.02, "no pop");
  truthy(r.stats.maxM <= lim.maxM, `largest M ${r.stats.maxM}`);
});

test("patch 18: the push of S19-S20 grows M 12 percent from the block view to the QR view without a stop, and the glide of S21 only starts to pull back inside the QR hold", () => {
  let prev = authoredAt(3570).state.M;
  for (let f = 3571; f <= 3810; f++) {
    const m = authoredAt(f).state.M;
    truthy(m > prev, `M grows on ${f}`);
    prev = m;
  }
  // at the last frame the QR page is uncovered (3833) M has fallen under 2 percent from its largest
  truthy(authoredAt(3833).state.M > HERO_STATES.links.M * 0.98, `M on 3833 is ${authoredAt(3833).state.M}`);
  let max = 0;
  for (let f = 3000; f < 3960; f++) max = Math.max(max, authoredAt(f).state.M);
  truthy(max <= limitFor("R3").maxM, `largest M ${max}`);
});

// ---------- the book's script ----------

test("patch 18: the ledger: MiniLocker is in the hand from 3000 to 3839 and beside the pile from 3840, MiniMe stays beside, SPHEREx is alone in the pile", () => {
  eq(getBookLocation("minilocker", 2999), "pile");
  eq(getBookLocation("minilocker", 3000), "hand");
  eq(getBookLocation("minilocker", 3839), "hand");
  eq(getBookLocation("minilocker", 3840), "beside");
  eq(getBookLocation("minilocker", 3959), "beside");
  eq(JSON.stringify(booksAt(3500).pile), JSON.stringify(["spherex-blink"]));
  eq(JSON.stringify(booksAt(3959).beside.sort()), JSON.stringify(["mini-me", "minilocker"]));
  eq(S.lift.start, 3000);
  eq(S.setDown.start, 3840);
});

test("patch 18: the lift is S04's at a speed of 1.3: the press on 3000, the rise ends on 3065, settled by 3100, all inside S16", () => {
  const t = liftTimes("minilocker", S.lift.start, S.lift.speed);
  eq(t.riseStart, 3006);
  eq(t.riseEnd, 3065);
  truthy(t.settled <= 3119, `settled on ${t.settled}`);
  truthy(t.riseFrames < liftTimes("mini-me", 960).riseFrames, "faster than Mini Me's");
  near(getBookPose("minilocker", 2999)!.position[1], 2.4, 1e-9, "MiniLocker lies on SPHEREx (2.4 cm) until the press");
});

test("patch 18: the cover opens on 3360, straight onto the colophon and the title page, and there is no turn in S18", () => {
  const ev = coverEventsOf("minilocker");
  eq(ev[0].kind, "open");
  eq(ev[0].start, 3360);
  eq(coverAngleAt(3359, ev), 0);
  truthy(coverAngleAt(3419, ev) > 0.9, "open and settling by 3419");
  eq(TURNS.filter((t) => t.start >= 3360 && t.start < 3480).length, 0, "no turn in S18");
  for (const f of [3400, 3430, 3470, 3509]) eq(JSON.stringify(faceIndices(f, TURNS)), JSON.stringify({ left: 0, right: 1 }), `frame ${f}`);
  eq(BOOK_PAGES.minilocker[0].type, "P-COLO");
  eq(BOOK_PAGES.minilocker[1].type, "P-TITLE");
});

test("patch 18: one short riffle of 10 sheets, 56 frames from 3510 to the last landing on 3566, to the middle of the block (48 of 112) and the gallery spread", () => {
  const f = riffleFrames({ start: RIFFLE.start, count: RIFFLE.riffle, ...RIFFLE.pace });
  eq(RIFFLE.start, 3510);
  eq(RIFFLE.riffle, 10);
  eq(f.total, 56);
  eq(f.last, 3566);
  truthy(f.total < 110 / 1.3, "shorter than Mini Me's riffle by more than the 30 percent");
  eq(BOOKS.minilocker.pages / 2, 112);
  near(turnedAt(3509, TURNS), 0, 1e-9);
  near(turnedAt(3566, TURNS), 48, 1e-9, "the middle of the block (a little under: 48 of 112)");
  near(turnedAt(3689, TURNS), 48, 1e-9);
  eq(JSON.stringify(faceIndices(3566, TURNS)), JSON.stringify({ left: 2, right: 3 }), "the gallery spread");
  for (let g = 3510; g < 3566; g++) {
    const a = turnedAt(g - 1, TURNS);
    const b = turnedAt(g, TURNS);
    truthy(b >= a && b - a < 8, `the stacks never jump (${g}: ${a} to ${b})`);
  }
  eq(airSheetsAt(3700, TURNS).filter((s) => s.place.count === 10).length, 0, "no riffle sheet is left in the air after the flutter");
  const air = airSheetsAt(3530, TURNS).filter((s) => s.place.count === 10);
  truthy(air.length > 0, "the sheets of the riffle are drawn as a group of 10");
  truthy(airSheetsAt(3512, TURNS)[0].front === 1, "the first sheet carries the title page it starts from");
  throws(() => checkTurns("x", [{ start: 100, riffle: 10, through: 10, pace: { turnFrames: 3, gapFrom: 3, gapTo: 5 } }, { start: 400, dir: -1, through: 10, leaves: 1 }]), "at least 6 frames");
  throws(() => checkTurns("x", [{ start: 100, quick: true, pace: { turnFrames: 20, gapFrom: 3, gapTo: 5 } }, { start: 300, dir: -1 }]), "only for a riffle");
});

test("patch 18: the film spread: a quick turn from 3690 lands on 3726 on the film page and the links page (pages 4 and 5); the page-back from 3816 closes the block on 0 turned", () => {
  eq(FILM_TURN.start, 3690);
  eq(FILM_TURN.quick, true);
  eq(FILM_TURN.start + turnFrames(true), 3726);
  eq(JSON.stringify(faceIndices(3726, TURNS)), JSON.stringify({ left: 4, right: 5 }));
  eq(BOOK_PAGES.minilocker[4].type, "P-FILM");
  eq(BOOK_PAGES.minilocker[5].type, "P-LINK");
  eq(stacksAt(3726, TURNS).left, 2);
  near(turnedAt(3726, TURNS), 49, 1e-9);
  eq(BACK.start, 3816);
  eq(BACK.start + turnFrames(true), 3852);
  eq(BACK.through, 49);
  eq(BACK.leaves, 2);
  near(turnedAt(3852, TURNS), 0, 1e-9);
  eq(stacksAt(3852, TURNS).left, 0);
  eq(JSON.stringify(faceIndices(3852, TURNS)), JSON.stringify({ left: 0, right: 1 }), "the colophon and the title page again");
  checkTurns("minilocker", TURNS);
  // while the chunk is in the air the right face keeps the links page, so the QR page is not swapped for the gallery's before the sheet covers it
  for (let f = 3816; f < 3834; f++) eq(faceIndices(f, TURNS).right, 5, `right face on ${f}`);
  for (let f = 3500; f < 3960; f++) {
    const a = faceIndices(f, TURNS);
    if (!(f >= 3510 && f < 3567)) truthy(a.left !== BLANK_PAGE && a.right !== BLANK_PAGE, `frame ${f}: a blank face outside the riffle`);
  }
});

test("patch 18: the close: the board starts on 3846 as the chunk lands, lands on 3884 (38 frames), has settled before the touch on 3900", () => {
  const ev = coverEventsOf("minilocker");
  const close = ev.find((e) => e.kind === "close")!;
  eq(close.start, 3846);
  eq(closeFrames(close.opts), 38);
  truthy(close.start >= BACK.start + turnFrames(true) - 6, "the board does not start before the sheet is nearly down");
  near(coverAngleAt(3884, ev), 0, 1e-12);
  for (let f = 3885; f <= 3900; f++) truthy(Math.abs(coverAngleAt(f, ev)) < 0.01, `rebound at ${f}`);
  truthy(close.start + closeFrames(close.opts) + MOTION.settleFrames.max < DOWN.contact, "the cover is done before the book touches");
  eq(stacksAt(3846, TURNS).left, 0);
});

test("patch 18: the set-down: the carry starts on 3840, the book touches on 3900 (beat 130), rests on 3912, never goes through the desk, touches at 8 cm/s or less", () => {
  eq(DOWN.start, 3840);
  eq(DOWN.contact, 3900);
  eq(DOWN.contact % BEAT, 0);
  eq(DOWN.contact - DOWN.start, 60);
  truthy(DOWN.rest - DOWN.contact >= MOTION.settleFrames.min && DOWN.rest - DOWN.contact <= 12);
  const y = (f: number) => getBookPose("minilocker", f)!.position[1];
  near(y(DOWN.contact), 0, 1e-9);
  eq(JSON.stringify(getBookPose("minilocker", DOWN.rest)), JSON.stringify(getBookPose("minilocker", DOWN.rest + 100)), "no motion after the settle");
  const speed = (y(DOWN.contact - 1) - y(DOWN.contact)) * 60;
  truthy(speed > 0 && speed <= 8, `touch speed ${speed.toFixed(2)} cm/s`);
  let low = 0;
  let high = 0;
  for (let f = DOWN.start; f <= DOWN.rest + 60; f++) low = Math.min(low, y(f));
  for (let f = DOWN.contact + 1; f <= DOWN.rest; f++) high = Math.max(high, y(f));
  truthy(low > -0.05, `never through the desk (${low})`);
  truthy(high <= MOTION.setDown.reboundCm + 1e-3, `rebound ${high} cm`);
});

test("patch 18: the carry starts from the hold without a jump: the sway stays off through the last frame of the steady range and comes back over the blend", () => {
  const a = getBookPose("minilocker", 3839)!;
  const b = getBookPose("minilocker", 3840)!;
  const c = getBookPose("minilocker", 3841)!;
  const d = (p: typeof a, q: typeof a): number => Math.hypot(p.position[0] - q.position[0], p.position[1] - q.position[1], p.position[2] - q.position[2]);
  truthy(d(a, b) < 0.02, `3839 to 3840 moves ${d(a, b)} cm`);
  truthy(d(b, c) < 0.1, `3840 to 3841 moves ${d(b, c)} cm`);
  near((b.pitchDeg ?? 0) - (a.pitchDeg ?? 0), 0, 0.05, "no turn at the hand-over");
  near(b.pitchDeg ?? 0, 80, 1e-6, "the carry starts from the reading pitch");
  near(b.yawDeg ?? 0, 0, 1e-6);
  // Mini Me's carry, which is outside every steady range, is exactly what it was
  eq(bookSteadyGain(2900), 1);
});

// ---------- the hero tracks ----------

test("patch 18: the orbit of S17 starts after the lift settled, crosses yaw 0 on 3240 (beat 108), is square again before the cover opens; the tilt and the raising follow S19's riffle", () => {
  const settled = liftTimes("minilocker", 3000, 1.3).settled;
  truthy(3124 >= settled, "the lift's overshoot is over before the orbit starts");
  for (let f = 2880; f <= 3124; f += 12) eq(heroOffsetAt(f).yawDeg, 0, `yaw at ${f}`);
  near(trackAt(HERO.yaw, 3182), -8, 1e-9);
  near(trackAt(HERO.yaw, 3240), 0, 1e-9);
  near(trackAt(HERO.yaw, 3298), 8, 1e-9);
  near(trackAt(HERO.yaw, 3356), 0, 1e-9);
  eq(HERO.specularFrameBook2, 3240);
  eq(3240 % BEAT, 0);
  truthy(heroOffsetAt(3241).yawDeg > heroOffsetAt(3239).yawDeg, "it crosses 3240 moving the way Mini Me's sweep does");
  for (let f = 2880; f <= 3360; f += 20) eq(heroOffsetAt(f).pitchDeg, 0, `no tilt before the cover opens (${f})`);
  near(trackAt(HERO.pitch, 3450), -10, 1e-9);
  near(trackAt(HERO.pitch, 3510), -10, 1e-9);
  near(trackAt(HERO.pitch, 3570), 7, 1e-9);
  near(trackAt(HERO.yaw, 3570), 3.5, 1e-9);
  for (let f = 3570; f <= 3816; f += 6) {
    near(trackAt(HERO.pitch, f), 7, 1e-9, `pitch at ${f}`);
    near(trackAt(HERO.yaw, f), 3.5, 1e-9, `yaw at ${f}`);
  }
  near(heroOffsetAt(3840).pitchDeg, 0, 1e-9);
  near(heroOffsetAt(3840).yawDeg, 0, 1e-9);
  for (const f of [3840, 3900, 3959, 4000, 5399]) eq(heroOffsetAt(f).pitchDeg + heroOffsetAt(f).yawDeg, 0, `no hero motion at ${f}`);
});

test("patch 18: the held book never moves 1.2 cm or turns 0.6 degrees in a frame from the settled lift to the carry", () => {
  let worst = 0;
  for (let f = 3101; f < 3840; f++) {
    const a = getBookPose("minilocker", f - 1)!;
    const b = getBookPose("minilocker", f)!;
    worst = Math.max(worst, Math.abs((b.pitchDeg ?? 0) - (a.pitchDeg ?? 0)), Math.abs((b.yawDeg ?? 0) - (a.yawDeg ?? 0)));
    truthy(Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]) < 1.2, `frame ${f}: the book moves under 1.2 cm`);
  }
  truthy(worst < 0.6, `the book turns ${worst.toFixed(3)} degrees in one frame at most`);
});

test("patch 18: the hand's sway is off for S20: the book does not change from 3570 to 3816, the steady ranges of the book and of the camera are the same two shots", () => {
  eq(MOTION.steady.ranges.length, 2);
  eq(MOTION.steady.ranges[1].from, SHOTS[20].from);
  eq(MOTION.steady.ranges[1].to, SHOTS[20].to);
  eq(STEADY_RANGES.some((r) => r.from === 3720 && r.to === 3839), true, "the camera has the same range");
  eq(bookSteadyGain(3600), 1);
  eq(bookSteadyGain(3720), 0);
  eq(bookSteadyGain(3839), 0);
  eq(bookSteadyGain(3840 + 12), 1);
  eq(cameraSteadyGain(3780), 0);
  const ref = getBookPose("minilocker", 3732)!;
  for (let f = 3732; f <= 3815; f++) {
    const p = getBookPose("minilocker", f)!;
    for (let i = 0; i < 3; i++) near(p.position[i], ref.position[i], 1e-9, `position ${i} at ${f}`);
    near(p.pitchDeg ?? 0, ref.pitchDeg ?? 0, 1e-9, `pitch at ${f}`);
    near(p.yawDeg ?? 0, ref.yawDeg ?? 0, 1e-9, `yaw at ${f}`);
    near(p.rollDeg ?? 0, 0, 1e-9, `roll at ${f}`);
  }
  near(ref.pitchDeg ?? 0, 87, 1e-9, "upright: 80 + 7");
  let prev = bookSteadyGain(3690);
  for (let f = 3691; f < 3900; f++) {
    const g = bookSteadyGain(f);
    truthy(Math.abs(g - prev) < 0.2, `frame ${f}: the sway is never switched on or off`);
    prev = g;
  }
});

// ---------- the readable spreads ----------

test("patch 18: the three must-read spreads are on screen at least 120 frames: the title spread, the gallery, and the film page with the links page", () => {
  const open = (f: number): boolean => coverAngleAt(f, coverEventsOf("minilocker")) >= 0.5;
  // title spread: from the board passing vertical to the first riffle sheet covering the right page (it is vertical about 12 frames after it starts)
  let t0 = 3360;
  while (!open(t0)) t0++;
  const title = 3510 + 12 - t0;
  // gallery: from the last landing to the film turn's sheet passing vertical
  const gallery = FILM_TURN.start + turnFrames(true) / 2 - riffleFrames({ start: RIFFLE.start, count: RIFFLE.riffle, ...RIFFLE.pace }).last;
  // film page and links page: from the sheet vertical to the page-back sheet vertical
  const film = BACK.start + turnFrames(true) / 2 - (FILM_TURN.start + turnFrames(true) / 2);
  truthy(title >= 120 && gallery >= 120 && film >= 120, `title ${title}, gallery ${gallery}, film ${film} frames`);
  for (let f = 3360; f < 3840; f++) eq(authoredAt(f).state.rollDeg, 0, `roll at ${f}`);
});

test("patch 18: the spread stays inside the frame from the open book to the carry and keeps its margins", () => {
  for (let f = 3420; f <= 3830; f += 30) {
    const b = measure(f);
    truthy(b.x0 > 200 && b.x1 < WIDTH - 200 && b.y0 > 100 && b.y1 < HEIGHT - 100, `frame ${f}: the spread (${Math.round(b.x0)}-${Math.round(b.x1)} x ${Math.round(b.y0)}-${Math.round(b.y1)}) keeps its margins`);
  }
  for (let f = 3570; f <= 3830; f += 30) truthy(Math.abs((measure(f).y0 + measure(f).y1) / 2 - HEIGHT / 2) < 160, `frame ${f}: the spread is near the middle of the frame's height`);
});

// ---------- the QR hold ----------

test("patch 18: the QR hold: the page is square-on within 4 degrees, uncovered, flat and steady, for at least 90 consecutive frames (3726 to 3833)", () => {
  let run = 0;
  let best = 0;
  let from = 0;
  for (let f = 3690; f < 3860; f++) {
    const fa = faceIndices(f, TURNS);
    const m = measure(f);
    const sheetsOverQr = airSheetsAt(f, TURNS).some((s) => (s.progress < 0.5 && s.place.count === 1 && s.front === 5) || (s.progress < 0.5 && s.front === 3 && s.index < 49 && f >= BACK.start));
    const steady = bookSteadyGain(f) === 0 && cameraSteadyGain(f) < 1e-9;
    const pose = getBookPose("minilocker", f)!;
    const ok = f >= FILM_TURN.start + turnFrames(true) && fa.right === 5 && m.angleDeg <= 4 && Math.abs(pose.rollDeg ?? 0) < 1e-9 && steady && !sheetsOverQr && f < BACK.start + turnFrames(true) / 2;
    if (ok && run === 0) from = f;
    run = ok ? run + 1 : 0;
    if (run > best) best = run;
    void from;
  }
  truthy(best >= 90, `the hold lasts ${best} frames`);
  for (let f = 3732; f <= 3816; f += 6) truthy(measure(f).angleDeg < 2, `frame ${f}: ${measure(f).angleDeg.toFixed(2)} degrees off square`);
  for (let f = 3730; f <= 3830; f++) {
    truthy(measure(f).angleDeg <= 6, `frame ${f}: ${measure(f).angleDeg.toFixed(2)} degrees off square inside the qr:check window`);
    eq(faceIndices(f, TURNS).right, 5, `the links page is the right face on ${f}`);
  }
  truthy(3726 + FLUTTER_SEC * 60 < 3800, "the landed sheet flutters on the left page only");
  eq(airSheetsAt(3800, TURNS).length, 0);
});

test("patch 18: a code on the links page is at least 3 pixels a module on screen through the hold, and a simulated frame decodes at that size", () => {
  const targets = getQrTargets("minilocker");
  eq(targets.length, 2);
  eq(targets.map((t) => t.url).join(" "), targets.map((t) => t.url).join(" "));
  const plan = planBook("minilocker", { spec: LOCKER, measure: (text, f) => Array.from(text).length * f.size * (f.weight === 700 ? 0.55 : 0.5), imageSize: () => ({ w: 1600, h: 1000 }) }).find((p) => p.type === "P-LINK")!;
  const codeCm = plan.qr[0].code.w / PAGE_PX_PER_CM;
  truthy(codeCm >= 3.4 && codeCm < 6, `the code is ${codeCm.toFixed(2)} cm on paper`);
  let minPx = Infinity;
  for (let f = 3732; f <= 3830; f++) minPx = Math.min(minPx, (measure(f).pxPerCm * codeCm) / qrMatrix(targets[0].url).size);
  truthy(minPx >= 3.0, `the code is ${minPx.toFixed(2)} px a module at its smallest in the hold`);
  for (const t of targets) eq(decodeSimulated(t.url, 3.0), t.url, `${t.label}: decoded at 3.0 px a module with blur and grain`);
});

/** A code drawn the way the film shows it: area-averaged to `pxPerModule`, lightly blurred, with grain; read by jsQR. Deterministic. */
function decodeSimulated(text: string, pxPerModule: number): string | null {
  const m = qrMatrix(text);
  const quiet = 4;
  const n = m.size + 2 * quiet;
  const margin = 12;
  const side = Math.ceil(n * pxPerModule) + 2 * margin;
  const SS = 6;
  const gray = new Float64Array(side * side);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      let sum = 0;
      for (let j = 0; j < SS; j++)
        for (let i = 0; i < SS; i++) {
          const mx = Math.floor((x + (i + 0.5) / SS - margin - 0.37) / pxPerModule) - quiet;
          const my = Math.floor((y + (j + 0.5) / SS - margin - 0.21) / pxPerModule) - quiet;
          const inside = mx >= 0 && my >= 0 && mx < m.size && my < m.size;
          const dark = inside && m.cells[my * m.size + mx] === 1;
          const inQuiet = mx >= -quiet && my >= -quiet && mx < m.size + quiet && my < m.size + quiet;
          sum += dark ? 22 : inQuiet ? 246 : 120;
        }
      gray[y * side + x] = sum / (SS * SS);
    }
  const out = new Uint8ClampedArray(side * side * 4);
  let seed = 12345;
  const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const at = (xx: number, yy: number): number => gray[Math.min(side - 1, Math.max(0, yy)) * side + Math.min(side - 1, Math.max(0, xx))];
      const blur = 0.6 * at(x, y) + 0.1 * (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1));
      const v = Math.max(0, Math.min(255, blur + 6 * rnd()));
      out.set([v, v, v, 255], (y * side + x) * 4);
    }
  return jsQR(out, side, side)?.data ?? null;
}

// ---------- the pages, the screenshots, the cues, the files ----------

test("patch 18: the gallery shows the four cropped screenshots, never a raw capture: every file is a crop made by `npm run screens`, with a caption of 8 words or fewer", () => {
  const shots = BOOK_TEXT.minilocker.screenshots;
  eq(shots.length, 4);
  eq(JSON.stringify(BOOK_PAGES.minilocker[2].shots), JSON.stringify([0, 1]));
  eq(JSON.stringify(BOOK_PAGES.minilocker[3].shots), JSON.stringify([2, 3]));
  const script = read("scripts/crop-screens.mjs");
  const raw = ["attacklab_complete.png", "session.png", "fix_repo_complete.png", "attacklab_running_state.png"];
  for (const s of shots) {
    const name = s.file.replace("screens/", "");
    truthy(script.includes(`to: "${name}"`), `${name} is written by scripts/crop-screens.mjs`);
    truthy(!raw.some((r) => s.file.endsWith(`/${r}`)), `${s.file} is a crop, not a raw capture`);
    truthy(s.caption.trim().split(/\s+/).length <= 8, `caption of ${s.file} is 8 words or fewer`);
  }
  for (const r of raw) truthy(script.includes(`from: "minilocker/${r}"`), `the crop of ${r} is in the script`);
  eq(new Set(shots.map((s) => s.file)).size, 4);
});

test("patch 18: MiniLocker's pages are alive in Act 6 (frames 3000-3959) and only then; Mini Me's are freed there", () => {
  eq(actAt(3000), 6);
  eq(actAt(3959), 6);
  eq(booksAliveInAct(6).join(","), "minilocker");
  truthy(actAt(2999) === 5 && booksAliveInAct(5).join(",") === "mini-me");
});

test("patch 18: the cues follow the audio cue sheet (the shifts are written down), are named, in order, inside their shot, and the film's list has them in frame order", () => {
  const by = (id: string) => shotById(id).cues.map((c) => `${c.frame}:${c.name}`).join(",");
  eq(by("S16"), "3000:cover-board-thud,3030:cloth-on-cloth");
  eq(by("S17"), "");
  eq(by("S18"), "3360:cover-open", "guide 08: cover-open on 3360");
  eq(by("S19"), "3510:riffle,3570:paper-settle,3690:page-turn", "the riffle starts 30 frames after the sheet's 3480 (the title spread must be read), paper-settle on the beat after the last landing");
  eq(by("S20"), "3816:riffle");
  eq(by("S21"), "3846:cover-close,3898:book-set", "book-set is two frames before the touch on 3900");
  eq(DOWN.contact - 3898, 2);
  const mine = FILM_CUES.filter((c) => c.frame >= 3000 && c.frame < 3960);
  for (let i = 1; i < mine.length; i++) truthy(mine[i].frame >= mine[i - 1].frame, "frame order");
  for (const c of mine) if (![3816, 3846, 3898].includes(c.frame)) eq(c.frame % BEAT, 0, `cue ${c.name} on ${c.frame} is on a beat`);
  eq(RIFFLE.start, 3510, "the flutter starts with the riffle");
  truthy(FILM_CUES.filter((c) => c.name === "page-turn" && c.frame >= 3000).every((c) => TURNS.some((t) => t.start === c.frame && !t.riffle)), "every page-turn cue is a turn of the script");
});

test("patch 18: the dust is stirred by the lift (3006), the close (on its landing, 3884) and the touch (3900)", () => {
  const src = dustSources().filter((s) => s.frame >= 3000 && s.frame < 3960);
  eq(src.map((s) => s.frame).join(","), "3006,3884,3900");
});

test("patch 18: the shot files do not place a book, load a page or type a frame range, and the film page never plays", () => {
  for (const id of ids) {
    const src = read(`src/shots/${id}.tsx`);
    truthy(src.includes(`defineShot("${id}"`), `${id} is made by defineShot`);
    truthy(!/useFrame|new THREE|localStorage|Math\.random/.test(src), `${id} places nothing and uses no randomness`);
  }
  const pages = read("src/paint/pages/render.ts");
  truthy(!/<video|HTMLVideoElement|currentTime/.test(pages), "the film page is a still");
});
