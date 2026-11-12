// THE ENDPAPER PATTERNS (Patch 07). Pure functions: a project's slug, `motif` and `palette` in, a list of shapes out; a second function
// draws that list on a 2D canvas. No Math.random (everything is seeded from the slug), and no trigonometry in the generator (a
// direction is a vector, a wave is a smoothstep of a triangle), so the same project gives the same shapes on every machine.
//
// THE TILE. A pattern is one square tile in unit coordinates (0 to 1 each way) that repeats. A shape that crosses the tile's edge is
// meant to continue on the other side, so `paintPattern` draws every shape nine times (offsets -1, 0, 1 in each axis) and the
// tile's border has no seam. The ground is the endpaper colour; the shapes are the palette's colour at a low alpha, because an
// endpaper is matte printed paper and not a graphic (guide 03 section 3, guide 04 section 4: P-END).
//
// Names come from the data: `projects.js` names a motif (`rings`, `orbits`, `nodes`, `waves`, and the two the brief lists, `bars` and
// `tiles`) and a palette token (`ink`, `indigo`, `forest`, `crimson`, see `PALETTE_TOKENS`). Patch 09 paints the real endpaper page
// with this; Patch 08 samples the site's real palette values, which this file reads through `PALETTE_TOKENS`.

import { PALETTE_TOKENS } from "../config/materials";
import { fnv1a } from "../lib/hash";
import { prng, range, type Rand } from "../lib/prng";

export const MOTIFS = ["rings", "orbits", "nodes", "waves", "bars", "tiles"] as const;
export type Motif = (typeof MOTIFS)[number];

/** Every coordinate and width is in tile units (the tile is 1 x 1). `alpha` is 0 to 1. */
export type PatternShape =
  | { kind: "circle"; cx: number; cy: number; r: number; width: number; fill: boolean; alpha: number }
  /** an ellipse as a circle through a 2 x 2 matrix: `ax, ay` is the major half-axis as a vector, the minor one is `k` times it turned a quarter */
  | { kind: "ellipse"; cx: number; cy: number; ax: number; ay: number; k: number; width: number; alpha: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; width: number; alpha: number }
  | { kind: "poly"; points: readonly (readonly [number, number])[]; width: number; alpha: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; width: number; fill: boolean; alpha: number };

export interface PatternSpec {
  slug: string;
  motif: Motif;
  palette: string;
  /** the paper under the pattern */
  ground: string;
  /** the pattern's colour (the palette token's hex) */
  ink: string;
  shapes: readonly PatternShape[];
}

export interface PatternInput {
  /** the project's slug: it seeds the pattern, so each book's endpaper is its own */
  slug: string;
  motif: string;
  /** a palette token: a key of `PALETTE_TOKENS` */
  palette: string;
  /** the paper colour under the pattern (default: the endpaper colour of the book, `#D8CDB6`) */
  ground?: string;
}

/** The default ground: the same as `ENDPAPER` in `config/books.ts`. */
export const ENDPAPER_GROUND = "#D8CDB6";

export const isMotif = (m: string): m is Motif => (MOTIFS as readonly string[]).includes(m);

/** A smooth periodic wave in [-1, 1] of the phase `p` (any real; period 1): a smoothstep of a triangle, so it needs no sine. */
export function wave(p: number): number {
  const q = p - Math.floor(p);
  const a = q < 0.5 ? q * 2 : (1 - q) * 2;
  return a * a * (3 - 2 * a) * 2 - 1;
}

/** A unit vector from the first point of a seeded sequence that falls inside the unit disc (no trigonometry). */
function direction(r: Rand): [number, number] {
  for (let t = 0; t < 16; t++) {
    const x = r() * 2 - 1;
    const y = r() * 2 - 1;
    const d2 = x * x + y * y;
    if (d2 > 0.05 && d2 <= 1) {
      const inv = 1 / Math.sqrt(d2);
      return [x * inv, y * inv];
    }
  }
  return [1, 0];
}

/** The nearest copy of (bx, by) to (ax, ay) on the torus: an edge of a graph that crosses the tile's border continues on the other side. */
function nearestImage(ax: number, ay: number, bx: number, by: number): { x: number; y: number; d: number } {
  let dx = bx - ax;
  let dy = by - ay;
  dx -= Math.round(dx);
  dy -= Math.round(dy);
  return { x: ax + dx, y: ay + dy, d: Math.sqrt(dx * dx + dy * dy) };
}

type Maker = (r: Rand) => PatternShape[];

const rings: Maker = (r) => {
  const out: PatternShape[] = [];
  const centres = 2 + Math.floor(r() * 2);
  for (let c = 0; c < centres; c++) {
    const cx = r();
    const cy = r();
    const n = 4 + Math.floor(r() * 3);
    const r0 = range(r, 0.04, 0.08);
    const step = range(r, 0.035, 0.06);
    for (let i = 0; i < n; i++) out.push({ kind: "circle", cx, cy, r: r0 + step * i, width: 0.006, fill: false, alpha: 0.32 - 0.03 * i });
    out.push({ kind: "circle", cx, cy, r: 0.012, width: 0, fill: true, alpha: 0.4 });
  }
  return out;
};

const orbits: Maker = (r) => {
  const out: PatternShape[] = [];
  const systems = 2;
  for (let s = 0; s < systems; s++) {
    const cx = r();
    const cy = r();
    const [dx, dy] = direction(r);
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = 0.07 + 0.05 * i;
      const k = range(r, 0.45, 0.8);
      out.push({ kind: "ellipse", cx, cy, ax: dx * a, ay: dy * a, k, width: 0.0045, alpha: 0.3 });
      // a body on the orbit: the end of its major axis, or of its minor one
      const end = r() < 0.5 ? 1 : -1;
      if (r() < 0.8) out.push({ kind: "circle", cx: cx + end * dx * a, cy: cy + end * dy * a, r: 0.011, width: 0, fill: true, alpha: 0.55 });
    }
    out.push({ kind: "circle", cx, cy, r: 0.016, width: 0, fill: true, alpha: 0.5 });
  }
  return out;
};

const nodes: Maker = (r) => {
  const out: PatternShape[] = [];
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([r(), r()]);
  for (let i = 0; i < n; i++) {
    // each node reaches for its two nearest neighbours (counted on the torus, so the graph has no seam)
    const near = pts
      .map((p, j) => ({ j, ...nearestImage(pts[i][0], pts[i][1], p[0], p[1]) }))
      .filter((q) => q.j !== i)
      .sort((a, b) => a.d - b.d || a.j - b.j)
      .slice(0, 2);
    for (const q of near) if (q.d < 0.34) out.push({ kind: "line", x1: pts[i][0], y1: pts[i][1], x2: q.x, y2: q.y, width: 0.004, alpha: 0.26 });
  }
  for (const p of pts) out.push({ kind: "circle", cx: p[0], cy: p[1], r: range(r, 0.011, 0.02), width: 0, fill: true, alpha: 0.5 });
  return out;
};

const waves: Maker = (r) => {
  const out: PatternShape[] = [];
  const rows = 7 + Math.floor(r() * 3);
  const cycles = 2 + Math.floor(r() * 2); // whole cycles per tile, so the line meets itself at the border
  const amp = range(r, 0.2, 0.34) / rows;
  const shift = r();
  for (let i = 0; i < rows; i++) {
    const y0 = (i + 0.5) / rows;
    const points: [number, number][] = [];
    const steps = 48;
    for (let s = 0; s <= steps; s++) points.push([s / steps, y0 + amp * wave(cycles * (s / steps) + shift + i * 0.11)]);
    out.push({ kind: "poly", points, width: 0.0045, alpha: 0.3 });
  }
  return out;
};

const bars: Maker = (r) => {
  const out: PatternShape[] = [];
  const cols = 10 + Math.floor(r() * 4);
  const rows = 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const h = range(r, 0.1, 0.38);
      const w = 0.55 / cols;
      out.push({ kind: "rect", x: (i + 0.22) / cols, y: (j + 0.5) / rows - h / 2, w, h, width: 0, fill: true, alpha: 0.18 + 0.2 * r() });
    }
  }
  return out;
};

const tiles: Maker = (r) => {
  const out: PatternShape[] = [];
  const n = 6;
  const c = 1 / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const pick = r();
      const x = i * c;
      const y = j * c;
      out.push({ kind: "rect", x: x + 0.1 * c, y: y + 0.1 * c, w: 0.8 * c, h: 0.8 * c, width: 0.0035, fill: false, alpha: 0.2 });
      if (pick < 0.22) out.push({ kind: "rect", x: x + 0.28 * c, y: y + 0.28 * c, w: 0.44 * c, h: 0.44 * c, width: 0, fill: true, alpha: 0.34 });
      else if (pick < 0.44) out.push({ kind: "line", x1: x + 0.1 * c, y1: y + 0.1 * c, x2: x + 0.9 * c, y2: y + 0.9 * c, width: 0.0035, alpha: 0.28 });
      else if (pick < 0.6) out.push({ kind: "line", x1: x + 0.9 * c, y1: y + 0.1 * c, x2: x + 0.1 * c, y2: y + 0.9 * c, width: 0.0035, alpha: 0.28 });
    }
  }
  return out;
};

const MAKERS: Record<Motif, Maker> = { rings, orbits, nodes, waves, bars, tiles };

/**
 * The pattern of one project's endpaper. Seeded from the slug and the motif, so a book always gets the same one and two books
 * differ even when they share a motif. Throws for a motif or a palette token it does not know (a typo in the data must not give a
 * blank page).
 */
export function endpaperPattern(input: PatternInput): PatternSpec {
  if (!isMotif(input.motif)) throw new Error(`patterns: unknown motif "${input.motif}" for "${input.slug}" (known: ${MOTIFS.join(", ")})`);
  const ink = PALETTE_TOKENS[input.palette];
  if (!ink) throw new Error(`patterns: unknown palette token "${input.palette}" for "${input.slug}" (known: ${Object.keys(PALETTE_TOKENS).join(", ")})`);
  const motif: Motif = input.motif;
  const r = prng(fnv1a(`${input.slug}/${motif}`) ^ 0x5eed07);
  return { slug: input.slug, motif, palette: input.palette, ground: input.ground ?? ENDPAPER_GROUND, ink, shapes: MAKERS[motif](r) };
}

/** The part of a 2D canvas context `paintPattern` uses (so a test can pass a recorder). */
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  "save" | "restore" | "translate" | "transform" | "beginPath" | "arc" | "moveTo" | "lineTo" | "rect" | "fill" | "stroke" | "fillRect" | "fillStyle" | "strokeStyle" | "lineWidth" | "globalAlpha" | "lineCap" | "lineJoin"
>;

/**
 * Draws the pattern as a `size` x `size` px tile: the ground, then every shape nine times (offsets -1, 0 and 1 in x and y) so what
 * crosses the border continues on the other side. The same spec and size always draw the same pixels.
 */
export function paintPattern(ctx: Ctx2D, spec: PatternSpec, size: number): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = spec.ground;
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = spec.ink;
  ctx.strokeStyle = spec.ink;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      for (const s of spec.shapes) drawShape(ctx, s, ox, oy, size);
    }
  }
  ctx.restore();
}

function drawShape(ctx: Ctx2D, s: PatternShape, ox: number, oy: number, size: number): void {
  const px = (v: number, o: number): number => (v + o) * size;
  ctx.globalAlpha = s.alpha;
  ctx.beginPath();
  switch (s.kind) {
    case "circle": {
      ctx.arc(px(s.cx, ox), px(s.cy, oy), s.r * size, 0, Math.PI * 2);
      if (s.fill) ctx.fill();
      else {
        ctx.lineWidth = s.width * size;
        ctx.stroke();
      }
      return;
    }
    case "ellipse": {
      // the unit circle through the matrix [ax ay; -k ay  k ax] (in px), drawn, then the matrix is undone before the stroke so the line keeps its width
      ctx.save();
      ctx.transform(s.ax * size, s.ay * size, -s.ay * s.k * size, s.ax * s.k * size, px(s.cx, ox), px(s.cy, oy));
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.restore();
      ctx.lineWidth = s.width * size;
      ctx.stroke();
      return;
    }
    case "line": {
      ctx.moveTo(px(s.x1, ox), px(s.y1, oy));
      ctx.lineTo(px(s.x2, ox), px(s.y2, oy));
      ctx.lineWidth = s.width * size;
      ctx.stroke();
      return;
    }
    case "poly": {
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(px(p[0], ox), px(p[1], oy)) : ctx.lineTo(px(p[0], ox), px(p[1], oy))));
      ctx.lineWidth = s.width * size;
      ctx.stroke();
      return;
    }
    case "rect": {
      ctx.rect(px(s.x, ox), px(s.y, oy), s.w * size, s.h * size);
      if (s.fill) ctx.fill();
      else {
        ctx.lineWidth = s.width * size;
        ctx.stroke();
      }
      return;
    }
  }
}
