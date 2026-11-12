// THE MOTION AUDIT (Patch 05): the checks behind `npm run motion` (guide 05, section 7), as a pure function so the tests can break a
// keyframe on purpose and see the audit say so. No React and no three.js.
//
//   STILL  a hold over 60 frames that moves less than 0.5%                       (rule 1: no shot is still)
//   FAST   a speed limit broken, a move shorter than 48 frames, or two moves
//          less than 20 frames apart                                             (rules 2 and 3)
//   DEEP   plate magnification above the regime's budget, or above the sharp
//          band with less defocus than the budget table asks                     (guide 05 section 2, guide 02)
//   EDGE   the camera window asked to leave the plate (40 px margin), or a
//          tilt / roll above the regime's budget                                 (rule 5)
//   POP    the picture jumps by more than 2% from one frame to the next          (section 2, the R2 to R3 handover)
//   LATE   an authored event that is not on a beat (a multiple of 30)            (rule 4)
//
// STILL and EDGE look at the AUTHORED path (the operator is the floor, not a substitute); FAST, DEEP and POP look at what the
// viewer sees: authored path plus operator model, after the margin rule.

import { CAMERA_KEYFRAMES, KNOWN_EXCEPTIONS, MAX_M_RATE_PER_SEC, MIN_GAP_FRAMES, MIN_MOVE_FRAMES, POP_FRACTION, STILL_FRAMES, STILL_MOVEMENT, checkKeyframes, limitFor, type CameraKeyframe } from "../config/camera";
import { MAGNIFICATION, minBlurPx } from "../config/plate";
import { ZONES } from "../config/placement";
import { BEAT, FPS, SHOTS, TOTAL, WIDTH, checkTimeline } from "../config/timeline";
import { PLATE_MATCH, clampView, photoToScreen, type PlateMatch } from "../plate/PlateFollow";
import { projectDesk, pxPerCm } from "../plate/plateCamera";
import { plateBlurPx } from "./focus";
import { OPERATOR_EVENT_FRAMES } from "./operator";
import { cameraAt, turnShiftPx, type CameraFrame } from "./path";

export type FindingCode = "STILL" | "FAST" | "DEEP" | "EDGE" | "POP" | "LATE";
export const FINDING_CODES: readonly FindingCode[] = ["STILL", "FAST", "DEEP", "EDGE", "POP", "LATE"];

export interface Finding {
  code: FindingCode;
  /** first and last frame of the finding (equal for a single frame) */
  from: number;
  to: number;
  detail: string;
  /** the worst value found and the limit it broke, where there is a number */
  value?: number;
  limit?: number;
  /** set when the finding lies inside a documented exception (KNOWN_EXCEPTIONS in config/camera.ts); the text is the reason */
  known?: string;
}

export interface AuditOptions {
  keys?: readonly CameraKeyframe[];
  /** first and last frame to look at (default: from 0 to the frame before the last keyframe) */
  from?: number;
  to?: number;
  match?: PlateMatch;
  /** documented exceptions (default: KNOWN_EXCEPTIONS); pass [] to see everything */
  exceptions?: typeof KNOWN_EXCEPTIONS;
}

export interface AuditStats {
  frames: number;
  peakLateralCmPerSec: number;
  peakMRatePerSec: number;
  peakPopFraction: number;
  maxM: number;
  moves: { from: number; to: number }[];
}

export interface AuditResult {
  range: [number, number];
  findings: Finding[];
  /** findings per code, known exceptions included */
  counts: Record<FindingCode, number>;
  /** findings that are NOT documented exceptions: `npm run motion` fails when this is above zero */
  unexplained: number;
  stats: AuditStats;
  /** the shot table: how many shots and the total of their frames (the audit also fails if it is not TOTAL) */
  timeline: { shots: number; frames: number };
}

/** A clamp that moves the authored view by more than this many OUTPUT px is an EDGE; a smaller one is the margin rule smoothing the start of a slide. */
export const EDGE_TOLERANCE_OUT_PX = 16;

/** merges findings of one kind on consecutive frames into one range */
class Collector {
  readonly list: Finding[] = [];
  private open = new Map<string, Finding>();
  add(code: FindingCode, frame: number, kind: string, detail: (value: number) => string, value: number, limit?: number): void {
    const key = `${code}:${kind}`;
    const f = this.open.get(key);
    if (f && f.to === frame - 1) {
      f.to = frame;
      if (value > (f.value ?? 0)) {
        f.value = value;
        f.detail = detail(value);
      }
      return;
    }
    const n: Finding = { code, from: frame, to: frame, detail: detail(value), value, limit };
    this.list.push(n);
    this.open.set(key, n);
  }
  push(f: Finding): void {
    this.list.push(f);
  }
}

const r1 = (v: number): string => (Math.round(v * 10) / 10).toString();
const r3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();

/** the position of the authored view's centre, photo px, tilt included */
const centre = (k: CameraKeyframe, match: PlateMatch): { x: number; y: number } => ({ x: k.panX, y: k.panY + turnShiftPx(k.tiltDeg, match) });

/** whether the camera changes between two keyframes (view, tilt or roll; the lens does not count as a camera move) */
function segmentMoves(a: CameraKeyframe, b: CameraKeyframe, match: PlateMatch): boolean {
  const ca = centre(a, match);
  const cb = centre(b, match);
  return Math.abs(Math.log(b.M / a.M)) > 1e-4 || Math.hypot(cb.x - ca.x, cb.y - ca.y) > 0.05 || Math.abs(b.rollDeg - a.rollDeg) > 1e-3;
}

export function auditMotion(o: AuditOptions = {}): AuditResult {
  const keys = o.keys ?? CAMERA_KEYFRAMES;
  const match = o.match ?? PLATE_MATCH;
  checkKeyframes(keys);
  const lastKey = keys[keys.length - 1].frame;
  const from = Math.max(0, Math.round(o.from ?? 0));
  const to = Math.min(TOTAL - 1, Math.round(o.to ?? lastKey - 1));
  if (to <= from) throw new Error(`motion audit: the frame range ${from}-${to} is empty`);
  const c = new Collector();
  const ppc = pxPerCm(match, match.plateDepthCm);

  // ---- the shot table: the audit checks it too (checkTimeline throws with a clear message) ----
  checkTimeline();
  const shotFrames = SHOTS.reduce((n, s) => n + (s.to - s.from + 1), 0);
  if (shotFrames !== TOTAL) throw new Error(`motion audit: the shots add up to ${shotFrames} frames, not ${TOTAL}`);

  // ---- LATE: every authored event is on a beat ----
  for (const k of keys) {
    if (k.frame % BEAT !== 0) c.push({ code: "LATE", from: k.frame, to: k.frame, detail: `keyframe at f${k.frame} is not on a beat (nearest: f${Math.round(k.frame / BEAT) * BEAT})`, value: k.frame % BEAT, limit: 0 });
  }
  for (const f of OPERATOR_EVENT_FRAMES) {
    if (f % BEAT !== 0) c.push({ code: "LATE", from: f, to: f, detail: `operator event at f${f} is not on a beat (nearest: f${Math.round(f / BEAT) * BEAT})`, value: f % BEAT, limit: 0 });
  }

  // ---- FAST (structure): the length of each move and the gap between moves, from the keyframes ----
  const moves: { from: number; to: number }[] = [];
  for (let i = 0; i + 1 < keys.length; i++) {
    if (!segmentMoves(keys[i], keys[i + 1], match)) continue;
    const m = moves[moves.length - 1];
    if (m && m.to === keys[i].frame) m.to = keys[i + 1].frame;
    else moves.push({ from: keys[i].frame, to: keys[i + 1].frame });
  }
  moves.forEach((m, i) => {
    const len = m.to - m.from;
    if (len < MIN_MOVE_FRAMES) c.push({ code: "FAST", from: m.from, to: m.to, detail: `a camera move of ${len} frames (shortest allowed: ${MIN_MOVE_FRAMES})`, value: len, limit: MIN_MOVE_FRAMES });
    if (i > 0) {
      const gap = m.from - moves[i - 1].to;
      if (gap < MIN_GAP_FRAMES) c.push({ code: "FAST", from: moves[i - 1].to, to: m.from, detail: `only ${gap} frames between two camera moves (at least ${MIN_GAP_FRAMES})`, value: gap, limit: MIN_GAP_FRAMES });
    }
  });

  // ---- per frame ----
  const look = (f: number): CameraFrame => cameraAt(f, { keys, match, operator: true });
  const authored = (f: number): CameraFrame => cameraAt(f, { keys, match, operator: false });
  const stats: AuditStats = { frames: to - from + 1, peakLateralCmPerSec: 0, peakMRatePerSec: 0, peakPopFraction: 0, maxM: 0, moves };
  const anchors = [ZONES.L.anchor, ZONES.R.anchor].map((z) => projectDesk(match, z.X, 0, z.Zd));
  const maxRate = Math.log(MAX_M_RATE_PER_SEC);
  let prev = look(Math.max(0, from - 1));
  for (let f = from; f <= to; f++) {
    const cur = look(f);
    const lim = limitFor(cur.regime);
    stats.maxM = Math.max(stats.maxM, cur.view.M);

    // FAST: the sideways speed of the slide (cm per second at the plate) and the rate of change of M
    const dist = Math.hypot(cur.slidePx.x - prev.slidePx.x, cur.slidePx.y - prev.slidePx.y);
    const cmPerSec = (dist / ppc) * FPS;
    stats.peakLateralCmPerSec = Math.max(stats.peakLateralCmPerSec, cmPerSec);
    if (cmPerSec > lim.lateralCmPerSec) c.add("FAST", f, "lateral", (v) => `sideways speed up to ${r1(v)} cm/s (limit ${lim.lateralCmPerSec} cm/s in ${cur.regime})`, cmPerSec, lim.lateralCmPerSec);
    const rate = Math.abs(Math.log(cur.view.M / prev.view.M)) * FPS;
    stats.peakMRatePerSec = Math.max(stats.peakMRatePerSec, Math.exp(rate));
    if (rate > maxRate) c.add("FAST", f, "mrate", (v) => `magnification changes ${r3(Math.exp(v))} x per second (limit ${MAX_M_RATE_PER_SEC} x)`, rate, maxRate);

    // POP: a jump of the picture from the last frame, in fractions of the frame's width (anchors) and of M
    let jump = Math.abs(Math.log(cur.view.M / prev.view.M));
    for (const a of anchors) {
      const p0 = photoToScreen(prev.view, a.x, a.y, prev.rollDeg);
      const p1 = photoToScreen(cur.view, a.x, a.y, cur.rollDeg);
      jump = Math.max(jump, Math.hypot(p1.x - p0.x, p1.y - p0.y) / WIDTH);
    }
    stats.peakPopFraction = Math.max(stats.peakPopFraction, jump);
    if (jump > POP_FRACTION) c.add("POP", f, "pop", (v) => `the picture jumps by ${r1(v * 100)}% of the frame in one frame (limit ${POP_FRACTION * 100}%)`, jump, POP_FRACTION);

    // DEEP: M above the regime's budget, or above the sharp band with less defocus than the table asks
    if (cur.view.M > lim.maxM + 1e-9) c.add("DEEP", f, "maxM", (v) => `plate magnification ${r3(v)} is above the ${cur.regime} budget (${lim.maxM})`, cur.view.M, lim.maxM);
    if (cur.view.M > MAGNIFICATION.sharpUpTo) {
      const blur = plateBlurPx(cur.view.M, cur.lens, match);
      const need = minBlurPx(cur.view.M);
      if (blur < need - 1e-6) c.add("DEEP", f, "blur", () => `M ${r3(cur.view.M)} needs ${r1(need)} px of defocus, the lens gives ${r1(blur)} px`, need - blur, 0);
    }

    // EDGE: the AUTHORED view (without the operator) and the authored tilt and roll against the budget
    const au = authored(f);
    const chk = clampView(au.authoredView, au.rollDeg);
    const moved = Math.hypot(chk.view.cx - au.authoredView.cx, chk.view.cy - au.authoredView.cy) * au.authoredView.M;
    if (moved > EDGE_TOLERANCE_OUT_PX) c.add("EDGE", f, "margin", (v) => `the authored view is ${r1(v)} output px outside the 40 px margin (centre ${r1(au.authoredView.cx)}, ${r1(au.authoredView.cy)} at M ${r3(au.authoredView.M)})`, moved, EDGE_TOLERANCE_OUT_PX);
    if (Math.abs(au.authored.tiltDeg) > lim.maxTiltDeg + 1e-9) c.add("EDGE", f, "tilt", (v) => `tilt ${r1(v)} degrees is above the ${cur.regime} budget (${lim.maxTiltDeg})`, Math.abs(au.authored.tiltDeg), lim.maxTiltDeg);
    if (Math.abs(au.authored.rollDeg) > lim.maxRollDeg + 1e-9) c.add("EDGE", f, "roll", (v) => `roll ${r1(v)} degrees is above the ${cur.regime} budget (${lim.maxRollDeg})`, Math.abs(au.authored.rollDeg), lim.maxRollDeg);
    prev = cur;
  }

  // ---- STILL: a hold over STILL_FRAMES that moves less than STILL_MOVEMENT (authored path) ----
  const moveBetween = (a: CameraFrame, b: CameraFrame): number => {
    const dM = Math.abs(b.authoredView.M / a.authoredView.M - 1);
    const shift = (Math.hypot(b.authoredView.cx - a.authoredView.cx, b.authoredView.cy - a.authoredView.cy) * a.authoredView.M) / WIDTH;
    const dRoll = Math.abs(b.rollDeg - a.rollDeg) / 45;
    return Math.max(dM, shift, dRoll);
  };
  const path: CameraFrame[] = [];
  for (let f = from; f <= to; f++) path.push(authored(f));
  let i = 0;
  while (i < path.length) {
    let j = i;
    while (j + 1 < path.length && moveBetween(path[i], path[j + 1]) < STILL_MOVEMENT) j++;
    const len = j - i + 1;
    if (len > STILL_FRAMES) c.push({ code: "STILL", from: from + i, to: from + j, detail: `the camera holds for ${len} frames and moves less than ${STILL_MOVEMENT * 100}% (a hold over ${STILL_FRAMES} needs a drift)`, value: len, limit: STILL_FRAMES });
    i = j + 1;
  }

  const findings = c.list.slice().sort((a, b) => a.from - b.from || FINDING_CODES.indexOf(a.code) - FINDING_CODES.indexOf(b.code));
  for (const f of findings) {
    const ex = (o.exceptions ?? KNOWN_EXCEPTIONS).find((e) => e.code === f.code && f.from >= e.from && f.to <= e.to);
    if (ex) f.known = ex.why;
  }
  const counts = Object.fromEntries(FINDING_CODES.map((k) => [k, findings.filter((f) => f.code === k).length])) as Record<FindingCode, number>;
  return { range: [from, to], findings, counts, unexplained: findings.filter((f) => !f.known).length, stats, timeline: { shots: SHOTS.length, frames: shotFrames } };
}
