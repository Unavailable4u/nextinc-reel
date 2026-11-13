// THE MARKS THAT ARE USED EXACTLY (Patch 08). Three things on the covers are never redrawn by eye (guide 04 sections 2 and 3):
//
//   the Blast Radius dial   `CX`, `CY`, `RADII` and `arcPath` are copied word for word from `minilocker-film/src/ui/RadiusDial.tsx`
//                           (the arcs the Mini Locker app draws: 270 degrees, from 12 o'clock clockwise to 9 o'clock)
//   the MiniLocker Mark     `MARK` is the SVG of `minilocker-film/docs/bible/appendix-A.md` (`frontend/src/ui.tsx`), element by element
//   the publisher's x       the path in `public/site/brand/glyph-x.json`, read by `common.ts`
//
// Each one reaches the painter as path data (`parsePath` turns an `A` command into the cubics of the same curve), so a number in
// this file that differs from its source is a bug. `tests/covers.test.ts` holds the source values and compares.

import { INK, CRIMSON } from "../../config/covers";
import { circleCmds, parsePath, transformPath, type PathCmd } from "../svgPath";

// ---------------------------------------------------------------------------------------------------------------------------
// the dial (verbatim from RadiusDial.tsx)
// ---------------------------------------------------------------------------------------------------------------------------

export const CX = 120;
export const CY = 120;
export const RADII: readonly number[] = [104, 88, 72, 56, 40];
export const arcPath = (r: number): string => `M ${CX} ${CY - r} A ${r} ${r} 0 1 1 ${CX - r} ${CY}`;

/** The stroke width of a measured arc in the dial's own units (the app draws `width: 8`), and the side of its viewBox. */
export const DIAL_STROKE = 8;
export const DIAL_VIEWBOX = 240;

export interface DialArc {
  /** the arc as cubics, in px on the cover */
  cmds: PathCmd[];
  /** the width of its stroke in px */
  width: number;
  /** the radius of its centre line in px */
  r: number;
}

/**
 * The five arcs, outermost first, scaled so that the OUTER arc's centre line is `diameterPx` across and the dial's centre
 * (CX, CY) lies at (`cx`, `cy`) on the cover. Nothing else about the geometry changes: the scale is one number.
 */
export function dialArcs(cx: number, cy: number, diameterPx: number): DialArc[] {
  const s = diameterPx / (2 * RADII[0]);
  const m = [s, 0, 0, s, cx - s * CX, cy - s * CY] as const;
  return RADII.map((r) => ({ cmds: transformPath(parsePath(arcPath(r)), m), width: DIAL_STROKE * s, r: r * s }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// the Mark (verbatim from appendix-A.md)
// ---------------------------------------------------------------------------------------------------------------------------

export const MARK_VIEWBOX = 32;

/** The five circles of the Mark in its 32 x 32 viewBox, in the order of the SVG. `accent` is the crimson centre. */
export interface MarkCircle {
  r: number;
  /** a ring, drawn with this stroke width; or null for a filled disc */
  stroke: number | null;
  dash?: readonly [number, number];
  opacity: number;
  /** true: coloured by the accent (the centre), false: by `currentColor` (the ink) */
  accent: boolean;
}

export const MARK_CX = 16;
export const MARK_CY = 16;
export const MARK: readonly MarkCircle[] = [
  { r: 14.8, stroke: 1, dash: [1.2, 2.4], opacity: 0.5, accent: false },
  { r: 10.4, stroke: 1.2, opacity: 0.78, accent: false },
  { r: 6, stroke: 1.7, opacity: 1, accent: false },
  { r: 4.4, stroke: null, opacity: 0.2, accent: true },
  { r: 2.2, stroke: null, opacity: 1, accent: true },
];

export interface MarkShape {
  cmds: PathCmd[];
  mode: "fill" | "stroke";
  /** px */
  width: number;
  dash?: readonly [number, number];
  opacity: number;
  color: string;
}

/** The Mark's circles scaled to `sizePx` across and centred on (`cx`, `cy`). `currentColor` is the book's ink, the accent the site's crimson. */
export function markShapes(cx: number, cy: number, sizePx: number): MarkShape[] {
  const s = sizePx / MARK_VIEWBOX;
  return MARK.map((c) => ({
    cmds: circleCmds(cx + (MARK_CX - MARK_VIEWBOX / 2) * s, cy + (MARK_CY - MARK_VIEWBOX / 2) * s, c.r * s),
    mode: c.stroke === null ? "fill" : "stroke",
    width: (c.stroke ?? 0) * s,
    dash: c.dash ? [c.dash[0] * s, c.dash[1] * s] : undefined,
    opacity: c.opacity,
    color: c.accent ? CRIMSON : INK,
  }));
}
