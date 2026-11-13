// THE SHAPES OF A COVER PLAN (Patch 08). A cover is first PLANNED, then DRAWN: a planner turns the data and a few tokens into a list
// of operations on three surfaces (pure: numbers and strings, no canvas), and `render.ts` draws the list. So everything about where
// a thing goes can be tested in Node, and the drawing is the same few lines for every book.
//
// All operation coordinates are in painted px of their own surface, y down from the top-left of the surface as a reader sees it
// (the anchor frames of `src/book/geometry.ts`: +X reads to the right, +Y is up on the face, so the HEAD of the book is the top).

import type { BookSpec, BookId } from "../../config/books";
import type { TitlePart } from "../../config/bookText";
import type { Surface } from "../../config/covers";
import type { PathCmd } from "../svgPath";
import type { Measure, PlacedGlyph, TypeFace } from "../typography";

/**
 * Where an operation lands:
 *   ink    printed on the cloth: colour canvas only, may be translucent
 *   foil   stamped foil: foil canvas (colour and mask) and the height canvas (a deboss), never translucent
 *   blind  a blind stamp: no foil and no ink of its own, it darkens the cloth a little (colour canvas) and sinks (height canvas)
 */
export type Layer = "ink" | "foil" | "blind";

/** How something is put on the cloth, with its colour resolved to a hex string. */
export interface Paint {
  layer: Layer;
  fill: string;
  /** 0 to 1; foil ignores it */
  alpha: number;
  /** 0 to 1 share of the deboss step; 0 for ink */
  depth: number;
}

export interface ShapeOp extends Paint {
  kind: "shape";
  /** what a QR check looks for: the light square and the dark modules of a code (Patch 09) */
  tag?: "qr-quiet" | "qr-modules";
  cmds: readonly PathCmd[];
  mode: "fill" | "stroke";
  stroke?: { width: number; cap?: CanvasLineCap; dash?: readonly number[] };
}

export interface TextOp extends Paint {
  kind: "text";
  text: string;
  /** the start of the baseline */
  x: number;
  y: number;
  /** radians, clockwise on screen: a spine's text reads top to bottom, so it is a quarter turn (PI / 2) */
  rotation: number;
  size: number;
  face: TypeFace;
  /** one glyph at a time (tracked or small-cap text); `x` of each is from the start of the baseline, along the text */
  glyphs?: readonly PlacedGlyph[];
}

export type Op = ShapeOp | TextOp;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SurfacePlan {
  surface: Surface;
  /** painted size, px */
  width: number;
  height: number;
  pxPerCm: number;
  /** the same in cm on the book */
  widthCm: number;
  heightCm: number;
  /** nothing that must be read goes outside it */
  safe: Rect;
  ops: Op[];
  /** the square kept free for the QR (back cover only) */
  qrSlot?: Rect;
  /** the code printed in the slot (Patch 09): what it encodes, the modules' area and the light square around it, in px of the surface */
  qr?: { url: string; version: number; code: Rect; quiet: Rect };
}

export interface CoverPlan {
  id: BookId;
  surfaces: Record<Surface, SurfacePlan>;
  /** what the painter could not do, in words (a missing file, a title that had to shrink). Empty when all is well. */
  notes: string[];
}

/** Everything about a cover that comes from the data and the editorial config. No fact is typed in a painter. */
export interface CoverData {
  id: BookId;
  /** the title as set on the cover (`bookText.ts`) */
  title: TitlePart[];
  /** the spine's text, top to bottom */
  spine: string;
  /** "I", "II", ... (the data's volume numeral) */
  volumeNumeral: string;
  coverLine?: string;
  backLine?: string;
  /** the data's one-line summary */
  summary: string;
  /** names only, in the site's order */
  authors: string[];
  /** the address the back cover's QR encodes: QR 1 of the book (`getQrTargets`, guide 07 section 3) */
  qr: string;
}

/** What a planner needs besides the data: the book's colours, a way to measure text and the one picture that is a file. */
export interface CoverTokens {
  spec: BookSpec;
  measure: Measure;
  /** the text of `public/brand/mini-me-mark.svg`, or null when the file is missing (Mini Me only; the plan then carries a note) */
  miniMeMarkSvg: string | null;
}

export type CoverPlanner = (data: CoverData, tokens: CoverTokens) => CoverPlan;
