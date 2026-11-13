// THE SHARED GRAMMAR OF THE PAGES (Patch 09, guide 04 section 4). A page context holds what every planner needs (the data, the tokens, the
// page's side and text area, the list the planner writes its operations to), and this file has the helpers every page type shares: text
// lines, tracked and small-cap lines, paragraphs (justified, with a drop cap, cut at sentences) and the publisher's x. Pure: numbers
// and strings in, operations out. Nothing here draws.
//
// FRAME. One page is 2048 x 3072 px. The margins are `PAGE.margins`; on a LEFT page the inner margin is on the right.
// LINES. A line box is `lineH` tall and the type of size `size` sits in it, so a baseline is `(lineH - size) / 2 + 0.8 size` below
// the top of its box (the 0.8 is the ascent `layoutTitle` uses too).

import type { BookId, BookSpec } from "../../config/books";
import { CRIMSON, INK } from "../../config/covers";
import type { PageSide, PageType } from "../../config/pageSpecs";
import { PAGE, PAGE_H, PAGE_PT, PAGE_PX_PER_CM, PAGE_W } from "../../config/pages";
import { contrastRatio, mixHex } from "../../lib/color";
import { splitSentences } from "../../data/select";
import { unitX, X_ASPECT } from "../covers/common";
import { multiply, rotation, scaling, transformPath, translation, type PathCmd } from "../svgPath";
import { justify, smallCapsLayout, trackedLayout, type FontSpec, type TypeFace } from "../typography";
import type { PageData } from "./data";
import type { Measure, PageOp, PageQr, PageText, PageTokens, Rect, TextRole, Turn } from "./types";

export { CRIMSON, INK, X_ASPECT };

export const ROMAN: TypeFace = { role: "serif", weight: 400, style: "normal" };
export const ITALIC: TypeFace = { role: "serif", weight: 400, style: "italic" };
export const BOLD: TypeFace = { role: "serif", weight: 700, style: "normal" };
export const MONO: TypeFace = { role: "mono", weight: 400, style: "normal" };

/** How tall a capital is, in em of CMU Serif (about 0.68), and how far the baseline sits below the top of a line's em box. */
export const CAP = 0.68;
export const ASCENT = 0.8;

// ---------------------------------------------------------------------------------------------------------------------------
// the frame and the context
// ---------------------------------------------------------------------------------------------------------------------------

export interface PageFrame {
  side: PageSide;
  w: number;
  h: number;
  ppc: number;
  /** the text area inside the margins */
  area: Rect;
  /** the middle of the text area, x */
  cx: number;
  /** cm to px, points to px */
  cm: (v: number) => number;
  pt: (v: number) => number;
}

export function makeFrame(side: PageSide): PageFrame {
  const M = PAGE.margins;
  const ppc = PAGE_PX_PER_CM;
  const left = side === "left" ? M.outer : M.inner;
  const right = side === "left" ? M.inner : M.outer;
  const area: Rect = { x: left * ppc, y: M.top * ppc, w: PAGE_W - (left + right) * ppc, h: PAGE_H - (M.top + M.bottom) * ppc };
  return { side, w: PAGE_W, h: PAGE_H, ppc, area, cx: area.x + area.w / 2, cm: (v) => v * ppc, pt: (v) => v * PAGE_PT };
}

/** What every helper needs: the data, the tokens, the frame, and the lists the planner writes to. */
export interface PageCtx {
  id: BookId;
  index: number;
  type: PageType;
  data: PageData;
  tokens: PageTokens;
  spec: BookSpec;
  measure: Measure;
  frame: PageFrame;
  /** the ground the page is drawn on, and what its strings are read against */
  paper: string;
  ops: PageOp[];
  qr: PageQr[];
  images: Set<string>;
  notes: string[];
}

export function makeCtx(id: BookId, index: number, type: PageType, side: PageSide, data: PageData, tokens: PageTokens, paper: string): PageCtx {
  if (tokens.spec.id !== id) throw new Error(`pages: the tokens are for "${tokens.spec.id}", the page is "${id}"`);
  return { id, index, type, data, tokens, spec: tokens.spec, measure: tokens.measure, frame: makeFrame(side), paper, ops: [], qr: [], images: new Set(), notes: [] };
}

// ---------------------------------------------------------------------------------------------------------------------------
// colour
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * `color` taken towards the page's ink until it reads on `paper` at `min` to 1 (the rule of guide 07: 7 to 1). A colour that already does
 * is returned as it is. The site's crimson on the cream of a page is about 5 to 1, so a crimson word on a page is a darker crimson.
 */
export function readableOn(color: string, paper: string, min: number = PAGE.minContrast): string {
  if (contrastRatio(color, paper) >= min) return color;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const c = mixHex(color, INK, Math.min(1, t));
    if (contrastRatio(c, paper) >= min) return c;
  }
  return INK;
}

// ---------------------------------------------------------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------------------------------------------------------

export interface TextOpts {
  fill?: string;
  alpha?: number;
  role?: TextRole;
  bg?: string;
  mirror?: boolean;
  turn?: Turn;
}

const font = (face: TypeFace, size: number): FontSpec => ({ ...face, size });

/** One string on one baseline, starting at `x`. Returns the operation (its `width` is the measured advance). */
export function addText(c: PageCtx, text: string, x: number, y: number, face: TypeFace, size: number, o: TextOpts = {}): PageText {
  const op: PageText = { kind: "text", text, x, y, size, face, fill: o.fill ?? INK, alpha: o.alpha ?? 1, width: c.measure(text, font(face, size)), role: o.role ?? "read", ...(o.bg ? { bg: o.bg } : {}), ...(o.mirror ? { mirror: true } : {}), ...(o.turn ? { turn: o.turn } : {}) };
  c.ops.push(op);
  return op;
}

/** The same, centred on `cx`. */
export const addCentred = (c: PageCtx, text: string, cx: number, y: number, face: TypeFace, size: number, o: TextOpts = {}): PageText => addText(c, text, cx - c.measure(text, font(face, size)) / 2, y, face, size, o);

/** A tracked line (`smallCaps` false) or a small-cap line, one glyph at a time. `x` is the left edge, or the middle when `centre`. */
export function addGlyphs(c: PageCtx, text: string, x: number, y: number, face: TypeFace, size: number, opt: { trackingEm: number; smallCaps: boolean; centre?: boolean }, o: TextOpts = {}): PageText {
  const line = opt.smallCaps ? smallCapsLayout(text, c.measure, font(face, size), { trackingEm: opt.trackingEm }) : trackedLayout(text, c.measure, font(face, size), opt.trackingEm);
  const x0 = opt.centre ? x - line.width / 2 : x;
  const op: PageText = { kind: "text", text, x: x0, y, size, face, fill: o.fill ?? INK, alpha: o.alpha ?? 1, width: line.width, role: o.role ?? "read", glyphs: line.glyphs, ...(o.bg ? { bg: o.bg } : {}), ...(o.mirror ? { mirror: true } : {}), ...(o.turn ? { turn: o.turn } : {}) };
  c.ops.push(op);
  return op;
}

/** The baseline of a line of type `size` in a box of `lineH` whose top is `top`. */
export const baselineIn = (top: number, lineH: number, size: number): number => top + (lineH - size) / 2 + ASCENT * size;

// ---------------------------------------------------------------------------------------------------------------------------
// paragraphs
// ---------------------------------------------------------------------------------------------------------------------------

export interface ParaOpts {
  /** the measure, px */
  width: number;
  size: number;
  /** the line box, px */
  lineH: number;
  face?: TypeFace;
  justified?: boolean;
  /** a drop cap this many lines tall (guide 04: P-ABST has one of 3) */
  dropLines?: number;
}

interface ParaLine {
  text: string;
  /** the indent of the line (the room of a drop cap) */
  indent: number;
  width: number;
  /** the last line of a paragraph is never stretched */
  last: boolean;
}

export interface ParaLayout {
  lines: ParaLine[];
  height: number;
  drop?: { ch: string; size: number; width: number; lines: number };
}

/** Greedy line breaking where line `i` may be `widthOf(i)` wide. A word wider than its line stands alone (it is never cut). */
function wrapVariable(text: string, c: PageCtx, f: FontSpec, widthOf: (i: number) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && c.measure(next, f) > widthOf(lines.length)) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Where the lines of a paragraph break (pure: nothing is drawn). The first letter becomes a drop cap when `dropLines` is set. */
export function layoutParagraph(c: PageCtx, text: string, o: ParaOpts): ParaLayout {
  const face = o.face ?? ROMAN;
  const f = font(face, o.size);
  const dropLines = o.dropLines ?? 0;
  let body = text.trim();
  let drop: ParaLayout["drop"];
  let indent = 0;
  if (dropLines > 0 && body.length > 1) {
    const ch = Array.from(body)[0];
    body = body.slice(ch.length);
    // the capital spans from the cap line of the first line to the baseline of the last of its lines
    const size = ((dropLines - 1) * o.lineH + CAP * o.size) / CAP;
    const width = c.measure(ch, font(BOLD, size));
    indent = width + 0.4 * o.size;
    drop = { ch, size, width, lines: dropLines };
  }
  const widthOf = (i: number): number => (i < dropLines ? o.width - indent : o.width);
  // the first word's first letter went into the cap, so the rest of it is glued to the first line's start
  const raw = wrapVariable(body, c, f, widthOf);
  const lines: ParaLine[] = raw.map((t, i) => ({ text: t, indent: i < dropLines ? indent : 0, width: widthOf(i), last: i === raw.length - 1 }));
  // a drop cap makes the paragraph at least as tall as the cap
  const count = Math.max(lines.length, drop ? dropLines : 0);
  return { lines, height: count * o.lineH, ...(drop ? { drop } : {}) };
}

/** Draws a laid-out paragraph with its first line box at `top`, its left edge at `x`. Returns the bottom of the last line box. */
export function emitParagraph(c: PageCtx, lay: ParaLayout, x: number, top: number, o: ParaOpts, text: TextOpts = {}): number {
  const face = o.face ?? ROMAN;
  const f = font(face, o.size);
  const opts: TextOpts = { role: "texture", ...text };
  if (lay.drop) addText(c, lay.drop.ch, x, baselineIn(top + (lay.drop.lines - 1) * o.lineH, o.lineH, o.size), BOLD, lay.drop.size, opts);
  lay.lines.forEach((ln, i) => {
    const y = baselineIn(top + i * o.lineH, o.lineH, o.size);
    if (o.justified && !ln.last && ln.text.includes(" ")) {
      const j = justify(ln.text, c.measure, f, ln.width);
      for (const w of j.words) addText(c, w.text, x + ln.indent + w.x, y, face, o.size, opts);
    } else addText(c, ln.text, x + ln.indent, y, face, o.size, opts);
  });
  return top + lay.height;
}

/**
 * Sets `paragraphs` (each a list of sentences' worth of text) in the room from `top` to `bottom`, whole sentences only: for every
 * paragraph it takes the most sentences that still fit, and stops at the first paragraph that could not take even one. Returns the
 * bottom reached and the number of sentences set. Never cuts inside a sentence (the data's own rule, `cutAtSentence`).
 */
export function flowParagraphs(c: PageCtx, paragraphs: readonly string[], x: number, top: number, bottom: number, o: ParaOpts, gap: number, text: TextOpts = {}): { bottom: number; sentences: number } {
  let y = top;
  let used = 0;
  for (const p of paragraphs) {
    const sentences = splitSentences(p);
    const room = bottom - y - (y > top ? gap : 0);
    let take = 0;
    for (let n = 1; n <= sentences.length; n++) {
      if (layoutParagraph(c, sentences.slice(0, n).join(" "), o).height > room) break;
      take = n;
    }
    if (take === 0) break;
    if (y > top) y += gap;
    const lay = layoutParagraph(c, sentences.slice(0, take).join(" "), o);
    y = emitParagraph(c, lay, x, y, o, text);
    used += take;
    if (take < sentences.length) break;
  }
  return { bottom: y, sentences: used };
}

/** The most whole sentences of `text` that set in at most `maxLines` lines. The first sentence is taken even if it is longer (never cut). */
export function sentencesWithin(c: PageCtx, sentences: readonly string[], o: ParaOpts, maxLines: number): string {
  let out = sentences[0] ?? "";
  for (let n = 2; n <= sentences.length; n++) {
    const next = sentences.slice(0, n).join(" ");
    if (layoutParagraph(c, next, o).lines.length > maxLines) break;
    out = next;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// shapes
// ---------------------------------------------------------------------------------------------------------------------------

export function addShape(c: PageCtx, cmds: readonly PathCmd[], fill: string, alpha = 1, tag?: "qr-quiet" | "qr-modules"): void {
  c.ops.push({ kind: "shape", cmds, mode: "fill", fill, alpha, ...(tag ? { tag } : {}) });
}

export function addStroke(c: PageCtx, cmds: readonly PathCmd[], stroke: string, width: number, alpha = 1, dash?: readonly number[]): void {
  c.ops.push({ kind: "shape", cmds, mode: "stroke", fill: stroke, alpha, stroke: { width, ...(dash ? { dash } : {}) } });
}

/** A turn of `rad` about (cx, cy) as a matrix. */
export const turnMatrix = (t: Turn) => multiply(translation(t.cx, t.cy), multiply(rotation(t.rad), translation(-t.cx, -t.cy)));
export const turned = (cmds: readonly PathCmd[], t?: Turn): readonly PathCmd[] => (t ? transformPath(cmds, turnMatrix(t)) : cmds);

/** The publisher's x, `width` px wide, centred on (`cx`, `cy`), in the site's crimson (a mark, not a string: it is not read). */
export function addPublisherX(c: PageCtx, cx: number, cy: number, width: number): void {
  addShape(c, transformPath(unitX(), multiply(translation(cx, cy), scaling(width))), CRIMSON);
}
