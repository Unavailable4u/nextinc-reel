// PATCH 14: the shots S00-S04 (plate, approach, pile, lift). What a number can check: the camera of the opening against the guide's
// table and the motion rules, the handover into R3, the lift against the ledger, the dust from frame 0 and the cues.
import { BEAT, SHOTS } from "../src/config/timeline";
import { PILE_DISTANCE_CM, VIEW_LIFT } from "../src/config/camera";
import { PLATE_MATCH } from "../src/plate/PlateFollow";
import { pxPerCm } from "../src/plate/plateCamera";
import { auditMotion } from "../src/camera/audit";
import { authoredAt, cameraAt } from "../src/camera/path";
import { OPERATOR, REACH, walkEnvelope } from "../src/camera/operator";
import { minBlurPx } from "../src/config/plate";
import { plateBlurPx } from "../src/camera/focus";
import { getBookLocation, getBookPose } from "../src/config/ledger";
import { liftTimes } from "../src/book/rig/lift";
import { dustAt } from "../src/scene/dustField";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, shotById } from "../src/shots";
import { eq, near, test, truthy } from "./harness";

const ids = ["S00", "S01", "S02", "S03", "S04"] as const;

// ---------- the camera of S04 and the handover ----------

test("patch 14: S04 adds one camera key, on frame 1080 (the first frame of S05), and the film's camera ends there", () => {
  const s4 = shotById("S04");
  eq(s4.camera.length, 1);
  eq(s4.camera[0].frame, 1080);
  eq(s4.camera[0].frame % BEAT, 0, "on a beat");
  eq(FILM_CAMERA_KEYFRAMES[FILM_CAMERA_KEYFRAMES.length - 1].frame, 1080);
  eq(s4.camera[0].regime, "R3");
  near(s4.camera[0].M, VIEW_LIFT.M, 1e-12, "M");
  near(s4.camera[0].focusCm, 30, 1e-12, "focus 30 (guide 05, section 4)");
  near(s4.camera[0].aperture, 2, 1e-12, "f/2");
});

test("patch 14: the lift is the R2 to R3 handover: M rises from 4.63 to the lift view, the pan stays, the focus pulls 36 to 30", () => {
  const a = authoredAt(960).state;
  const b = authoredAt(1080).state;
  near(a.M, 4.63, 1e-9, "S03's end");
  near(b.M, VIEW_LIFT.M, 1e-9, "S04's end");
  truthy(b.M > a.M && b.M <= 6.6, "M grows and stays inside the R3 budget (6.6)");
  near(b.panX, a.panX, 1e-9, "no slide of the plate behind the book");
  near(b.panY, a.panY, 1e-9);
  near(a.focusCm, 36, 1e-9, "the pile");
  let prev = a.M;
  for (let f = 961; f <= 1080; f++) {
    const m = authoredAt(f).state.M;
    truthy(m >= prev - 1e-12, `M never falls during the lift (frame ${f})`);
    prev = m;
  }
  // the lens goes from the pile (524 cm) to the book (30 / 36 of it) and f/2.8 opens to f/2
  near(cameraAt(960).lens.focusCm, PILE_DISTANCE_CM, 1e-6);
  near(cameraAt(1080, { operator: false }).lens.focusCm, (30 / 36) * PILE_DISTANCE_CM, 1e-6);
  near(cameraAt(1080).lens.fNumber, 2, 1e-12);
});

test("patch 14: the audit is clean for frames 0-1079 (only the documented opening STILL), and the handover pops less than 2%", () => {
  const r = auditMotion({ from: 0, to: 1079 });
  eq(r.unexplained, 0, JSON.stringify(r.findings.filter((f) => !f.known)));
  for (const code of ["FAST", "DEEP", "EDGE", "POP", "LATE"] as const) eq(r.counts[code], 0, code);
  const h = auditMotion({ from: 940, to: 1079 });
  eq(h.unexplained, 0, "the handover, frames 940-1079");
  truthy(h.stats.peakPopFraction < 0.02, `largest jump ${h.stats.peakPopFraction}`);
  truthy(h.stats.peakMRatePerSec <= 1.5, `M changes ${h.stats.peakMRatePerSec} x per second`);
  truthy(h.stats.maxM <= 6.6 + 1e-9, "R3 budget");
});

test("patch 14: above M 5 every frame of the lift has the heavy blur the budget asks for (the plate is only a glow behind the book)", () => {
  for (let f = 960; f < 1080; f++) {
    const c = cameraAt(f);
    const need = minBlurPx(c.view.M);
    truthy(plateBlurPx(c.view.M, c.lens, PLATE_MATCH) + 1e-6 >= need, `frame ${f}: M ${c.view.M} needs ${need} px`);
  }
  truthy(cameraAt(1079).view.M > 5, "the lift does end in the bokeh band");
});

test("patch 14: the reach and its settle fit the R3 sideways limit; the dip is let go after it is over, on a beat", () => {
  eq(REACH.dip % BEAT, 0);
  eq(REACH.settle % BEAT, 0);
  truthy(REACH.dip + OPERATOR.reachDip.frames <= REACH.settle, "the dip is finished before the camera is let go (no jump)");
  truthy(REACH.settle > SHOTS[4].from && REACH.settle < SHOTS[4].to, "the settle is inside S04");
  // the up/down motion of the operator alone: no frame-to-frame step is a pop
  let worst = 0;
  for (let f = 961; f < 1100; f++) worst = Math.max(worst, Math.abs(cameraAt(f).slidePx.y - cameraAt(f - 1).slidePx.y));
  const cmPerSec = (worst / pxPerCm(PLATE_MATCH, PLATE_MATCH.plateDepthCm)) * 60;
  truthy(cmPerSec <= 10, `sideways speed ${cmPerSec} cm/s (R3 limit 10)`);
});

// ---------- S00-S03: the opening against the guide ----------

test("patch 14: S00 holds the whole plate, with the sharp budget (M 2.6) never passed before the pile view", () => {
  for (let f = 0; f < 240; f++) truthy(cameraAt(f).view.M <= 1.319 + 1e-9, `frame ${f} is inside the R1 budget`);
  for (let f = 240; f <= 480; f++) truthy(cameraAt(f).view.M <= 2.6 + 0.2, `frame ${f}: the walk stays near the sharp band's end (2.6)`);
  near(authoredAt(480).state.M, 2.46, 1e-6, "S01 ends below the sharp budget's end, so no defocus is needed there");
});

test("patch 14: the walk bob fades out over frames 440-480, and is gone from frame 480", () => {
  near(walkEnvelope(440), 1, 1e-9, "full at 440");
  truthy(walkEnvelope(460) > 0 && walkEnvelope(460) < 1, "half way at 460");
  near(walkEnvelope(480), 0, 1e-9, "gone at 480");
  eq(walkEnvelope(481), 0);
  eq(walkEnvelope(239), 0, "not before the walk");
});

test("patch 14: the focus pull runs from the far wall to the pile over S02 and the pile is in focus for the hold", () => {
  const f0 = cameraAt(480, { operator: false }).lens.focusCm;
  const f1 = cameraAt(840, { operator: false }).lens.focusCm;
  const f2 = cameraAt(959, { operator: false }).lens.focusCm;
  truthy(f0 > f1 && f1 > f2 - 1e-6, `focus falls from ${f0} to ${f1} to ${f2}`);
  near(f0, (120 / 36) * PILE_DISTANCE_CM, 1e-6, "120 on the guide's scale at the arrival");
  near(cameraAt(960, { operator: false }).lens.focusCm, PILE_DISTANCE_CM, 1e-6, "36 is the pile");
});

test("patch 14: the pile hold drifts 1.5 cm and pushes about 3 percent (no shot is still)", () => {
  const a = authoredAt(840).state;
  const b = authoredAt(960).state;
  const push = b.M / a.M - 1;
  truthy(push > 0.025 && push < 0.04, `push ${push}`);
  near(b.panX - a.panX, 1.5 * pxPerCm(PLATE_MATCH, PLATE_MATCH.plateDepthCm), 1e-6, "1.5 cm slide");
  const r = auditMotion({ from: 840, to: 959 });
  eq(r.counts.STILL, 0, "the hold moves");
});

// ---------- the lift and the ledger ----------

test("patch 14: MiniMe is in the pile until frame 959 and in the hand from 960; the other two stay on the desk through S04", () => {
  eq(getBookLocation("mini-me", 959), "pile");
  eq(getBookLocation("mini-me", 960), "hand");
  eq(getBookLocation("mini-me", 1079), "hand");
  for (const id of ["minilocker", "spherex-blink"] as const) for (const f of [0, 959, 960, 1079]) eq(getBookLocation(id, f), "pile", `${id} at ${f}`);
});

test("patch 14: the lift finishes inside S04, and the book moves without a jump from frame to frame", () => {
  const t = liftTimes("mini-me", 960);
  eq(t.start, 960);
  truthy(t.riseEnd < SHOTS[4].to, `the rise ends on frame ${t.riseEnd}`);
  // the overshoot's last tenth of a degree rings out a few frames into S05; S05's camera key is on frame 1080, so the cover hero starts on a settled book
  truthy(t.settled < SHOTS[5].from + 12, `the book has settled by frame ${t.settled}`);
  let prev = getBookPose("mini-me", 940);
  truthy(prev !== null);
  for (let f = 941; f <= 1080; f++) {
    const p = getBookPose("mini-me", f);
    truthy(p !== null);
    if (!prev || !p) continue;
    const d = Math.hypot(p.position[0] - prev.position[0], p.position[1] - prev.position[1], p.position[2] - prev.position[2]);
    truthy(d < 1.2, `frame ${f}: the book moved ${d} cm in one frame`);
    prev = p;
  }
});

// ---------- the dust and the cues ----------

test("patch 14: the dust is in the lamp light from frame 0 and still there through the lift", () => {
  for (const f of [0, 30, 239, 480, 960, 1000, 1079]) {
    const bright = dustAt(f).filter((m) => m.brightness > 0.05).length;
    truthy(bright >= 100, `frame ${f}: ${bright} motes are lit`);
  }
});

test("patch 14: the cues of S00-S04 are named, in order, on beats, inside their shot, and the film's list has them in frame order", () => {
  let n = 0;
  for (const id of ids) {
    const s = shotById(id);
    n += s.cues.length;
    s.cues.forEach((c, i) => {
      truthy(c.name.trim().length > 0, `${id} cue ${i} has a name`);
      eq(c.frame % BEAT, 0, `${id} \"${c.name}\" is on a beat`);
      truthy(c.frame >= s.from && c.frame <= s.to, `${id} \"${c.name}\" is inside the shot`);
      if (i) truthy(c.frame >= s.cues[i - 1].frame, `${id} cue ${i} is in order`);
    });
  }
  truthy(n >= 7, `${n} cues`);
  const mine = FILM_CUES.filter((c) => c.frame < SHOTS[5].from);
  eq(mine.length, n);
  mine.forEach((c, i) => {
    if (i) truthy(c.frame >= mine[i - 1].frame, "frame order");
  });
  eq(shotById("S00").cues[0].name, "room-tone-in");
  eq(shotById("S00").cues[0].frame, 0);
  eq(shotById("S03").cues.length, 0, "the guide gives the pile hold no sound");
  eq(shotById("S04").cues[0].frame, 960, "the thud lands with the press");
});
