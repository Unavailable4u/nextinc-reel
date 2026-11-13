// THE SHAPES OF A PAGE PLAN (Patch 09). A page is first PLANNED, then DRAWN, the way a cover is (`src/paint/covers/types.ts`): a planner
// turns the data and a few tokens into a list of operations (pure: numbers and strings, no canvas), and `render.ts` draws the list.
// So where everything goes, how much text fits, which strings must be read and where the codes are can all be tested in Node.
//
// COORDINATES. Painted px of ONE page (2048 x 3072), y down from the top-left, read the way a reader sees the page: the text area of a
// left page is shifted towards the left edge (its inner margin, 2.0 cm, is on the right) and a right page's the other way round.

import type { BookId, BookSpec } from "../../config/books";
import type { PageSide, PageType } from "../../config/pageSpecs";
import type { PatternSpec } from "../patterns";
import type { PathCmd } from "../svgPath";
import type { Measure, PlacedGlyph, TypeFace } from "../typography";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * What a string is for. `read`: the viewer must be able to read it (guide 07 section 6: at most 8 words, contrast 7:1 against what it
 * stands on). `texture`: body text, real sentences from the data that are NOT meant to be read in full. `mark`: a decorative micro
 * label ("video" in the corner of the film frame) that no sentence of the film depends on.
 */
export type TextRole = "read" | "texture" | "mark";

/** A turn of a whole group (a mounted print and what sits on it) about a point, radians, clockwise on screen. */
export interface Turn {
  rad: number;
  cx: number;
  cy: number;
}

export interface PageText {
  kind: "text";
  text: string;
  /** the start of the baseline */
  x: number;
  y: number;
  size: number;
  face: TypeFace;
  fill: string;
  alpha: number;
  /** the advance of the whole string, px (measured by the planner) */
  width: number;
  role: TextRole;
  /** the colour the string is read against, when it is not the page's paper (a chip, the dark play mark) */
  bg?: string;
  /** one glyph at a time (tracked or small-cap text); `x` of each is from the start of the baseline */
  glyphs?: readonly PlacedGlyph[];
  /** the ghost of the other side of the leaf: drawn mirrored about the baseline's start */
  mirror?: boolean;
  turn?: Turn;
}

export interface PageShape {
  kind: "shape";
  cmds: readonly PathCmd[];
  mode: "fill" | "stroke";
  fill: string;
  alpha: number;
  stroke?: { width: number; dash?: readonly number[]; cap?: CanvasLineCap };
  /** what a QR check looks for: the light square and the dark modules of a code */
  tag?: "qr-quiet" | "qr-modules";
}

/** A picture: the part `src` of the file (px of the file), drawn into `dest`, clipped to it, turned about `turn`. */
export interface PageImage {
  kind: "image";
  /** a file under public/ (what `staticFile` takes) */
  file: string;
  src: Rect;
  dest: Rect;
  turn?: Turn;
}

/** An endpaper: one square tile of the pattern, repeated over `rect`. */
export interface PagePattern {
  kind: "pattern";
  spec: PatternSpec;
  tilePx: number;
  rect: Rect;
}

/** Paper grain: a tile of seeded noise, laid over `rect` at low strength (the grain of guide 03, so a page is not a flat colour). */
export interface PageGrain {
  kind: "grain";
  seed: number;
  /** 0 to 1: the most a grain pixel moves the paper */
  amount: number;
  tilePx: number;
  rect: Rect;
}

export type PageOp = PageText | PageShape | PageImage | PagePattern | PageGrain;

/** A code printed on a page: what it encodes and where its modules and its light square are (px of the page). */
export interface PageQr {
  url: string;
  version: number;
  module: number;
  code: Rect;
  quiet: Rect;
}

export interface PagePlan {
  id: BookId;
  index: number;
  type: PageType;
  side: PageSide;
  width: number;
  height: number;
  ppc: number;
  /** the ground the painters draw on and the strings are read against */
  paper: string;
  /** the text area inside the margins */
  area: Rect;
  ops: PageOp[];
  qr: PageQr[];
  /** every picture file the page draws (the loader waits for them) */
  images: string[];
  /** what the painter could not do, in words (a missing picture, text that did not fit). Empty when all is well. */
  notes: string[];
}

/** A picture's size in px. */
export interface ImageSize {
  w: number;
  h: number;
}

/** What a planner needs besides the data: the book's colours, a way to measure text and the sizes of the pictures. */
export interface PageTokens {
  spec: BookSpec;
  measure: Measure;
  /** the size of a file under public/, or null when it is missing (the plan then carries a note and leaves the picture out) */
  imageSize: (file: string) => ImageSize | null;
}

export type { PageSide, PageType, Measure, TypeFace };
