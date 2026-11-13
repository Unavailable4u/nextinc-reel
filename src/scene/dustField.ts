// THE DUST FIELD (Patch 12): where every mote is, and how brightly the lamp lights it, at a frame. Pure functions of the frame number and
// the numbers of `config/dust.ts`: no React, no three.js, no random numbers except the seeded ones that make the motes' starts. `Dust.tsx`
// only draws what this returns. See `config/dust.ts` for how the field works.
//
// Desk coordinates (X right, Y up, Zd towards the wall). The component turns them into world positions (X, Y, -Zd).

import { DUST } from "../config/dust";
import { BOOK_SCRIPT, besidePose, coverEventsOf, pilePose } from "../config/ledger";
import { FPS } from "../config/timeline";
import { prng, range } from "../lib/prng";
import { makeNoise } from "../lib/noise";
import { closeFrames } from "../book/rig/cover";
import { readingPose } from "../book/rig/hold";
import { liftTimes } from "../book/rig/lift";
import { setDownTimes } from "../book/rig/setDown";
import { lampBulb } from "../plate/plateCamera";
import { PLATE_MATCH } from "../plate/PlateFollow";
import { BOOKS, closedThickness, type BookId } from "../config/books";

export interface DeskPoint {
  X: number;
  Y: number;
  Zd: number;
}

/** Something that stirs the dust: a book lifting, a cover closing, a book touching the desk. `strength` is a multiple of `DUST.disturb.peakCm`. */
export interface DustSource extends DeskPoint {
  /** the frame it happens */
  frame: number;
  strength: number;
  /** for the notes and the lab */
  what: string;
}

export interface Mote extends DeskPoint {
  /** the diameter of the soft disc, cm */
  sizeCm: number;
  /** 0 to 1: how much of the lamp's light it catches (0 outside the cone: it is not drawn) */
  brightness: number;
}

interface MoteBase {
  X: number;
  Y: number;
  Zd: number;
  vx: number;
  vy: number;
  vz: number;
  sizeCm: number;
  own: number;
  /** two seeded numbers in [0, 1) for the force field, and three offsets into the noise */
  r1: number;
  r2: number;
  nx: number;
  ny: number;
  nz: number;
  tw: number;
}

let bases: MoteBase[] | null = null;
let noise: ReturnType<typeof makeNoise> | null = null;

function moteBases(): MoteBase[] {
  if (bases) return bases;
  const r = prng(DUST.seed);
  const B = DUST.box;
  const out: MoteBase[] = [];
  for (let i = 0; i < DUST.count; i++) {
    const az = range(r, 0, Math.PI * 2);
    const speed = range(r, DUST.drift.speedCmPerSec[0], DUST.drift.speedCmPerSec[1]);
    const lift = range(r, -0.4, 0.4);
    out.push({
      X: range(r, B.x0, B.x1),
      Y: range(r, B.y0, B.y1),
      Zd: range(r, B.zd0, B.zd1),
      vx: Math.cos(az) * speed,
      vz: Math.sin(az) * speed,
      vy: lift * speed - DUST.drift.fallCmPerSec,
      sizeCm: range(r, DUST.sizeCm[0], DUST.sizeCm[1]),
      own: range(r, DUST.brightness[0], DUST.brightness[1]),
      r1: r(),
      r2: r(),
      nx: range(r, 0, 200),
      ny: range(r, 0, 200),
      nz: range(r, 0, 200),
      tw: range(r, 0, 200),
    });
  }
  bases = out;
  return out;
}

const field = (): ReturnType<typeof makeNoise> => (noise ??= makeNoise(DUST.seed + 1));

/** The lamp's bulb, desk coordinates (it follows the match). */
export function lampDesk(): DeskPoint {
  return lampBulb(PLATE_MATCH);
}

/** The unit axis of the lamp's cone, from the bulb to the aim point. */
export function coneAxis(): [number, number, number] {
  const l = lampDesk();
  const a = DUST.cone.aim;
  const d: [number, number, number] = [a.X - l.X, a.Y - l.Y, a.Zd - l.Zd];
  const n = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / n, d[1] / n, d[2] / n];
}

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** How much of the lamp's light a point catches because of where it is: 1 well inside the cone, 0 outside it, near the bulb or beyond its length. */
export function coneMask(p: DeskPoint): number {
  const l = lampDesk();
  const ax = coneAxis();
  const v: [number, number, number] = [p.X - l.X, p.Y - l.Y, p.Zd - l.Zd];
  const s = Math.hypot(v[0], v[1], v[2]);
  if (s < 1e-6) return 0;
  const cos = (v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2]) / s;
  const angle = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  const C = DUST.cone;
  const radial = 1 - smooth((angle - (C.halfAngleDeg - C.softDeg)) / C.softDeg);
  const near = smooth((s - C.nearCm) / C.nearCm);
  const far = 1 - smooth((s - (C.lengthCm - C.fadeCm)) / C.fadeCm);
  return radial * near * far;
}

/** How much of the light is left at a distance from the bulb: the square law from `refCm`, kept between two limits. */
export function falloffAt(distCm: number): number {
  const F = DUST.falloff;
  const k = (F.refCm / Math.max(distCm, 1)) ** 2;
  return Math.min(F.max, Math.max(F.min, k));
}

const wrap = (v: number, lo: number, hi: number): number => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));

/** 1 inside the box, falling to 0 at each face over `boxFadeCm`: where a mote is wrapped round it is dark. */
export function boxFade(p: DeskPoint): number {
  const B = DUST.box;
  const f = DUST.boxFadeCm;
  const d = Math.min(p.X - B.x0, B.x1 - p.X, p.Y - B.y0, B.y1 - p.Y, p.Zd - B.zd0, B.zd1 - p.Zd);
  return smooth(d / f);
}

/** The time envelope of a puff: 0 before it, a smooth rise to 1 over `riseSec`, then an exponential fall with `fallSec`. */
export function puffEnvelope(seconds: number): number {
  const D = DUST.disturb;
  if (seconds <= 0) return 0;
  if (seconds < D.riseSec) return smooth(seconds / D.riseSec);
  return Math.exp(-(seconds - D.riseSec) / D.fallSec);
}

/** How far a puff reaches: 1 at its centre, falling smoothly to about a fifth at `radiusCm`. */
export const puffReach = (distCm: number): number => Math.exp(-1.5 * (distCm / DUST.disturb.radiusCm) ** 2);

/**
 * The push the sources give a mote at a frame, cm: an outward and upward puff with a swirl, strongest at the source and at the peak of the
 * envelope. `p` is the mote's place without any push; `r1` and `r2` are the mote's own seeded numbers (its strength and its angle).
 */
export function disturbance(frame: number, p: DeskPoint, r1: number, r2: number, sources: readonly DustSource[]): { dx: number; dy: number; dz: number } {
  const D = DUST.disturb;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  const horizon = D.riseSec + 7 * D.fallSec;
  for (const s of sources) {
    const tau = (frame - s.frame) / FPS;
    if (tau <= 0 || tau > horizon) continue;
    const rx = p.X - s.X;
    const ry = p.Y - s.Y;
    const rz = p.Zd - s.Zd;
    const r = Math.hypot(rx, ry, rz);
    if (r > 2.2 * D.radiusCm) continue;
    const reach = puffReach(r);
    const amp = D.peakCm * s.strength * reach * puffEnvelope(tau) * (0.55 + 0.9 * r1);
    // outward (flat), up and round: the direction of the swirl is the same for every mote, its angle off the radial varies a little
    const h = Math.hypot(rx, rz) || 1;
    const ox = rx / h;
    const oz = rz / h;
    const turn = (r2 - 0.5) * 0.8;
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    const ax = ox * c - oz * sn;
    const az = ox * sn + oz * c;
    // swirl = up x radial
    const wx = az;
    const wz = -ax;
    const vx = ax + wx * D.swirl;
    const vy = D.up;
    const vz = az + wz * D.swirl;
    const n = Math.hypot(vx, vy, vz);
    dx += (amp * vx) / n;
    dy += (amp * vy) / n;
    dz += (amp * vz) / n;
  }
  return { dx, dy, dz };
}

/**
 * Every mote's place and brightness at a frame, without the ones the lamp does not light (brightness 0 is left out). `sources` are the
 * things that stir the dust; the default is the film's own (`dustSources()`).
 */
export function dustAt(frame: number, sources: readonly DustSource[] = dustSources()): Mote[] {
  const t = frame / FPS;
  const B = DUST.box;
  const n = field();
  const l = lampDesk();
  const w = t / DUST.drift.wanderSec;
  const out: Mote[] = [];
  for (const m of moteBases()) {
    const wx = DUST.drift.wanderCm * n.n1(w + m.nx);
    const wy = DUST.drift.wanderCm * 0.5 * n.n1(w + m.ny);
    const wz = DUST.drift.wanderCm * n.n1(w + m.nz);
    const quiet: DeskPoint = {
      X: wrap(m.X + m.vx * t + wx, B.x0, B.x1),
      Y: wrap(m.Y + m.vy * t + wy, B.y0, B.y1),
      Zd: wrap(m.Zd + m.vz * t + wz, B.zd0, B.zd1),
    };
    const g = coneMask(quiet) * boxFade(quiet);
    if (g <= 1e-4) continue;
    const d = disturbance(frame, quiet, m.r1, m.r2, sources);
    const p: DeskPoint = { X: quiet.X + d.dx, Y: Math.max(0.05, quiet.Y + d.dy), Zd: quiet.Zd + d.dz };
    const dist = Math.hypot(p.X - l.X, p.Y - l.Y, p.Zd - l.Zd);
    const tw = 1 + DUST.twinkle.amount * n.n1(t / DUST.twinkle.periodSec + m.tw);
    const b = Math.min(1, m.own * g * falloffAt(dist) * tw);
    if (b > 1e-3) out.push({ ...p, sizeCm: m.sizeCm, brightness: b });
  }
  return out;
}

/**
 * What stirs the dust in the film, from the ledger's scripts: each lift (at the book's place in the pile, as its rise begins), each cover
 * that closes (at the reading pose, as it lands) and each set-down (where the book touches the desk). Sorted by frame.
 */
export function dustSources(): DustSource[] {
  const out: DustSource[] = [];
  for (const [id, s] of Object.entries(BOOK_SCRIPT) as [BookId, NonNullable<(typeof BOOK_SCRIPT)[BookId]>][]) {
    const lt = liftTimes(id, s.lift.start, s.lift.speed);
    const p = pilePose(id);
    out.push({ frame: lt.riseStart, X: p.position[0], Y: closedThickness(BOOKS[id]) + 1, Zd: -p.position[2], strength: DUST.events.lift, what: `${id} lifts` });
    for (const e of coverEventsOf(id)) {
      if (e.kind !== "close") continue;
      const r = readingPose();
      out.push({ frame: e.start + closeFrames(e.opts), X: r.position[0], Y: r.position[1], Zd: -r.position[2], strength: DUST.events.close, what: `${id} closes` });
    }
    const dt = setDownTimes(id, s.setDown.start, s.setDown.speed);
    const b = besidePose(id);
    out.push({ frame: dt.contact, X: b.position[0], Y: closedThickness(BOOKS[id]), Zd: -b.position[2], strength: DUST.events.setDown, what: `${id} sets down` });
  }
  return out.sort((a, b) => a.frame - b.frame);
}
