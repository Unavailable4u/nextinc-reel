// THE COVERS AS DATA (Patch 08). Every number about how a cover is laid out lives here; `src/paint/covers/*` only reads it, the way
// `src/book/*` reads `config/books.ts`. The starting values are guide 04 sections 2 and 3; tune them by looking in `DevCovers`.
//
// UNITS: centimetres on the cover (the layout is thought of on the book), points for type (guide 04 section 4: 1 pt = 4.75 px on a
// page painted at 134.7 px/cm; here `ptToCm` turns a point size into cm and the painter multiplies by the surface's px/cm).
// Colours of the cloth and the foils are NOT here: they are `spec.colors` in `config/books.ts` (one set of colours, guide 03).
// What is here are the names of the roles a colour plays on a cover (`ColorRole`) and the few fixed colours of the family look.
//
// WHAT IS NOT HERE: titles, authors, summaries, years. Those come from `src/data/select.ts` and `src/config/bookText.ts`.

import type { BookId } from "./books";
import type { TitlePart } from "./bookText";

/** One typographic point in cm (1/72 in). Guide 04: at 134.7 px/cm a point is 4.75 px. */
export const PT_CM = 2.54 / 72;
export const ptToCm = (pt: number): number => pt * PT_CM;

/** The three painted surfaces of a book. `front` and `back` are the outer faces of the boards, `spine` the rounded back. */
export type Surface = "front" | "spine" | "back";
export const SURFACES: readonly Surface[] = ["front", "spine", "back"];

/** The family look's fixed colours (guide 04 section 2): the site's crimson, the dark ink of the parchment book, the off-white foil. */
export const CRIMSON = "#C0102C";
export const INK = "#16120E";
export const OFF_WHITE = "#E9E2D4";

/** Where a printed or stamped colour comes from. `foil*` are the book's own foils (`spec.colors.foil`). */
export type ColorRole = "foilPrimary" | "foilSecondary" | "offWhite" | "ink" | "crimson";

/** How something is put on the cloth: ink is printed (it can be translucent), foil is stamped (metal, debossed, never translucent). */
export interface Fill {
  layer: "ink" | "foil";
  color: ColorRole;
  /** 0 to 1; only meaningful for ink (foil is always full strength) */
  alpha?: number;
}

export const COVER = {
  /** bump when a number below is meant to change every cover: the cache key carries it */
  version: 1,

  /**
   * Pixels per cm of each painted surface. The front is looked at closest (S04, S05), the back hardly at all, so it is painted at
   * 70 px/cm. Memory: colour, foil and normal map of a book come to 84 to 87 MB with mip maps (`coverTextureBytes`), 343 MB for the four.
   */
  pxPerCm: { front: 100, spine: 100, back: 70 } as const satisfies Record<Surface, number>,
  /** all four books together must stay under this (guide 02: texture memory is 1.5 GB for the whole film) */
  textureBudgetBytes: 400 * 1024 * 1024,

  /** art stops this far from the board's outline (the bevel is 0.8 mm), cm, and its corners are rounded by this radius */
  clipInsetCm: 0.1,
  clipRadiusCm: 0.12,

  /** the safe area: nothing that must be read goes outside it (corner wear, the bevel, a camera that is a few degrees off) */
  safe: {
    board: { top: 1.6, bottom: 1.6, left: 1.3, right: 1.3 },
    spine: { top: 1.4, bottom: 1.4, left: 0.3, right: 0.3 },
  },

  /** the deboss: a foil or blind stamp sinks by `MATERIALS.foil.debossCm`; its wall is softened by this many px so it takes light */
  debossSoftenPx: 1,
  /** how deep each kind of stamp goes, as a share of the deboss step (1 is the full 0.2 mm). A blind stamp is a little shallower than foil. */
  depth: { foil: 1, blind: 0.8 },

  front: {
    /** the title (guide 04: 40 pt bold) and the smallest it may be scaled down to when a long title would not fit */
    titlePt: 40,
    /** a title that breaks (SPHEREx, Immersive) sets its second line at this share of the first */
    secondRatio: 0.58,
    lineHeight: 1.12,
    /** the small line (the tag line, "Blast Radius Zero") */
    linePt: 13,
    /** the gap between the title block and the line under it, in em of the line */
    lineGapEm: 1.5,
    /** the authors, small caps, tracked, one line if it fits at `minPt` and stacked if it does not */
    authors: { pt: 10, minPt: 8, trackingEm: 0.14, gapEm: 1.8, lineHeight: 1.7, baselineFromBottomCm: 1.9 },
  },

  spine: {
    /** the title's size as a share of the spine's width, scaled down to fit the length available */
    titleShare: 0.3,
    /** a mark or emblem at the head: its width and the space under it */
    emblemCm: 1.7,
    emblemGapCm: 1.1,
    /** "Vol. I" above the x, and the x itself (its width along the spine) */
    numeralPt: 9.5,
    /** the space between the numeral and the x, along the spine */
    numeralGapCm: 0.35,
    xCm: 1.0,
    footGapCm: 0.8,
    /**
     * the smallest the title may be scaled to, as a share of its natural size (`titleShare` of the spine's width). A title that
     * would have to go below it still fits (it is never allowed to run past the zones), and the plan carries a note.
     */
    minTitleEm: 0.55,
  },

  back: {
    linePt: 14,
    summaryPt: 11.5,
    summaryLineHeight: 1.5,
    /** the summary's measure, as a share of the board's safe width */
    summaryMeasure: 0.78,
    /** the small italic back line ("Nothing in it claims a detection.") */
    backLinePt: 11.5,
    /** a square kept free for Patch 09's QR (3.4 cm of code and a quiet zone of 0.5 cm on each side) and its distance from the bottom */
    qrSlotCm: 4.4,
    qrFromBottomCm: 3.9,
    xCm: 0.9,
  },

  /** the contrast the publisher's x needs against the cloth (WCAG ratio); below it the x takes the book's secondary foil instead (D-39) */
  xMinContrast: 2.2,
} as const;

/** Per book: what each part of a cover is made of, and where its art sits. Positions are shares of the board's height or width. */
export interface CoverStyle {
  /** the three styles of a title part. Italic is the roman italic cut, crimson is the site's crimson (guide 04 section 2) */
  title: Record<TitlePart["style"], Fill>;
  /** the tag line and the other small printed lines */
  line: Fill;
  /** the authors */
  authors: Fill;
  /** "Vol. I" on the spine */
  numeral: Fill;
}

export const COVER_STYLE: Record<BookId, CoverStyle> = {
  // near-black cloth: rose-red foil mark, off-white foil title, off-white print for the small lines
  "mini-me": {
    title: { plain: { layer: "foil", color: "foilSecondary" }, italic: { layer: "foil", color: "foilSecondary" }, crimson: { layer: "foil", color: "crimson" } },
    line: { layer: "ink", color: "offWhite", alpha: 0.85 },
    authors: { layer: "ink", color: "offWhite", alpha: 0.7 },
    numeral: { layer: "ink", color: "offWhite", alpha: 0.75 },
  },
  // indigo cloth: everything in gold foil, the one small line plain print
  "spherex-blink": {
    title: { plain: { layer: "foil", color: "foilPrimary" }, italic: { layer: "foil", color: "foilPrimary" }, crimson: { layer: "foil", color: "crimson" } },
    line: { layer: "ink", color: "offWhite", alpha: 0.8 },
    authors: { layer: "ink", color: "offWhite", alpha: 0.7 },
    numeral: { layer: "ink", color: "offWhite", alpha: 0.75 },
  },
  // parchment linen: the title is printed in ink and crimson, only the dial's arcs are foil (blue)
  minilocker: {
    title: { plain: { layer: "ink", color: "ink" }, italic: { layer: "ink", color: "ink" }, crimson: { layer: "ink", color: "crimson" } },
    line: { layer: "ink", color: "ink", alpha: 0.85 },
    authors: { layer: "ink", color: "ink", alpha: 0.75 },
    numeral: { layer: "ink", color: "ink", alpha: 0.75 },
  },
  // darkened crimson: off-white foil title, off-white print, and a blind-stamped globe (see `art.immersive`)
  "next-inc-immersive": {
    title: { plain: { layer: "foil", color: "foilSecondary" }, italic: { layer: "foil", color: "foilSecondary" }, crimson: { layer: "foil", color: "foilSecondary" } },
    line: { layer: "ink", color: "foilSecondary", alpha: 0.85 },
    authors: { layer: "ink", color: "foilSecondary", alpha: 0.7 },
    numeral: { layer: "ink", color: "foilSecondary", alpha: 0.75 },
  },
};

/** Where the art of each cover sits and how big it is. */
export const COVER_ART = {
  "mini-me": {
    /** the traced mark: width and the distance of its top edge from the top of the board, cm */
    markWidthCm: 3.4,
    markTopCm: 3.2,
    /** the title block's centre, as a share of the board's height (guide 04: 40 percent) */
    titleCentre: 0.4,
  },
  "spherex-blink": {
    /** the orbits motif drawn once, one tile as wide as this (it bleeds off the board), with the first system's centre at these shares */
    tileCm: 26,
    centre: { x: 0.7, y: 0.3 },
    /** the width of a foil ring, cm (fine: the pattern's own widths are for a ghost on an endpaper) */
    lineCm: 0.06,
    /** the top of the title block, share of the board's height */
    titleTop: 0.6,
  },
  minilocker: {
    /** the Blast Radius dial: the diameter of its outer arc (cm) and its centre (shares of the board) */
    dialCm: 11.6,
    centre: { x: 0.52, y: 0.31 },
    titleCentre: 0.66,
    /** the small Mark on the spine head */
    markCm: 1.6,
  },
  "next-inc-immersive": {
    /** the blind-stamped particle globe: radius (cm), centre (shares), the number of dots and the dot radii (cm) */
    globeRadiusCm: 4.6,
    centre: { x: 0.5, y: 0.32 },
    dots: 480,
    rim: 96,
    dotCm: { min: 0.05, max: 0.11 },
    /** how far the globe is turned: the axis leans this far (degrees) and the globe is turned this far about it */
    tiltDeg: 23.5,
    turnDeg: 35,
    /** a blind stamp has no ink; it darkens the cloth a little where it presses (0 to 1) */
    blindAlpha: 0.6,
    titleTop: 0.62,
  },
} as const;

/** The pictures of a cover are painted from these; the dial and the Mark are in `src/paint/covers/brand.ts` (exact, never redrawn). */
export const COVER_FILES = {
  /** the traced Mini Me mark, saved by hand (guide, Patch 08 "Before you start") */
  miniMeMark: "brand/mini-me-mark.svg",
  /** the site's x (copied by `npm run sync -- --copy-media`) */
  glyphX: "site/brand/glyph-x.json",
} as const;
