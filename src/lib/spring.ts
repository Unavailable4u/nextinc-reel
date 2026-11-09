// Closed-form damped springs. No integration loop, so the value at frame N never depends on frame N-1 (determinism rule 4).
//
// A spring is described by a damping ratio zeta and a natural frequency in Hz. For a step from `from` to `to` released at
// time 0 with initial velocity v0 (units per second), the exact solution is used for the three cases:
// underdamped (zeta < 1), critically damped (zeta = 1) and overdamped (zeta > 1).

export interface SpringSpec {
  /** damping ratio: below 1 overshoots, 1 is critical, above 1 creeps */
  zeta: number;
  /** natural frequency in Hz */
  hz: number;
}

/** The named springs of guide 05, section 5. */
export const SPRINGS = {
  cover: { zeta: 0.6, hz: 3.2 },
  settle: { zeta: 0.45, hz: 6 },
  bookSway: { zeta: 0.9, hz: 1.2 },
} as const satisfies Record<string, SpringSpec>;

/**
 * Position at time `t` (seconds since release) of a spring moving from `from` to `to`.
 * `v0` is the initial velocity in units per second (default 0).
 */
export function springAt(t: number, spec: SpringSpec, from = 0, to = 1, v0 = 0): number {
  if (t <= 0) return from;
  const w0 = 2 * Math.PI * spec.hz;
  const z = spec.zeta;
  const x0 = from - to; // displacement from the target at t = 0
  let disp: number;
  if (z < 1 - 1e-9) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const a = x0;
    const b = (v0 + z * w0 * x0) / wd;
    disp = Math.exp(-z * w0 * t) * (a * Math.cos(wd * t) + b * Math.sin(wd * t));
  } else if (z <= 1 + 1e-9) {
    const c1 = x0;
    const c2 = v0 + w0 * x0;
    disp = (c1 + c2 * t) * Math.exp(-w0 * t);
  } else {
    const s = Math.sqrt(z * z - 1);
    const r1 = -w0 * (z - s);
    const r2 = -w0 * (z + s);
    const c2 = (v0 - r1 * x0) / (r2 - r1);
    const c1 = x0 - c2;
    disp = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }
  return to + disp;
}

/** Same, but driven by frames: `frame` and `startFrame` in frames at `fps`. */
export function springFrames(frame: number, startFrame: number, spec: SpringSpec, fps: number, from = 0, to = 1, v0 = 0): number {
  return springAt((frame - startFrame) / fps, spec, from, to, v0);
}

/** Time in seconds after which the spring stays within `tol` (a fraction of the step) of its target. */
export function settleTime(spec: SpringSpec, tol = 0.01): number {
  const w0 = 2 * Math.PI * spec.hz;
  return Math.log(1 / tol) / (spec.zeta * w0) + 0.5 / spec.hz;
}
