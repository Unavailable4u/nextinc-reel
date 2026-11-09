// The easing vocabulary of docs/guide/05-camera-and-motion.md section 5. Pure functions of t in [0, 1].
// Linear motion is only for dust, grain and the riffle's overall rate. Everything else eases.

/** Solves a CSS cubic-bezier(x1, y1, x2, y2) for a given progress t (Newton, then bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(u) - t;
      if (Math.abs(err) < 1e-7) return sampleY(u);
      const d = slopeX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0;
    let hi = 1;
    u = t;
    for (let i = 0; i < 40; i++) {
      const x = sampleX(u);
      if (Math.abs(x - t) < 1e-7) break;
      if (x < t) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sampleY(u);
  };
}

/** cubic-bezier(0.65, 0, 0.35, 1): the default for any authored move. */
export const signature = cubicBezier(0.65, 0, 0.35, 1);
/** cubic-bezier(0.22, 0.8, 0.2, 1): the website's --ease; an arrival that slows at the end. */
export const arrive = cubicBezier(0.22, 0.8, 0.2, 1);
/** cubic-bezier(0.3, 0, 0.2, 1): book lift. */
export const lift = cubicBezier(0.3, 0, 0.2, 1);
export const linear = (t: number): number => t;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0..1 progress of `frame` between two frames (clamped). */
export const progress = (frame: number, from: number, to: number): number => clamp01((frame - from) / Math.max(1, to - from));

/** Clamped remap with an optional easing. */
export function remap(value: number, inA: number, inB: number, outA: number, outB: number, ease: (t: number) => number = linear): number {
  return lerp(outA, outB, ease(progress(value, inA, inB)));
}

export type EaseName = "signature" | "arrive" | "lift" | "linear";
export const EASES: Record<EaseName, (t: number) => number> = { signature, arrive, lift, linear };
