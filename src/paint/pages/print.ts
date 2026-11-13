// A MOUNTED PRINT (Patch 09, guide 04 section 4: P-FIG, P-GAL and the film page's frame). A screenshot is not pasted on the page, it is a
// photograph held by four corner mounts: a soft shadow, a white border with a hairline, the picture, and a mount at each corner, the whole
// thing turned by 0.4 to 0.8 degrees (the sign and the amount come from a hash of the book and the file, so a print always lies the same way).
//
// THE SIZE. The picture keeps its own proportions (a print is never cropped, except the film page's frame, which is 16:9), is at most
// `maxWidthShare` of the text width wide (the turn needs room) and at most `maxH` tall.

import { PAGE } from "../../config/pages";
import { fnv1a } from "../../lib/hash";
import { prng, range } from "../../lib/prng";
import { rectCmds } from "../svgPath";
import { addShape, addStroke, INK, turned, type PageCtx } from "./common";
import type { Rect, Turn } from "./types";

export interface PrintOptions {
  /** the file under public/ and a key for the hash of its turn */
  file: string;
  key: string;
  /** the middle of the print, x, and its top, px (before the turn) */
  cx: number;
  top: number;
  /** the room: the widest the outer border may be, and the tallest */
  maxW: number;
  maxH: number;
  /** the border all round, cm (the film's frame has its own) */
  borderCm?: number;
  /** fix the picture's proportions (the film page: 16 / 9, the picture is cropped to them from its middle) */
  aspect?: number;
}

export interface Print {
  /** the outer paper, before the turn */
  outer: Rect;
  /** the picture, before the turn */
  inner: Rect;
  turn: Turn;
  /** the bottom of the outer paper (before the turn), where the caption starts */
  bottom: number;
}

/** The size a print takes without drawing it: used to lay several out in a column. */
export function printSize(c: PageCtx, o: Pick<PrintOptions, "file" | "maxW" | "maxH" | "borderCm" | "aspect">): { w: number; h: number; border: number; aspect: number } | null {
  const size = c.tokens.imageSize(o.file);
  if (!size) return null;
  const border = c.frame.cm(o.borderCm ?? PAGE.print.borderCm);
  const aspect = o.aspect ?? size.w / size.h;
  const w = Math.min(o.maxW, (o.maxH - 2 * border) * aspect + 2 * border);
  return { w, h: (w - 2 * border) / aspect + 2 * border, border, aspect };
}

/** The angle of a print's turn, radians: 0.4 to 0.8 degrees, either way, fixed by the hash of `key`. */
export function turnOf(key: string): number {
  const r = prng(fnv1a(`print/${key}`));
  const deg = range(r, PAGE.print.rotateDeg.min, PAGE.print.rotateDeg.max) * (r() < 0.5 ? -1 : 1);
  return (deg * Math.PI) / 180;
}

/**
 * Draws one print and returns where it is. A picture whose size is unknown (the file is missing) is left out and the plan says so; the
 * paper, the border and the mounts are still drawn, so the missing picture shows as an empty frame and not as a hole in the layout.
 */
export function addPrint(c: PageCtx, o: PrintOptions): Print {
  const P = PAGE.print;
  const fallback = c.tokens.imageSize(o.file) === null;
  const size = printSize(c, o) ?? printSizeAssumed(c, o);
  const border = size.border;
  const outer: Rect = { x: o.cx - size.w / 2, y: o.top, w: size.w, h: size.h };
  const inner: Rect = { x: outer.x + border, y: outer.y + border, w: outer.w - 2 * border, h: outer.h - 2 * border };
  const turn: Turn = { rad: turnOf(o.key), cx: o.cx, cy: outer.y + outer.h / 2 };
  c.images.add(o.file);
  if (fallback) c.notes.push(`the picture "${o.file}" is missing (or its size is unknown): the print is drawn empty`);

  // the shadow: the paper, shifted down and right and grown a little, `steps` times at a low alpha each
  const sh = P.shadow;
  for (let i = sh.steps; i >= 1; i--) {
    const grow = (sh.spreadCm * c.frame.ppc * i) / sh.steps;
    const off = sh.offsetCm * c.frame.ppc;
    addShape(c, turned(rectCmds(outer.x + off - grow, outer.y + off - grow, outer.w + 2 * grow, outer.h + 2 * grow), turn), "#000000", sh.alpha);
  }
  addShape(c, turned(rectCmds(outer.x, outer.y, outer.w, outer.h), turn), P.paper);
  addStroke(c, turned(rectCmds(outer.x, outer.y, outer.w, outer.h), turn), INK, P.hairlinePx, P.hairlineAlpha);

  const img = c.tokens.imageSize(o.file);
  if (img) {
    // the part of the picture that shows: all of it, or (a fixed proportion) the middle of it
    const want = inner.w / inner.h;
    const have = img.w / img.h;
    const src: Rect = have > want ? { x: (img.w - img.h * want) / 2, y: 0, w: img.h * want, h: img.h } : { x: 0, y: (img.h - img.w / want) / 2, w: img.w, h: img.w / want };
    c.ops.push({ kind: "image", file: o.file, src, dest: inner, turn });
  }

  // a mount at each corner: a right triangle with its legs along the paper's edges, over the corner of the picture
  const L = P.cornerCm * c.frame.ppc;
  const corners: [number, number, number, number][] = [
    [outer.x, outer.y, 1, 1],
    [outer.x + outer.w, outer.y, -1, 1],
    [outer.x + outer.w, outer.y + outer.h, -1, -1],
    [outer.x, outer.y + outer.h, 1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    addShape(c, turned([{ t: "M", x, y }, { t: "L", x: x + sx * L, y }, { t: "L", x, y: y + sy * L }, { t: "Z" }], turn), P.mount, P.mountAlpha);
  }
  return { outer, inner, turn, bottom: outer.y + outer.h };
}

/** The size of an empty frame for a missing picture: 16:9 inside the room. */
function printSizeAssumed(c: PageCtx, o: PrintOptions): { w: number; h: number; border: number; aspect: number } {
  const border = c.frame.cm(o.borderCm ?? PAGE.print.borderCm);
  const aspect = o.aspect ?? 16 / 9;
  const w = Math.min(o.maxW, (o.maxH - 2 * border) * aspect + 2 * border);
  return { w, h: (w - 2 * border) / aspect + 2 * border, border, aspect };
}
