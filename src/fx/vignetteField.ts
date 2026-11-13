// THE VIGNETTE, AS A GRADIENT (Patch 13B). A pure function of its numbers (it does not depend on the frame at all), so the same darkening
// is on every frame. No React: the tests read it.

import { VIGNETTE } from "../config/fx";

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

function rgbOf(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`vignette: "${hex}" is not a #rrggbb colour`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The opacity of the vignette at a distance `t` from the centre, as a share of the way to the corner (0 centre, 1 corner). */
export function vignetteAlpha(t: number, o: { innerRadius?: number; strength?: number } = {}): number {
  const inner = o.innerRadius ?? VIGNETTE.innerRadius;
  const strength = o.strength ?? VIGNETTE.strength;
  if (t <= inner) return 0;
  return strength * smoothstep(Math.min(1, (t - inner) / (1 - inner)));
}

/** The CSS `background` of the vignette: a radial gradient from clear at the middle to `strength` of the vignette colour in the corners. */
export function vignetteBackground(o: { innerRadius?: number; strength?: number; color?: string; steps?: number } = {}): string {
  const inner = o.innerRadius ?? VIGNETTE.innerRadius;
  const strength = o.strength ?? VIGNETTE.strength;
  const steps = Math.max(2, Math.round(o.steps ?? VIGNETTE.steps));
  const [r, g, b] = rgbOf(o.color ?? VIGNETTE.color);
  const stops: string[] = [`rgba(${r}, ${g}, ${b}, 0) ${(inner * 100).toFixed(2)}%`];
  for (let i = 1; i <= steps; i++) {
    const t = inner + ((1 - inner) * i) / steps;
    stops.push(`rgba(${r}, ${g}, ${b}, ${vignetteAlpha(t, { innerRadius: inner, strength }).toFixed(4)}) ${(t * 100).toFixed(2)}%`);
  }
  // `farthest-corner` puts 100 percent on the corner of the frame
  return `radial-gradient(ellipse farthest-corner at 50% 50%, ${stops.join(", ")})`;
}
