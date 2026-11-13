// SVG PATHS FOR PAINTED SURFACES (Patch 08). Pure functions: a path string in, numbers out. Nothing here draws by itself.
//
// WHY: the foil masks need clean outlines, and three things on the covers are paths that must be used exactly and never redrawn by
// eye: the traced Mini Me mark (`public/brand/mini-me-mark.svg`), the x of the site (`public/site/brand/glyph-x.json`) and the arcs of
// the Blast Radius dial (`arcPath` in `brand.ts`). All three arrive as SVG path data; this file turns them into one small form.
//
// THE FORM. A path is a list of four kinds of command, all absolute: M (move), L (line), C (cubic Bezier) and Z (close). Every other
// SVG command is converted on the way in: relative ones become absolute, H and V become L, Q, S and T become C, and an elliptical
// arc A becomes one to four cubics (the standard endpoint to centre conversion, SVG 1.1 appendix F.6). So a painter needs only
// `drawPath` and an exact bounding box needs only `pathBounds`.
//
// NO RANDOMNESS, and no state: the same string always gives the same list.

export type PathCmd = { t: "M"; x: number; y: number } | { t: "L"; x: number; y: number } | { t: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number } | { t: "Z" };

/** An affine matrix as SVG writes it: [a, b, c, d, e, f] maps (x, y) to (a x + c y + e, b x + d y + f). */
export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ---------------------------------------------------------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------------------------------------------------------

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

class Scanner {
  i = 0;
  constructor(private readonly s: string) {}

  private skipSep(): void {
    while (this.i < this.s.length && /[\s,]/.test(this.s[this.i])) this.i++;
  }
  atEnd(): boolean {
    this.skipSep();
    return this.i >= this.s.length;
  }
  /** the next command letter, or null when the next token is a number (an implicit repeat of the last command) */
  command(): string | null {
    this.skipSep();
    const c = this.s[this.i];
    if (c !== undefined && /[a-zA-Z]/.test(c)) {
      this.i++;
      return c;
    }
    return null;
  }
  number(): number {
    this.skipSep();
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.s.slice(this.i));
    if (!m) throw new Error(`svgPath: expected a number at ${this.i} in "${this.s.slice(0, 60)}"`);
    this.i += m[0].length;
    return parseFloat(m[0]);
  }
  /** an arc flag: one character, 0 or 1, which may be glued to what follows ("a1 1 0 00.5.5") */
  flag(): number {
    this.skipSep();
    const c = this.s[this.i];
    if (c !== "0" && c !== "1") throw new Error(`svgPath: expected an arc flag (0 or 1) at ${this.i} in "${this.s.slice(0, 60)}"`);
    this.i++;
    return c === "1" ? 1 : 0;
  }
}

/** Parses SVG path data into absolute M, L, C and Z commands. Throws, naming the position, on anything it cannot read. */
export function parsePath(d: string): PathCmd[] {
  const sc = new Scanner(d);
  const out: PathCmd[] = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  // the last control point, for the smooth commands S and T (null when the previous command was not a curve of the right kind)
  let lastC: { x: number; y: number } | null = null;
  let lastQ: { x: number; y: number } | null = null;
  let cmd = "";
  let first = true;

  while (!sc.atEnd()) {
    const next = sc.command();
    if (next !== null) cmd = next;
    else if (cmd === "" || cmd === "Z" || cmd === "z") throw new Error(`svgPath: a number where a command was expected, in "${d.slice(0, 60)}"`);
    const up = cmd.toUpperCase();
    if (!(up in ARGS)) throw new Error(`svgPath: unknown command "${cmd}" in "${d.slice(0, 60)}"`);
    if (first && up !== "M") throw new Error(`svgPath: a path must start with M, got "${cmd}"`);
    first = false;
    const rel = cmd !== up;

    if (up === "Z") {
      out.push({ t: "Z" });
      cx = sx;
      cy = sy;
      lastC = null;
      lastQ = null;
      continue;
    }

    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (up) {
      case "M": {
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        out.push({ t: "M", x, y });
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        // numbers after a move are implicit lines
        cmd = rel ? "l" : "L";
        lastC = null;
        lastQ = null;
        break;
      }
      case "L": {
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        out.push({ t: "L", x, y });
        cx = x;
        cy = y;
        lastC = null;
        lastQ = null;
        break;
      }
      case "H": {
        const x = sc.number() + ox;
        out.push({ t: "L", x, y: cy });
        cx = x;
        lastC = null;
        lastQ = null;
        break;
      }
      case "V": {
        const y = sc.number() + oy;
        out.push({ t: "L", x: cx, y });
        cy = y;
        lastC = null;
        lastQ = null;
        break;
      }
      case "C": {
        const x1 = sc.number() + ox;
        const y1 = sc.number() + oy;
        const x2 = sc.number() + ox;
        const y2 = sc.number() + oy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        out.push({ t: "C", x1, y1, x2, y2, x, y });
        lastC = { x: x2, y: y2 };
        lastQ = null;
        cx = x;
        cy = y;
        break;
      }
      case "S": {
        const x1: number = lastC ? 2 * cx - lastC.x : cx;
        const y1: number = lastC ? 2 * cy - lastC.y : cy;
        const x2 = sc.number() + ox;
        const y2 = sc.number() + oy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        out.push({ t: "C", x1, y1, x2, y2, x, y });
        lastC = { x: x2, y: y2 };
        lastQ = null;
        cx = x;
        cy = y;
        break;
      }
      case "Q": {
        const qx = sc.number() + ox;
        const qy = sc.number() + oy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        out.push(quadToCubic(cx, cy, qx, qy, x, y));
        lastQ = { x: qx, y: qy };
        lastC = null;
        cx = x;
        cy = y;
        break;
      }
      case "T": {
        const qx: number = lastQ ? 2 * cx - lastQ.x : cx;
        const qy: number = lastQ ? 2 * cy - lastQ.y : cy;
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        out.push(quadToCubic(cx, cy, qx, qy, x, y));
        lastQ = { x: qx, y: qy };
        lastC = null;
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        const rx = sc.number();
        const ry = sc.number();
        const rotation = sc.number();
        const large = sc.flag();
        const sweep = sc.flag();
        const x = sc.number() + ox;
        const y = sc.number() + oy;
        for (const c of arcToCubics(cx, cy, rx, ry, rotation, large === 1, sweep === 1, x, y)) out.push(c);
        lastC = null;
        lastQ = null;
        cx = x;
        cy = y;
        break;
      }
    }
  }
  return out;
}

/** The cubic with the same curve as the quadratic from (x0, y0) through the control point (qx, qy) to (x, y). */
function quadToCubic(x0: number, y0: number, qx: number, qy: number, x: number, y: number): PathCmd {
  return { t: "C", x1: x0 + (2 / 3) * (qx - x0), y1: y0 + (2 / 3) * (qy - y0), x2: x + (2 / 3) * (qx - x), y2: y + (2 / 3) * (qy - y), x, y };
}

/**
 * An elliptical arc as cubics (SVG 1.1 appendix F.6.5 and F.6.6). `rotation` is in degrees. A zero radius is a straight line, and a
 * radius too small to reach the end point is scaled up until it just does, as the specification says.
 */
export function arcToCubics(x0: number, y0: number, rxIn: number, ryIn: number, rotationDeg: number, large: boolean, sweep: boolean, x: number, y: number): PathCmd[] {
  if (x0 === x && y0 === y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [{ t: "L", x, y }];
  const phi = (rotationDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  // step 1: the end points in the ellipse's own frame, centred between them
  const hx = (x0 - x) / 2;
  const hy = (y0 - y) / 2;
  const px = cosP * hx + sinP * hy;
  const py = -sinP * hx + cosP * hy;

  // step 2: enlarge the radii if they cannot span the chord
  const lambda = (px * px) / (rx * rx) + (py * py) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // step 3: the centre in the ellipse's frame
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  const num = rx2 * ry2 - rx2 * py * py - ry2 * px * px;
  const den = rx2 * py * py + ry2 * px * px;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const qx = (k * rx * py) / ry;
  const qy = (-k * ry * px) / rx;

  // step 4: the centre in user space, the start angle and the sweep
  const ccx = cosP * qx - sinP * qy + (x0 + x) / 2;
  const ccy = sinP * qx + cosP * qy + (y0 + y) / 2;
  const theta1 = Math.atan2((py - qy) / ry, (px - qx) / rx);
  const theta2 = Math.atan2((-py - qy) / ry, (-px - qx) / rx);
  let dTheta = theta2 - theta1;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  else if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;

  // cut into pieces of at most a quarter turn; each is one cubic
  const n = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2) - 1e-9));
  const step = dTheta / n;
  const t = (4 / 3) * Math.tan(step / 4);
  const out: PathCmd[] = [];
  let a = theta1;
  const point = (ang: number): { x: number; y: number; dx: number; dy: number } => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    return {
      x: ccx + rx * ca * cosP - ry * sa * sinP,
      y: ccy + rx * ca * sinP + ry * sa * cosP,
      // the derivative with respect to the angle
      dx: -rx * sa * cosP - ry * ca * sinP,
      dy: -rx * sa * sinP + ry * ca * cosP,
    };
  };
  for (let i = 0; i < n; i++) {
    const p0 = point(a);
    const p1 = point(a + step);
    const last = i === n - 1;
    out.push({ t: "C", x1: p0.x + t * p0.dx, y1: p0.y + t * p0.dy, x2: p1.x - t * p1.dx, y2: p1.y - t * p1.dy, x: last ? x : p1.x, y: last ? y : p1.y });
    a += step;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// matrices and transforming
// ---------------------------------------------------------------------------------------------------------------------------

/** `a` after `b`: the result applies `b` first, then `a` (the order SVG nests transforms in). */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
export const translation = (tx: number, ty: number): Matrix => [1, 0, 0, 1, tx, ty];
export const scaling = (sx: number, sy: number = sx): Matrix => [sx, 0, 0, sy, 0, 0];
/** a turn of `rad` radians about the origin (in a y-down frame it is clockwise for a positive angle) */
export const rotation = (rad: number): Matrix => [Math.cos(rad), Math.sin(rad), -Math.sin(rad), Math.cos(rad), 0, 0];

export const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Parses an SVG `transform` attribute: translate, scale, rotate (degrees) and matrix, in any number and order. Others throw. */
export function parseTransform(text: string | undefined | null): Matrix {
  if (!text) return IDENTITY;
  let m: Matrix = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let found: RegExpExecArray | null;
  let any = false;
  while ((found = re.exec(text)) !== null) {
    any = true;
    const name = found[1];
    const v = found[2]
      .split(/[\s,]+/)
      .filter((s) => s !== "")
      .map(Number);
    if (v.some((n) => !Number.isFinite(n))) throw new Error(`svgPath: cannot read the numbers of transform "${found[0]}"`);
    let t: Matrix;
    if (name === "translate") t = translation(v[0] ?? 0, v[1] ?? 0);
    else if (name === "scale") t = scaling(v[0] ?? 1, v[1] ?? v[0] ?? 1);
    else if (name === "matrix" && v.length === 6) t = [v[0], v[1], v[2], v[3], v[4], v[5]];
    else if (name === "rotate") {
      const r = rotation(((v[0] ?? 0) * Math.PI) / 180);
      t = v.length >= 3 ? multiply(translation(v[1], v[2]), multiply(r, translation(-v[1], -v[2]))) : r;
    } else throw new Error(`svgPath: transform "${name}" is not supported (use translate, scale, rotate or matrix)`);
    m = multiply(m, t);
  }
  if (!any) throw new Error(`svgPath: cannot read transform "${text}"`);
  return m;
}

/** Every point of every command through the matrix. */
export function transformPath(cmds: readonly PathCmd[], m: Matrix): PathCmd[] {
  return cmds.map((c): PathCmd => {
    switch (c.t) {
      case "M":
      case "L": {
        const [x, y] = apply(m, c.x, c.y);
        return { t: c.t, x, y };
      }
      case "C": {
        const [x1, y1] = apply(m, c.x1, c.y1);
        const [x2, y2] = apply(m, c.x2, c.y2);
        const [x, y] = apply(m, c.x, c.y);
        return { t: "C", x1, y1, x2, y2, x, y };
      }
      case "Z":
        return { t: "Z" };
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// measuring
// ---------------------------------------------------------------------------------------------------------------------------

/** The parameters in [0, 1] where one coordinate of a cubic has a turning point. */
function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  // the derivative is a quadratic: a t^2 + b t + c
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const out: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) out.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      out.push((-b + r) / (2 * a), (-b - r) / (2 * a));
    }
  }
  return out.filter((t) => t > 0 && t < 1);
}

const cubicAt = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** The exact bounding box of a path (the extrema of its curves, not of their control points). Throws on a path with no points. */
export function pathBounds(cmds: readonly PathCmd[]): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const add = (x: number, y: number): void => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const c of cmds) {
    if (c.t === "M") {
      cx = c.x;
      cy = c.y;
      sx = c.x;
      sy = c.y;
      add(cx, cy);
    } else if (c.t === "L") {
      cx = c.x;
      cy = c.y;
      add(cx, cy);
    } else if (c.t === "C") {
      add(c.x, c.y);
      for (const t of cubicExtrema(cx, c.x1, c.x2, c.x)) add(cubicAt(cx, c.x1, c.x2, c.x, t), cubicAt(cy, c.y1, c.y2, c.y, t));
      for (const t of cubicExtrema(cy, c.y1, c.y2, c.y)) add(cubicAt(cx, c.x1, c.x2, c.x, t), cubicAt(cy, c.y1, c.y2, c.y, t));
      cx = c.x;
      cy = c.y;
    } else {
      cx = sx;
      cy = sy;
    }
  }
  if (!Number.isFinite(x0)) throw new Error("svgPath: a path with no points has no bounds");
  return { x0, y0, x1, y1 };
}

/**
 * The matrix that scales a path uniformly to `width` and puts the centre of its bounding box at (cx, cy). The bounds, not the
 * viewBox, decide, so an SVG with empty margins gives the same result as one cropped tight.
 */
export function fitToWidth(bounds: Box, width: number, cx: number, cy: number): Matrix {
  const w = bounds.x1 - bounds.x0;
  const s = width / w;
  const bx = (bounds.x0 + bounds.x1) / 2;
  const by = (bounds.y0 + bounds.y1) / 2;
  return [s, 0, 0, s, cx - s * bx, cy - s * by];
}

// ---------------------------------------------------------------------------------------------------------------------------
// building
// ---------------------------------------------------------------------------------------------------------------------------

/** A circle as four cubics, starting at 3 o'clock and going clockwise on screen: the way an SVG `<circle>` is stroked, so dashes line up. */
export function circleCmds(cx: number, cy: number, r: number): PathCmd[] {
  return ellipseCmds(cx, cy, r, r);
}

/** An axis-aligned ellipse as four cubics (kappa = 0.5522847498), starting at 3 o'clock, clockwise on screen. */
export function ellipseCmds(cx: number, cy: number, rx: number, ry: number): PathCmd[] {
  const k = 0.5522847498307936;
  return [
    { t: "M", x: cx + rx, y: cy },
    { t: "C", x1: cx + rx, y1: cy + k * ry, x2: cx + k * rx, y2: cy + ry, x: cx, y: cy + ry },
    { t: "C", x1: cx - k * rx, y1: cy + ry, x2: cx - rx, y2: cy + k * ry, x: cx - rx, y: cy },
    { t: "C", x1: cx - rx, y1: cy - k * ry, x2: cx - k * rx, y2: cy - ry, x: cx, y: cy - ry },
    { t: "C", x1: cx + k * rx, y1: cy - ry, x2: cx + rx, y2: cy - k * ry, x: cx + rx, y: cy },
    { t: "Z" },
  ];
}

export function rectCmds(x: number, y: number, w: number, h: number): PathCmd[] {
  return [{ t: "M", x, y }, { t: "L", x: x + w, y }, { t: "L", x: x + w, y: y + h }, { t: "L", x, y: y + h }, { t: "Z" }];
}

/** A rectangle with round corners of radius `r` (never more than half the shorter side). */
export function roundRectCmds(x: number, y: number, w: number, h: number, rIn: number): PathCmd[] {
  const r = Math.max(0, Math.min(rIn, w / 2, h / 2));
  if (r === 0) return rectCmds(x, y, w, h);
  const k = 0.5522847498307936 * r;
  const x1 = x + w;
  const y1 = y + h;
  return [
    { t: "M", x: x + r, y },
    { t: "L", x: x1 - r, y },
    { t: "C", x1: x1 - r + k, y1: y, x2: x1, y2: y + r - k, x: x1, y: y + r },
    { t: "L", x: x1, y: y1 - r },
    { t: "C", x1: x1, y1: y1 - r + k, x2: x1 - r + k, y2: y1, x: x1 - r, y: y1 },
    { t: "L", x: x + r, y: y1 },
    { t: "C", x1: x + r - k, y1: y1, x2: x, y2: y1 - r + k, x, y: y1 - r },
    { t: "L", x, y: y + r },
    { t: "C", x1: x, y1: y + r - k, x2: x + r - k, y2: y, x: x + r, y },
    { t: "Z" },
  ];
}

// ---------------------------------------------------------------------------------------------------------------------------
// drawing and writing
// ---------------------------------------------------------------------------------------------------------------------------

/** The part of a 2D context `drawPath` uses (so a test can pass a recorder). It does not call `beginPath`: the caller decides. */
export type PathCtx = Pick<CanvasRenderingContext2D, "moveTo" | "lineTo" | "bezierCurveTo" | "closePath">;

export function drawPath(ctx: PathCtx, cmds: readonly PathCmd[]): void {
  for (const c of cmds) {
    if (c.t === "M") ctx.moveTo(c.x, c.y);
    else if (c.t === "L") ctx.lineTo(c.x, c.y);
    else if (c.t === "C") ctx.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else ctx.closePath();
  }
}

const n4 = (v: number): string => String(Math.round(v * 1e4) / 1e4);

/** The path as SVG data again (absolute, four decimals): for tests, for the notes and for a quick look in a browser. */
export function pathToString(cmds: readonly PathCmd[]): string {
  return cmds
    .map((c) => {
      if (c.t === "M" || c.t === "L") return `${c.t}${n4(c.x)} ${n4(c.y)}`;
      if (c.t === "C") return `C${n4(c.x1)} ${n4(c.y1)} ${n4(c.x2)} ${n4(c.y2)} ${n4(c.x)} ${n4(c.y)}`;
      return "Z";
    })
    .join("");
}

// ---------------------------------------------------------------------------------------------------------------------------
// an SVG file with paths in it (the traced mark)
// ---------------------------------------------------------------------------------------------------------------------------

export interface ParsedSvg {
  /** every path of the file, with the transforms of its groups and of itself applied, in the file's own user space (the viewBox) */
  cmds: PathCmd[];
  viewBox: [number, number, number, number] | null;
}

/**
 * Reads an SVG file made by a tracer or an editor: the `viewBox`, and every `<path d=...>`, through the `transform` of the `<g>`
 * elements around it and of the path itself. Only paths are read (a trace is paths); a file with none throws, naming the fix.
 */
export function parseSvgPaths(text: string): ParsedSvg {
  const vb = /<svg\b[^>]*\bviewBox\s*=\s*"([^"]+)"/i.exec(text);
  let viewBox: [number, number, number, number] | null = null;
  if (vb) {
    const v = vb[1].split(/[\s,]+/).map(Number);
    if (v.length === 4 && v.every(Number.isFinite)) viewBox = [v[0], v[1], v[2], v[3]];
  }
  const stack: Matrix[] = [IDENTITY];
  const cmds: PathCmd[] = [];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g;
  const attr = (attrs: string, name: string): string | undefined => {
    const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(attrs);
    return m ? m[1] : undefined;
  };
  let t: RegExpExecArray | null;
  while ((t = tag.exec(text)) !== null) {
    const closing = t[1] === "/";
    const name = t[2].toLowerCase();
    const attrs = t[3];
    const selfClosing = t[4] === "/";
    if (name === "g") {
      if (closing) {
        if (stack.length > 1) stack.pop();
      } else if (!selfClosing) {
        stack.push(multiply(stack[stack.length - 1], parseTransform(attr(attrs, "transform"))));
      }
    } else if (name === "path" && !closing) {
      const d = attr(attrs, "d");
      if (!d) continue;
      const m = multiply(stack[stack.length - 1], parseTransform(attr(attrs, "transform")));
      for (const c of transformPath(parsePath(d), m)) cmds.push(c);
    }
  }
  if (cmds.length === 0) throw new Error("svgPath: the SVG has no <path>. Trace the mark to outlines (Inkscape: Path > Trace Bitmap, then Object to Path) and save it again");
  return { cmds, viewBox };
}
