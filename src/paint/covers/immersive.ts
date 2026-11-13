// VOL. IV, NEXT INC. IMMERSIVE (Patch 08, guide 04 section 3). Darkened crimson cloth. A blind-stamped particle globe (no ink and
// no foil: it presses into the cloth and darkens it a little); the title in two lines, `Next Inc.` and `Immersive` italic, in off-white
// foil; the line `A showcase build`; the authors. The back says in plain words what the data says: a showcase build, not the
// production site.
//
// THE GLOBE. Points on a sphere by the golden-angle spiral (even, no seams, no poles), turned by a fixed tilt and turn, seen from
// the front: the near hemisphere only, each dot bigger the nearer it is to the viewer, a little jitter from the book's seed so it
// reads as particles and not as a lattice; and a ring of dots on the outline. Everything is a pure function of the config and the
// book's seed.

import { COVER_ART } from "../../config/covers";
import { prng } from "../../lib/prng";
import { circleCmds } from "../svgPath";
import { painterOf } from "./render";
import { blindPaint, fillOp, planCover, type CoverArt, type Ctx, type Frame } from "./common";
import type { CoverData, CoverPlanner, CoverTokens, Op } from "./types";

const A = COVER_ART["next-inc-immersive"];

export interface GlobeDot {
  /** from the globe's centre, in units of its radius: x to the right, y up */
  x: number;
  y: number;
  /** 0 on the outline to 1 facing the viewer */
  depth: number;
}

/**
 * About `count` dots on the near hemisphere (the spiral is laid over the whole sphere, twice as many points, and the far half is
 * not seen). `seed` jitters them by up to 0.3 of the spacing.
 */
export function globeDots(count: number, seed: number, tiltDeg: number, turnDeg: number): GlobeDot[] {
  const total = count * 2;
  const rand = prng(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tilt = (tiltDeg * Math.PI) / 180;
  const turn = (turnDeg * Math.PI) / 180;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cu = Math.cos(turn);
  const su = Math.sin(turn);
  const spacing = Math.sqrt((4 * Math.PI) / total);
  const out: GlobeDot[] = [];
  for (let i = 0; i < total; i++) {
    let y = 1 - (2 * (i + 0.5)) / total;
    const r = Math.sqrt(1 - y * y);
    const phi = i * golden;
    let x = r * Math.cos(phi);
    let z = r * Math.sin(phi);
    // jitter on the sphere's surface, then back to unit length
    x += (rand() - 0.5) * 0.3 * spacing;
    y += (rand() - 0.5) * 0.3 * spacing;
    z += (rand() - 0.5) * 0.3 * spacing;
    const len = Math.hypot(x, y, z);
    x /= len;
    y /= len;
    z /= len;
    // turn about the vertical axis, then lean the axis towards the viewer
    const x1 = cu * x + su * z;
    const z1 = -su * x + cu * z;
    const y2 = ct * y - st * z1;
    const z2 = st * y + ct * z1;
    if (z2 > 0.04) out.push({ x: x1, y: y2, depth: z2 });
  }
  return out;
}

export function globeOps(ctx: Ctx, f: Frame): Op[] {
  const R = f.cm(A.globeRadiusCm);
  const cx = f.w * A.centre.x;
  const cy = f.h * A.centre.y;
  const paint = blindPaint(ctx, A.blindAlpha);
  const rMin = f.cm(A.dotCm.min);
  const rMax = f.cm(A.dotCm.max);
  const ops: Op[] = [];
  for (const d of globeDots(A.dots, ctx.spec.seeds.block, A.tiltDeg, A.turnDeg)) ops.push(fillOp(circleCmds(cx + d.x * R, cy - d.y * R, rMin + (rMax - rMin) * d.depth), paint));
  // the ring on the outline: evenly spaced, the smallest dot
  for (let i = 0; i < A.rim; i++) {
    const a = (2 * Math.PI * i) / A.rim;
    ops.push(fillOp(circleCmds(cx + R * Math.cos(a), cy + R * Math.sin(a), rMin), paint));
  }
  return ops;
}

export const immersiveArt: CoverArt = {
  front: globeOps,
  title: { mode: "top", at: A.titleTop, breakAtStyleChange: true },
  line: { italic: true, smallCaps: false },
  emblem: null,
  // the back's one statement is the data's own plain-words line; the summary and the cover line would only repeat it
  back: { line: false, summary: false, backLine: true },
};

export const planImmersive: CoverPlanner = (data: CoverData, tokens: CoverTokens) => planCover(data, tokens, immersiveArt);
export const paintCover = painterOf(planImmersive);
