// THE SHARED GRAMMAR OF THE COVERS (Patch 08, guide 04 section 2). A cover is a front, a spine and a back; every book has the same
// title block, small line, authors, spine and back layout, and differs in its picture (`CoverArt`) and in how it is made
// (`COVER_STYLE`). This file turns one book's `CoverArt`, its data and its tokens into a `CoverPlan`. Pure: numbers in, operations out.
//
// FRAMES. Every surface is read the way the anchor frames of `src/book/geometry.ts` say: +X to the right, the head of the book up.
//   front   the outer face of the front board; the hinge (the spine side) is on the LEFT
//   back    the outer face of the back board, turned over the way a reader turns a book: the hinge is on the RIGHT
//   spine   across its arc (the front board is on the right) and along the book (the head is up). Its text reads TOP TO BOTTOM.
//
// TRUTH. Titles, lines, summaries and names are read from `CoverData` (selectors and `bookText.ts`); nothing here is typed.

import { BOOK_GEOMETRY } from "../../config/books";
import type { BookSpec } from "../../config/books";
import { COVER, COVER_STYLE, CRIMSON, INK, OFF_WHITE, PT_CM, type ColorRole, type Fill, type CoverStyle } from "../../config/covers";
import { contrastRatio } from "../../lib/color";
import { layoutOf } from "../../book/geometry";
import glyphX from "../../../public/site/brand/glyph-x.json";
import { circleCmds, fitToWidth, multiply, parsePath, parseSvgPaths, pathBounds, rotation, scaling, transformPath, translation, type PathCmd } from "../svgPath";
import { balancedWrap, fitSize, layoutTitle, smallCapsLayout, type FontSpec, type Measure, type TypeFace } from "../typography";
import type { CoverData, CoverPlan, CoverTokens, Layer, Op, Paint, Rect, ShapeOp, SurfacePlan, TextOp } from "./types";
import type { Surface } from "../../config/covers";

// ---------------------------------------------------------------------------------------------------------------------------
// the context and the frame
// ---------------------------------------------------------------------------------------------------------------------------

/** What every helper needs: the data, the tokens, the book's style, and the list the painter writes its notes to. */
export interface Ctx {
  data: CoverData;
  tokens: CoverTokens;
  spec: BookSpec;
  style: CoverStyle;
  measure: Measure;
  notes: string[];
}

/** One surface: its size in px and cm, and the helpers that turn cm and points into px at its resolution. */
export interface Frame {
  surface: Surface;
  w: number;
  h: number;
  ppc: number;
  widthCm: number;
  heightCm: number;
  safe: Rect;
  /** cm to px */
  cm: (v: number) => number;
  /** points to px */
  pt: (v: number) => number;
}

export function makeCtx(data: CoverData, tokens: CoverTokens): Ctx {
  if (data.id !== tokens.spec.id) throw new Error(`covers: data is for "${data.id}" but the tokens are for "${tokens.spec.id}"`);
  return { data, tokens, spec: tokens.spec, style: COVER_STYLE[data.id], measure: tokens.measure, notes: [] };
}

/** The painted size of a surface in cm: the board's face (hinge to fore-edge by head to tail), or the spine's arc by the length. */
export function surfaceCm(spec: BookSpec, surface: Surface): { w: number; h: number } {
  const L = layoutOf(spec);
  if (surface === "spine") {
    const R = BOOK_GEOMETRY.spineRadiusCm;
    return { w: 2 * R * Math.asin(L.T / (2 * R)), h: L.H };
  }
  return { w: L.W / 2 - L.hingeX, h: L.H };
}

export function makeFrame(spec: BookSpec, surface: Surface): Frame {
  const ppc = COVER.pxPerCm[surface];
  const cmSize = surfaceCm(spec, surface);
  const w = Math.round(cmSize.w * ppc);
  const h = Math.round(cmSize.h * ppc);
  const s = surface === "spine" ? COVER.safe.spine : COVER.safe.board;
  const safe: Rect = { x: s.left * ppc, y: s.top * ppc, w: w - (s.left + s.right) * ppc, h: h - (s.top + s.bottom) * ppc };
  return { surface, w, h, ppc, widthCm: cmSize.w, heightCm: cmSize.h, safe, cm: (v) => v * ppc, pt: (v) => v * PT_CM * ppc };
}

// ---------------------------------------------------------------------------------------------------------------------------
// paint
// ---------------------------------------------------------------------------------------------------------------------------

/** The hex of a colour role: the foils are the book's own (`spec.colors.foil`), the rest are the family look's fixed colours. */
export function colorOf(ctx: Ctx, role: ColorRole): string {
  switch (role) {
    case "foilPrimary":
      return ctx.spec.colors.foil.primary;
    case "foilSecondary":
      return ctx.spec.colors.foil.secondary;
    case "offWhite":
      return OFF_WHITE;
    case "ink":
      return INK;
    case "crimson":
      return CRIMSON;
  }
}

/** A `Fill` of the style table as an operation's paint: foil is full strength and takes the full deboss, ink keeps its alpha. */
export function paintOf(ctx: Ctx, f: Fill): Paint {
  if (f.layer === "foil") return { layer: "foil", fill: colorOf(ctx, f.color), alpha: 1, depth: COVER.depth.foil };
  return { layer: "ink", fill: colorOf(ctx, f.color), alpha: f.alpha ?? 1, depth: 0 };
}

/** A blind stamp in the book's own primary foil colour (Immersive: a near-black on the dark crimson). */
export const blindPaint = (ctx: Ctx, alpha: number): Paint => ({ layer: "blind", fill: ctx.spec.colors.foil.primary, alpha, depth: COVER.depth.blind });

/**
 * The publisher's x is the site's crimson, stamped. Against a cloth it cannot be read on (WCAG ratio under `xMinContrast`: the
 * indigo and the darkened crimson) it takes the book's secondary foil instead (D-39).
 */
export function xPaint(ctx: Ctx): Paint {
  const ok = contrastRatio(CRIMSON, ctx.spec.colors.cloth) >= COVER.xMinContrast;
  return paintOf(ctx, { layer: "foil", color: ok ? "crimson" : "foilSecondary" });
}

// ---------------------------------------------------------------------------------------------------------------------------
// shapes and text as operations
// ---------------------------------------------------------------------------------------------------------------------------

export const fillOp = (cmds: readonly PathCmd[], paint: Paint): ShapeOp => ({ kind: "shape", cmds, mode: "fill", ...paint });
export const strokeOp = (cmds: readonly PathCmd[], paint: Paint, width: number, extra: { cap?: CanvasLineCap; dash?: readonly number[] } = {}): ShapeOp => ({ kind: "shape", cmds, mode: "stroke", stroke: { width, ...extra }, ...paint });

export function textOp(paint: Paint, text: string, x: number, y: number, face: TypeFace, size: number, rotationRad = 0): TextOp {
  return { kind: "text", text, x, y, rotation: rotationRad, size, face, ...paint };
}

export function glyphOp(paint: Paint, line: { glyphs: TextOp["glyphs"]; width: number }, x: number, y: number, face: TypeFace, size: number, rotationRad = 0): TextOp {
  return { kind: "text", text: (line.glyphs ?? []).map((g) => g.ch).join(""), x, y, rotation: rotationRad, size, face, glyphs: line.glyphs, ...paint };
}

const ROMAN: TypeFace = { role: "serif", weight: 400, style: "normal" };
const ITALIC: TypeFace = { role: "serif", weight: 400, style: "italic" };
const BOLD: TypeFace = { role: "serif", weight: 700, style: "normal" };

/** How tall a capital is, in em of CMU Serif (about 0.68); used to centre text by its capitals and to place a block by its top. */
const CAP = 0.68;
/** How far the baseline sits below the top of a line's em box (the same 0.8 that `layoutTitle` uses). */
const ASCENT = 0.8;

// ---------------------------------------------------------------------------------------------------------------------------
// the x and the traced mark
// ---------------------------------------------------------------------------------------------------------------------------

interface Glyph {
  d: string;
}

let xCache: PathCmd[] | null = null;
/** The x of the site as path commands, centred on the origin and `1` wide, y down (a font's outline has y up, so it is turned over). */
function unitX(): PathCmd[] {
  if (xCache) return xCache;
  const up = parsePath((glyphX as Glyph).d);
  const down = transformPath(up, scaling(1, -1));
  xCache = transformPath(down, fitToWidth(pathBounds(down), 1, 0, 0));
  return xCache;
}

/** The height of the x as a share of its width (the glyph's bounds: 537 by 467 units). */
export const X_ASPECT = 467 / 537;

/**
 * The publisher's x, `width` px wide, centred on (`cx`, `cy`), turned by `rotationRad` about its centre (a spine's x reads like its
 * text, a quarter turn). The path is the site's own, scaled by one number.
 */
export function publisherXOps(ctx: Ctx, cx: number, cy: number, width: number, rotationRad = 0): ShapeOp[] {
  const m = multiply(translation(cx, cy), multiply(rotation(rotationRad), scaling(width)));
  return [fillOp(transformPath(unitX(), m), xPaint(ctx))];
}

/**
 * The traced Mini Me mark, `width` px wide, centred on `cx`, with its top edge at `y` px (`anchor` "top") or its middle there
 * ("centre"). The file is `public/brand/mini-me-mark.svg`, drawn by hand (Patch 08, "Before you start"); when it is missing the
 * mark is left off and the plan says so, because redrawing a logo by eye is exactly what this file is for not doing.
 */
export function tracedMarkOps(ctx: Ctx, cx: number, y: number, width: number, paint: Paint, anchor: "top" | "centre" = "top"): ShapeOp[] {
  const svg = ctx.tokens.miniMeMarkSvg;
  if (svg === null) {
    ctx.notes.push("the Mini Me mark is missing: vectorise mini-me-logo.png (Inkscape: Path > Trace Bitmap, then Object to Path) and save it as public/brand/mini-me-mark.svg");
    return [];
  }
  const parsed = parseSvgPaths(svg);
  const b = pathBounds(parsed.cmds);
  const height = (width * (b.y1 - b.y0)) / (b.x1 - b.x0);
  const m = fitToWidth(b, width, cx, anchor === "top" ? y + height / 2 : y);
  return [fillOp(transformPath(parsed.cmds, m), paint)];
}

// ---------------------------------------------------------------------------------------------------------------------------
// the art of one book
// ---------------------------------------------------------------------------------------------------------------------------

/** What differs from book to book. The rest of the cover is the shared grammar below. */
export interface CoverArt {
  /** the picture on the front board (the mark, the orbits, the dial, the globe) */
  front: (ctx: Ctx, f: Frame) => Op[];
  title: {
    /** `centre`: `at` is the share of the board's height where the middle of the title block sits; `top`: where its top (the capitals) sits */
    mode: "centre" | "top";
    at: number;
    /** each part of the title on its own line (SPHEREx, Immersive) */
    breakAtStyleChange: boolean;
  };
  /** the small line under the title: its face, and whether it is set in small capitals */
  line: { italic: boolean; smallCaps: boolean };
  /** a mark at the head of the spine: `size` is the room reserved for it (cm, in px here), `cy` the middle of that room */
  emblem: ((ctx: Ctx, cx: number, cy: number, size: number) => Op[]) | null;
  /** which of the editorial lines the back cover prints, besides the QR slot and the x */
  back: { line: boolean; summary: boolean; backLine: boolean };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the front
// ---------------------------------------------------------------------------------------------------------------------------

interface Placed {
  ops: Op[];
  /** the baseline of the last line, px */
  baseline: number;
  /** the em size of that line, px */
  size: number;
}

function titleOps(ctx: Ctx, f: Frame, art: CoverArt): Placed {
  const T = COVER.front;
  const size = f.pt(T.titlePt);
  const layout = layoutTitle(ctx.data.title, ctx.measure, { size, secondSize: size * T.secondRatio, maxWidth: f.safe.w, breakAtStyleChange: art.title.breakAtStyleChange, lineHeight: T.lineHeight });
  const first = layout.lines[0].size;
  const top = art.title.mode === "centre" ? f.h * art.title.at - ((ASCENT - CAP) * first + layout.height) / 2 : f.h * art.title.at - (ASCENT - CAP) * first;
  const ops: Op[] = [];
  for (const line of layout.lines) {
    const x0 = f.w / 2 - line.width / 2;
    for (const run of line.runs) ops.push(textOp(paintOf(ctx, ctx.style.title[run.style]), run.text, x0 + run.x, top + line.baseline, titleFace(run.style), run.size));
  }
  const last = layout.lines[layout.lines.length - 1];
  return { ops, baseline: top + last.baseline, size: last.size };
}

const titleFace = (style: "plain" | "italic" | "crimson"): TypeFace => (style === "italic" ? ITALIC : BOLD);

function lineOps(ctx: Ctx, f: Frame, art: CoverArt, below: Placed): Op[] {
  const text = ctx.data.coverLine;
  if (!text) return [];
  const T = COVER.front;
  const face = art.line.italic ? ITALIC : ROMAN;
  const paint = paintOf(ctx, ctx.style.line);
  const maxSize = f.pt(T.linePt);
  // the baseline: below the title's descenders by the gap, measured in em of the line
  const baseline = (size: number): number => below.baseline + 0.25 * below.size + T.lineGapEm * size;
  if (art.line.smallCaps) {
    const lay = (size: number) => smallCapsLayout(text, ctx.measure, { ...face, size }, { trackingEm: 0.12 });
    const w0 = lay(maxSize).width;
    const size = w0 > f.safe.w ? (maxSize * f.safe.w) / w0 : maxSize;
    const line = lay(size);
    return [glyphOp(paint, line, f.w / 2 - line.width / 2, baseline(size), face, size)];
  }
  const fit = fitSize(text, ctx.measure, face, f.safe.w, maxSize, 0);
  const w = ctx.measure(text, { ...face, size: fit.size });
  return [textOp(paint, text, f.w / 2 - w / 2, baseline(fit.size), face, fit.size)];
}

function authorsOps(ctx: Ctx, f: Frame): Op[] {
  const A = COVER.front.authors;
  const names = ctx.data.authors;
  if (names.length === 0) return [];
  const paint = paintOf(ctx, ctx.style.authors);
  const lay = (name: string, size: number) => smallCapsLayout(name, ctx.measure, { ...ROMAN, size }, { trackingEm: A.trackingEm });
  const baseline = f.h - f.cm(A.baselineFromBottomCm);
  const total = (size: number): number => names.reduce((s, n) => s + lay(n, size).width, 0) + A.gapEm * size * (names.length - 1);
  const maxSize = f.pt(A.pt);
  const minSize = f.pt(A.minPt);
  // one line if it fits at the smallest size; width is linear in size, so one measurement gives the size that just fits
  const fitted = Math.min(maxSize, (maxSize * f.safe.w) / total(maxSize));
  const ops: Op[] = [];
  if (fitted >= minSize) {
    let x = f.w / 2 - total(fitted) / 2;
    for (const n of names) {
      const line = lay(n, fitted);
      ops.push(glyphOp(paint, line, x, baseline, ROMAN, fitted));
      x += line.width + A.gapEm * fitted;
    }
    return ops;
  }
  // stacked: the last name on the baseline, the others above it
  names.forEach((n, i) => {
    const line = lay(n, maxSize);
    ops.push(glyphOp(paint, line, f.w / 2 - line.width / 2, baseline - (names.length - 1 - i) * A.lineHeight * maxSize, ROMAN, maxSize));
  });
  return ops;
}

function planFront(ctx: Ctx, art: CoverArt): SurfacePlan {
  const f = makeFrame(ctx.spec, "front");
  const title = titleOps(ctx, f, art);
  const ops = [...art.front(ctx, f), ...title.ops, ...lineOps(ctx, f, art, title), ...authorsOps(ctx, f)];
  return surfacePlan(f, ops);
}

// ---------------------------------------------------------------------------------------------------------------------------
// the spine
// ---------------------------------------------------------------------------------------------------------------------------

/** A quarter turn, clockwise on screen: text that reads from the head of the book to its tail, its tops towards the front board. */
const QUARTER = Math.PI / 2;

function planSpine(ctx: Ctx, art: CoverArt): SurfacePlan {
  const S = COVER.spine;
  const f = makeFrame(ctx.spec, "spine");
  const cx = f.w / 2;
  const ops: Op[] = [];
  const top = f.safe.y;
  const bottom = f.safe.y + f.safe.h;

  // the head: an emblem and the room under it
  let headEnd = top;
  if (art.emblem) {
    ops.push(...art.emblem(ctx, cx, top + f.cm(S.emblemCm) / 2, f.cm(S.emblemCm)));
    headEnd = top + f.cm(S.emblemCm + S.emblemGapCm);
  }

  // the foot: the publisher's x on the last bit of the safe area, "Vol. I" above it
  const xW = f.cm(S.xCm);
  const xCentre = bottom - xW / 2;
  ops.push(...publisherXOps(ctx, cx, xCentre, xW, QUARTER));
  const numeralSize = f.pt(S.numeralPt);
  const numeralText = `Vol. ${ctx.data.volumeNumeral}`;
  const numeralLen = ctx.measure(numeralText, { ...ROMAN, size: numeralSize });
  const numeralStart = bottom - xW - f.cm(S.numeralGapCm) - numeralLen;
  ops.push(textOp(paintOf(ctx, ctx.style.numeral), numeralText, cx - (CAP * numeralSize) / 2, numeralStart, ROMAN, numeralSize, QUARTER));
  const footStart = numeralStart - f.cm(S.footGapCm);

  // the title: its natural size is a share of the spine's width; it is scaled down to the room between the head and the foot
  const natural = f.w * S.titleShare;
  const room = footStart - headEnd;
  const face = BOLD;
  const fit = fitSize(ctx.data.spine, ctx.measure, face, room, natural, 0);
  if (fit.size < natural * S.minTitleEm) ctx.notes.push(`the spine title "${ctx.data.spine}" had to shrink to ${Math.round((fit.size / natural) * 100)} percent of its size to fit; shorten \`spine\` in bookText.ts`);
  const length = ctx.measure(ctx.data.spine, { ...face, size: fit.size });
  const across = f.safe.w;
  if (CAP * fit.size > across) ctx.notes.push(`the spine title "${ctx.data.spine}" is wider across than the spine's safe area`);
  ops.push(textOp(paintOf(ctx, ctx.style.title.plain), ctx.data.spine, cx - (CAP * fit.size) / 2, headEnd + (room - length) / 2, face, fit.size, QUARTER));
  return surfacePlan(f, ops);
}

// ---------------------------------------------------------------------------------------------------------------------------
// the back
// ---------------------------------------------------------------------------------------------------------------------------

function planBack(ctx: Ctx, art: CoverArt): SurfacePlan {
  const B = COVER.back;
  const f = makeFrame(ctx.spec, "back");
  const cx = f.w / 2;
  const ops: Op[] = [];

  // the QR slot of Patch 09 is kept free; the x stands at the foot
  const slot = f.cm(B.qrSlotCm);
  const qrSlot: Rect = { x: cx - slot / 2, y: f.h - f.cm(B.qrFromBottomCm) - slot, w: slot, h: slot };
  const xW = f.cm(B.xCm);
  // the x is 0.87 of its width tall, so its centre is 0.435 of the width above the bottom of the safe area
  ops.push(...publisherXOps(ctx, cx, f.safe.y + f.safe.h - xW * (X_ASPECT / 2), xW));

  // the words: a centred stack, set in the room between the top of the safe area and the QR slot
  interface Row {
    text: string;
    face: TypeFace;
    size: number;
    gapBefore: number;
  }
  const rows: Row[] = [];
  const measureW = f.safe.w * B.summaryMeasure;
  const addWrapped = (text: string, face: TypeFace, size: number, gapBefore: number): void => {
    const font: FontSpec = { ...face, size };
    balancedWrap(text, ctx.measure, font, measureW).forEach((line, i) => rows.push({ text: line, face, size, gapBefore: i === 0 ? gapBefore : 0 }));
  };
  const linePx = f.pt(B.linePt);
  const sumPx = f.pt(B.summaryPt);
  const backPx = f.pt(B.backLinePt);
  if (art.back.line && ctx.data.coverLine) addWrapped(ctx.data.coverLine, art.line.italic ? ITALIC : ROMAN, linePx, 0);
  if (art.back.summary) addWrapped(ctx.data.summary, ROMAN, sumPx, rows.length ? f.cm(0.9) : 0);
  if (art.back.backLine && ctx.data.backLine) addWrapped(ctx.data.backLine, ITALIC, backPx, rows.length ? f.cm(0.7) : 0);

  // line boxes: each row takes `size x lineHeight`, plus the gap before its paragraph
  const lh = (r: Row): number => r.size * B.summaryLineHeight;
  const total = rows.reduce((s, r, i) => s + (i === 0 ? 0 : r.gapBefore) + lh(r), 0);
  const roomTop = f.safe.y;
  const roomBottom = qrSlot.y - f.cm(1);
  if (total > roomBottom - roomTop) ctx.notes.push(`the back cover's words are ${(((total - (roomBottom - roomTop)) / f.ppc)).toFixed(1)} cm too tall for the room above the QR slot`);
  let y = roomTop + (roomBottom - roomTop - total) / 2;
  const paint = paintOf(ctx, ctx.style.line);
  rows.forEach((r, i) => {
    if (i > 0) y += r.gapBefore;
    const w = ctx.measure(r.text, { ...r.face, size: r.size });
    // the baseline sits at the lower part of the line box (the box is `lh` tall, the type `size`)
    ops.push(textOp(paint, r.text, cx - w / 2, y + (lh(r) - r.size) / 2 + ASCENT * r.size, r.face, r.size));
    y += lh(r);
  });
  return surfacePlan(f, ops, qrSlot);
}

// ---------------------------------------------------------------------------------------------------------------------------
// a cover
// ---------------------------------------------------------------------------------------------------------------------------

function surfacePlan(f: Frame, ops: Op[], qrSlot?: Rect): SurfacePlan {
  return { surface: f.surface, width: f.w, height: f.h, pxPerCm: f.ppc, widthCm: f.widthCm, heightCm: f.heightCm, safe: f.safe, ops, ...(qrSlot ? { qrSlot } : {}) };
}

/** The plan of a whole cover. `notes` lists, once each, what the painter could not do. */
export function planCover(data: CoverData, tokens: CoverTokens, art: CoverArt): CoverPlan {
  const ctx = makeCtx(data, tokens);
  const front = planFront(ctx, art);
  const spine = planSpine(ctx, art);
  const back = planBack(ctx, art);
  return { id: data.id, surfaces: { front, spine, back }, notes: [...new Set(ctx.notes)] };
}

// ---------------------------------------------------------------------------------------------------------------------------
// small things the books share
// ---------------------------------------------------------------------------------------------------------------------------

/** A disc as a fill operation. */
export const discOp = (cx: number, cy: number, r: number, paint: Paint): ShapeOp => fillOp(circleCmds(cx, cy, r), paint);

export type { Layer };
