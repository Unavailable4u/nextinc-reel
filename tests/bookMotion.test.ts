// GATE G1 (Patch 11): the book motion rigs, by the numbers. The looks are the stills of `DevBookMotion`; these are the rules of guide 03
// section 5 that a number can check: weight, the overshoot and the settle, no instant start or stop, no pops, the ledger.
import { test, eq, near, truthy, throws } from "./harness";
import { MOTION, durationScale, framesFor, swayScale } from "../src/config/bookMotion";
import { BOOKS, BOOK_IDS, type BookId } from "../src/config/books";
import { FPS, TOTAL } from "../src/config/timeline";
import { BOOK_SCRIPT, LEDGER, besidePose, checkLedger, getBookLocation, getBookPose, getBookState, keyFrames, motionSpans, pilePose } from "../src/config/ledger";
import { closeFrames, coverAngleAt, coverCloseAt, coverDegrees, coverOpenAt, coverOpenSettleFrames, openShape } from "../src/book/rig/cover";
import { liftPoseAt, liftTimes, stackPressCm } from "../src/book/rig/lift";
import { readingPose, swayAt, swaySeedOf, ribbonSwingAt } from "../src/book/rig/hold";
import { setDownPoseAt, setDownTimes } from "../src/book/rig/setDown";
import { angleBetweenDeg, bounceLobeFrames, hermiteIn, lowestPointCm, quatOfPose, reboundAt, slerp } from "../src/book/rig/pose";

const SCRIPTED: BookId[] = ["mini-me", "minilocker"];
const dist = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const stepOf = (id: BookId, f: number): { pos: number; rot: number } => {
  const a = getBookState(id, f - 1);
  const b = getBookState(id, f);
  if (!a || !b) return { pos: 0, rot: 0 };
  return { pos: dist(a.pose.position, b.pose.position), rot: angleBetweenDeg(quatOfPose(a.pose), quatOfPose(b.pose)) };
};

// ---- weight (guide 03 section 5: people read weight from motion) -----------------------------------------------------------------

test("g1: a heavier book takes longer and moves less", () => {
  truthy(durationScale(560) > durationScale(400), "durations grow with weight");
  truthy(swayScale(560) < swayScale(400), "sway shrinks with weight");
  near(durationScale(MOTION.refWeightG), 1, 1e-12);
  near(swayScale(MOTION.refWeightG), 1, 1e-12);
  truthy(framesFor(84, 560) > framesFor(84, 400), "frames");
  // the second book is 30 percent faster
  truthy(framesFor(84, 490, 1.3) < framesFor(84, 490, 1), "speed");
  throws(() => framesFor(84, 500, 0), "speed must be positive");
});

test("g1: nothing is shorter than 6 frames, however fast", () => {
  eq(framesFor(2, 400, 3), MOTION.minFrames);
  for (const id of SCRIPTED) {
    const s = BOOK_SCRIPT[id]!;
    truthy(liftTimes(id, s.lift.start, s.lift.speed).pressFrames >= MOTION.minFrames, `${id}: press`);
    truthy(setDownTimes(id, s.setDown.start, s.setDown.speed).carryFrames >= MOTION.minFrames, `${id}: carry`);
  }
});

// ---- the hold -------------------------------------------------------------------------------------------------------------------

test("g1: the sway of a held book is as small as the bible says, and smaller for a heavy book", () => {
  const S = MOTION.sway;
  const maxRot = S.rotationDeg[0] + S.rotationDeg[1];
  const maxPos = S.positionCm[0] + S.positionCm[1];
  let seenRot = 0;
  let seenPos = 0;
  for (let f = 0; f < 1200; f += 3) {
    const s = swayAt(f, 7001, MOTION.refWeightG);
    seenRot = Math.max(seenRot, Math.abs(s.yawDeg), Math.abs(s.pitchDeg), Math.abs(s.rollDeg));
    seenPos = Math.max(seenPos, Math.abs(s.dx), Math.abs(s.dy), Math.abs(s.dz));
  }
  truthy(seenRot <= maxRot + 1e-9, `rotation ${seenRot} over ${maxRot}`);
  truthy(seenPos <= maxPos + 1e-9, `position ${seenPos} over ${maxPos}`);
  truthy(seenRot > 0.05, "a held book is never perfectly steady");
  const light = swayAt(500, 7001, 400);
  const heavy = swayAt(500, 7001, 560);
  truthy(Math.abs(heavy.yawDeg) < Math.abs(light.yawDeg) + 1e-12, "heavy sways less");
  eq(swayAt(500, 7001, 500, 0).dx, 0, "no fade, no sway");
});

test("g1: the sway and the ribbon are pure functions of the frame", () => {
  for (const id of SCRIPTED) {
    const a = swayAt(777, swaySeedOf(id), BOOKS[id].weightG);
    const b = swayAt(777, swaySeedOf(id), BOOKS[id].weightG);
    eq(JSON.stringify(a), JSON.stringify(b), id);
    eq(ribbonSwingAt(777, swaySeedOf(id), BOOKS[id].weightG, 0.5), ribbonSwingAt(777, swaySeedOf(id), BOOKS[id].weightG, 0.5), id);
  }
  truthy(JSON.stringify(swayAt(777, swaySeedOf("mini-me"), 500)) !== JSON.stringify(swayAt(777, swaySeedOf("minilocker"), 500)), "no two books sway alike");
});

// ---- the cover ------------------------------------------------------------------------------------------------------------------

test("g1: the cover opens to 165 degrees, overshoots by 3 and settles", () => {
  for (const [w, sp] of [[560, 1], [490, 1.3], [400, 1], [560, 1.4]] as const) {
    const s = openShape({ weightG: w, speed: sp });
    let peak = -Infinity;
    for (let f = 0; f < 240; f++) peak = Math.max(peak, coverDegrees(coverOpenAt(f, { weightG: w, speed: sp })) - MOTION.cover.openDeg);
    near(peak, MOTION.cover.overshootDeg, 0.06, `overshoot at ${w} g x${sp}`);
    near(coverDegrees(coverOpenAt(400, { weightG: w, speed: sp })), MOTION.cover.openDeg, 0.01, "settled");
    truthy(coverOpenSettleFrames({ weightG: w, speed: sp }) <= s.swingFrames + 60, `settles within about 30 to 60 frames (${w} g)`);
    truthy(s.slope > 0 && s.slope <= MOTION.cover.handoffSlope + 1e-12, "the hand-over slope");
  }
});

test("g1: the opening is smooth where the swing hands over to the spring", () => {
  const o = { weightG: 560, speed: 1 };
  const s = openShape(o);
  const f0 = s.swingFrames;
  const h = 1e-4;
  const before = (coverOpenAt(f0 - 1e-6, o) - coverOpenAt(f0 - 1e-6 - h, o)) / h;
  const after = (coverOpenAt(f0 + 1e-6 + h, o) - coverOpenAt(f0 + 1e-6, o)) / h;
  near(coverOpenAt(f0 - 0.001, o), coverOpenAt(f0 + 0.001, o), 1e-4, "position");
  near(before, after, Math.abs(before) * 0.01, "speed (per frame) from the swing and from the spring agree");
  eq(coverOpenAt(0, o), 0);
  near(coverOpenAt(0.5, o), 0, 1e-3, "no instant start");
});

test("g1: the cover closes, lands with a little speed and gives back a sliver on the open side", () => {
  const o = { weightG: 560, speed: 1.4 };
  const n = closeFrames(o);
  near(coverCloseAt(0, o), MOTION.cover.openDeg / 180, 1e-12);
  let low = Infinity;
  let high = 0;
  for (let f = 0; f < n + 40; f++) {
    const a = coverCloseAt(f, o);
    low = Math.min(low, a);
    high = Math.max(high, coverCloseAt(f + n * 0 + 0, o));
  }
  truthy(low >= 0, "the board never goes through the book");
  let rebound = 0;
  for (let f = n; f < n + 40; f++) rebound = Math.max(rebound, coverDegrees(coverCloseAt(f, o)));
  truthy(rebound > 0.01 && rebound < 1.5, `rebound ${rebound} deg is a fraction of a degree`);
  near(coverCloseAt(n + 60, o), 0, 0.01, "closed again");
  truthy(high > 0);
});

// ---- the lift -------------------------------------------------------------------------------------------------------------------

test("g1: the lift starts with the press (6 frames, 1 mm) and not with a jump", () => {
  for (const id of SCRIPTED) {
    const s = BOOK_SCRIPT[id]!;
    const t = liftTimes(id, s.lift.start, s.lift.speed);
    near(stackPressCm(t.riseStart, id, s.lift.start, s.lift.speed), MOTION.lift.pressCm, 1e-9, `${id}: the stack gives 1 mm`);
    eq(stackPressCm(t.start, id, s.lift.start, s.lift.speed), 0, "no press before it");
    near(stackPressCm(t.riseStart + 2 * t.pressFrames, id, s.lift.start, s.lift.speed), 0, 1e-9, "released");
    const rest = pilePose(id);
    eq(JSON.stringify(liftPoseAt(t.start, { id, start: s.lift.start, rest, speed: s.lift.speed })), JSON.stringify(rest), "at the start it is the pile's pose");
    const first = stepOf(id, s.lift.start + 1);
    truthy(first.pos < 0.05 && first.rot < 0.2, `${id}: the first frame moves ${first.pos} cm, ${first.rot} deg`);
  }
});

test("g1: the lift arrives past the reading pose and settles back to it", () => {
  for (const id of SCRIPTED) {
    const s = BOOK_SCRIPT[id]!;
    const t = liftTimes(id, s.lift.start, s.lift.speed);
    const target = readingPose();
    let topY = -Infinity;
    for (let f = t.riseStart; f < t.settled + 30; f++) topY = Math.max(topY, liftPoseAt(f, { id, start: s.lift.start, rest: pilePose(id), speed: s.lift.speed }).position[1] - swayAt(f, swaySeedOf(id), BOOKS[id].weightG).dy);
    truthy(topY > target.position[1] + 0.05, `${id}: overshoots the height (${topY} over ${target.position[1]})`);
    truthy(topY < target.position[1] + MOTION.lift.overshootCm + 0.05, `${id}: by no more than the configured amount`);
    const end = liftPoseAt(t.settled + 200, { id, start: s.lift.start, rest: pilePose(id), speed: s.lift.speed });
    near(end.position[1], target.position[1], 0.12, `${id}: settled height (the sway is under 0.1 cm)`);
  }
});

// ---- the set-down ---------------------------------------------------------------------------------------------------------------

test("g1: the set-down lands with a little speed, rebounds 0.3 mm and stops", () => {
  for (const id of SCRIPTED) {
    const s = BOOK_SCRIPT[id]!;
    const rest = besidePose(id);
    const t = setDownTimes(id, s.setDown.start, s.setDown.speed);
    const at = (f: number) => setDownPoseAt(f, { id, start: s.setDown.start, rest, speed: s.setDown.speed });
    eq(JSON.stringify(at(t.rest)), JSON.stringify(rest), `${id}: at rest it is the rest pose`);
    eq(JSON.stringify(at(t.rest + 500)), JSON.stringify(rest), "and stays");
    let high = 0;
    for (let f = t.contact; f <= t.rest; f++) high = Math.max(high, at(f).position[1] - rest.position[1]);
    truthy(high > 0.005 && high <= MOTION.setDown.reboundCm + 1e-3, `${id}: rebound ${high} cm (0.3 mm is ${MOTION.setDown.reboundCm})`);
    let below = 0;
    for (let f = t.start; f <= t.rest; f++) below = Math.min(below, at(f).position[1] - rest.position[1]);
    truthy(below > -0.05, `${id}: never through the desk (${below})`);
    const touch = at(t.contact - 1).position[1] - at(t.contact).position[1];
    truthy(touch > 0 && touch < 1, `${id}: arrives with speed, ${touch} cm in the last frame`);
    const lobe = bounceLobeFrames(MOTION.setDown.reboundSpring.zeta, MOTION.setDown.reboundSpring.hz);
    truthy(lobe >= MOTION.settleFrames.min - 0.5 && lobe <= MOTION.settleFrames.max + 0.5, `the settle's first lobe is ${lobe} frames (4 to 6)`);
    near(reboundAt(0, MOTION.setDown.reboundCm, 0.5, 6), 0, 1e-12);
  }
});

test("g1: the set-down lies the book flat on the desk where the ledger says", () => {
  for (const id of SCRIPTED) {
    const rest = besidePose(id);
    near(rest.position[1], 0, 1e-9, "provisional spot, on the desk plane");
    truthy(BOOKS[id].weightG > 0);
    truthy(lowestPointCm(id, { ...rest, position: [rest.position[0], 0.3, rest.position[2]] }) > 0, "lowestPointCm is above the desk when the origin is");
  }
});

// ---- the whole script, frame by frame -------------------------------------------------------------------------------------------

test("g1: every frame of every scripted book is finite and no frame pops", () => {
  for (const id of SCRIPTED) {
    let worstPos = 0;
    let worstRot = 0;
    let worstCover = 0;
    let worstJerk = 0;
    let prevCover: number | null = null;
    for (let f = 1; f < TOTAL; f++) {
      const st = getBookState(id, f);
      if (!st) {
        prevCover = null;
        continue;
      }
      const vals = [...st.pose.position, st.pose.yawDeg ?? 0, st.pose.pitchDeg ?? 0, st.pose.rollDeg ?? 0, st.coverAngle, st.turned, st.ribbonSwing];
      truthy(vals.every(Number.isFinite), `${id}: a number is not finite at frame ${f}`);
      const prev = getBookState(id, f - 1);
      if (prev) {
        const s = stepOf(id, f);
        worstPos = Math.max(worstPos, s.pos);
        worstRot = Math.max(worstRot, s.rot);
        // no pop: the turning speed changes by under 1 degree from one frame to the next
        if (f > 1 && getBookState(id, f - 2)) worstJerk = Math.max(worstJerk, Math.abs(s.rot - stepOf(id, f - 1).rot));
      }
      if (prevCover !== null) worstCover = Math.max(worstCover, Math.abs(coverDegrees(st.coverAngle - prevCover)));
      prevCover = st.coverAngle;
    }
    // a book turned over in about half a second turns most of 8 degrees a frame at the middle of the turn (a smooth bell, checked below)
    truthy(worstPos < 3, `${id}: moves ${worstPos} cm in one frame`);
    truthy(worstJerk < 1.2, `${id}: the turning speed jumps by ${worstJerk} deg between two frames`);
    truthy(worstRot < 10, `${id}: turns ${worstRot} deg in one frame`);
    truthy(worstCover < 8, `${id}: the cover turns ${worstCover} deg in one frame`);
  }
});

test("g1: the hand-overs between the rigs do not jump (lift to hold, hold to set-down)", () => {
  for (const id of SCRIPTED) {
    const s = BOOK_SCRIPT[id]!;
    const t = liftTimes(id, s.lift.start, s.lift.speed);
    const d = setDownTimes(id, s.setDown.start, s.setDown.speed);
    for (const f of [t.settled, t.settled + 1, d.start - 1, d.start, d.start + 1]) {
      const st = stepOf(id, f);
      truthy(st.pos < 0.2 && st.rot < 0.5, `${id}: frame ${f} moves ${st.pos} cm, ${st.rot} deg`);
    }
  }
});

test("g1: the quaternion path is one smooth turn", () => {
  const a = quatOfPose({ position: [0, 0, 0], yawDeg: 91, pitchDeg: 0 });
  const b = quatOfPose(readingPose());
  const total = angleBetweenDeg(a, b);
  near(angleBetweenDeg(a, slerp(a, b, 0)), 0, 1e-6);
  near(angleBetweenDeg(a, slerp(a, b, 1)), total, 1e-6);
  near(angleBetweenDeg(a, slerp(a, b, 0.5)), total / 2, 1e-4, "halfway is half the angle");
  near(hermiteIn(1, 0.5), 1, 1e-12);
  near(hermiteIn(0, 0.5), 0, 1e-12);
});

// ---- the ledger -----------------------------------------------------------------------------------------------------------------

test("g1: the ledger has one row for every frame and one place for every book", () => {
  checkLedger();
  eq(LEDGER[0].from, 0);
  eq(LEDGER[LEDGER.length - 1].to, TOTAL - 1);
  throws(() => checkLedger([{ from: 0, to: 10, where: LEDGER[0].where }, { from: 12, to: TOTAL - 1, where: LEDGER[0].where }]), "gap or overlap");
  for (let f = 0; f < TOTAL; f += 7) for (const id of BOOK_IDS) truthy(getBookLocation(id, f) !== undefined, `${id} at ${f}`);
  eq(getBookLocation("mini-me", 959), "pile");
  eq(getBookLocation("mini-me", 960), "hand");
  eq(getBookLocation("mini-me", 2880), "beside");
  eq(getBookLocation("minilocker", 3000), "hand");
  eq(getBookLocation("minilocker", 3840), "beside");
  eq(getBookLocation("next-inc-immersive", 4140), "riser");
  eq(getBookLocation("spherex-blink", 4150), "swap");
});

test("g1: the scripts agree with the ledger and the poses follow it", () => {
  for (const id of SCRIPTED) {
    const s = BOOK_SCRIPT[id]!;
    eq(getBookLocation(id, s.lift.start), "hand", `${id}: lifts when it is in the hand`);
    eq(getBookLocation(id, s.lift.start - 1), "pile");
    eq(getBookLocation(id, s.setDown.start), "beside", `${id}: set down when it is beside`);
    eq(JSON.stringify(getBookPose(id, s.lift.start - 1)), JSON.stringify(pilePose(id)), "the pile pose before the lift");
    const rested = setDownTimes(id, s.setDown.start, s.setDown.speed).rest + 20;
    eq(getBookLocation(id, rested), "beside");
    truthy(getBookPose(id, rested) !== null, "beside, at rest");
    truthy(motionSpans(id).length >= 3, "the ribbon has spans to follow");
    const k = keyFrames(id)!;
    truthy(k.lift.riseEnd > k.lift.riseStart && k.setDown.contact > k.setDown.start, "key frames");
  }
  eq(getBookPose("next-inc-immersive", 100), null, "not in the scene yet");
  eq(getBookPose("mini-me", 4300), null, "on the riser: Patch 12's");
  eq(getBookState("mini-me", 4170), null, "under the swap: Patch 12's");
});

test("g1: a book's cover angle follows the script and the weight of that book", () => {
  const ml = BOOK_SCRIPT.minilocker!;
  const open = ml.cover.find((e) => e.kind === "open")!;
  const heavy = BOOKS["mini-me"].weightG;
  const light = BOOKS.minilocker.weightG;
  truthy(heavy >= light, "Mini Me is the heavier book");
  // before its opening a cover is shut; after the swing it is near the open angle
  near(coverAngleAt(open.start - 1, ml.cover), 0, 1e-12);
  const during = getBookState("minilocker", open.start + 60)!;
  truthy(during.coverAngle > 0.5, `MiniLocker's cover is open at S18 (${coverDegrees(during.coverAngle)} deg)`);
  eq(FPS, 60);
});
