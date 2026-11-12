// THE FOUR BOOKS AS DATA (Patch 06). Every number about a book's body lives here; `src/book/*` only reads it (guide 04, section 1).
//
// UNITS: centimetres, as everywhere (guide 02). A book is described in its OWN frame (see `src/book/geometry.ts`):
//   X from the spine (-W/2) to the fore-edge (+W/2), Y up from the underside of the back board, Z from the head (-H/2) to the tail (+H/2).
//   Closed and lying face up with the spine on the left, the book is seen from +Y with the head away from the viewer.
//
// TRIM SIZE. In this repository "trim" is the OUTER size of the boards, 15.2 x 22.9 cm (BOOK_TRIM). The squares are inside it: the
// page block is smaller by the square on the head, tail and fore-edge. This is what the placement zones, the footprints and the
// camera plan were measured with (D-36).

import { BOOK_TRIM } from "../lib/units";

export type BookId = "mini-me" | "spherex-blink" | "minilocker" | "next-inc-immersive";

/** The ids are the website's slugs (`projects.js`), in the site's order: Vol. I to Vol. IV. */
export const BOOK_IDS = ["mini-me", "spherex-blink", "minilocker", "next-inc-immersive"] as const satisfies readonly BookId[];

export interface BookSpec {
  id: BookId;
  /** 1 to 4 (a design device, guide 04 section 1) */
  volume: 1 | 2 | 3 | 4;
  /** the boards' outer width (spine to fore-edge), cm */
  trimW: number;
  /** the boards' outer height (head to tail), cm */
  trimH: number;
  /** thickness of one cover board, cm */
  board: number;
  /** how far the boards stand out past the page block at the head, tail and fore-edge, cm */
  square: number;
  /** the spine: the thickness of the page block between the boards, cm. The closed book is `spine + 2 x board` thick */
  spine: number;
  /** for the motion (heavier: slower, smaller sway), grams */
  weightG: number;
  /** implied page count (never shown on screen); half of it is the number of sheets that can be turned */
  pages: number;
  /** the colour of every part (Patch 07 treats them: `src/book/materials.ts`, values in `config/materials.ts`); Patch 08 samples the real ones from the cover art */
  colors: {
    /** the bookcloth */
    cloth: string;
    /** the pasted-down endpaper on the inside of each board */
    endpaper: string;
    /** the paper of the page block */
    paper: string;
    /** head and tail band, the two stripes */
    band: readonly [string, string];
    ribbon: string;
    /** the foil stamping: `primary` is the mark or the rings, `secondary` the title (guide 04 section 3). Foil is metal, so this is its reflectance. */
    foil: { primary: string; secondary: string };
    /** a dye on the head (top) edge of the page block, if the book has one: Mini Me's rose-red top edge */
    headStain?: string;
  };
  /** the seeded imperfections (guide 03 section 6): the same seed always gives the same book */
  seeds: { block: number; ribbon: number };
}

/** Shared by all four books. Nothing in `Book.tsx` is hard-coded; it is here. */
export const BOOK_GEOMETRY = {
  /** the bevel on boards and spine ends: 0.8 mm (guide 03 section 3) */
  bevelCm: 0.08,
  /** the radius of the board corners in plan, cm */
  cornerRadiusCm: 0.2,
  /** the thickness of the spine cloth, cm */
  clothCm: 0.1,
  /** the radius of curvature of the rounded back (guide 03: about 3 cm on a 2 cm spine), cm */
  spineRadiusCm: 3,
  /** where the hinge groove sits: this far from the spine's edge (guide 04), cm */
  hingeFromSpineCm: 0.5,
  /** the groove is never narrower than this, even on the thickest book, cm */
  grooveMinCm: 0.15,
  /** the thickness of the pasted-down endpaper, cm */
  pastedownCm: 0.02,
  /** the endpaper stops this far from the boards' head, tail and fore-edge (the cloth turn-in), cm */
  pastedownInsetCm: 1.2,
  /** head and tail band: 1.2 cm wide from the spine inwards, 0.25 cm deep along the book (guide 04) */
  bandWidthCm: 1.2,
  bandDepthCm: 0.25,
  /** the page block bows by up to 0.5 mm, and its fore-edge differs by up to 0.3 mm (guide 03 section 6). Both only ever go INWARD. */
  blockBowCm: 0.05,
  foreEdgeDentCm: 0.03,
  /** the ribbon marker: crimson 0.6 cm wide with a 3 cm tail (guide 04) */
  ribbonWidthCm: 0.6,
  ribbonTailCm: 3,
  /** how far the ribbon lies from the spine edge of the block, cm */
  ribbonGutterCm: 0.9,
} as const;

const PAPER = "#EDE8DE"; // (0.93, 0.91, 0.87), guide 03 section 3
const ENDPAPER = "#D8CDB6";
const CRIMSON = "#C0102C";

const base = { trimW: BOOK_TRIM.w, trimH: BOOK_TRIM.h, board: 0.3, square: 0.3 } as const;

/** Vol. I to Vol. IV. Spines: Mini Me 2.4, SPHEREx 1.8, MiniLocker 2.0, Immersive 1.6 cm (guide 04). */
export const BOOKS: Record<BookId, BookSpec> = {
  "mini-me": {
    id: "mini-me",
    volume: 1,
    ...base,
    spine: 2.4,
    weightG: 560,
    pages: 256,
    colors: { cloth: "#0D0D0D", endpaper: ENDPAPER, paper: PAPER, band: ["#FF2351", "#E9E2D4"], ribbon: CRIMSON, foil: { primary: "#FF2351", secondary: "#E9E2D4" }, headStain: "#FF2351" },
    seeds: { block: 6101, ribbon: 6102 },
  },
  "spherex-blink": {
    id: "spherex-blink",
    volume: 2,
    ...base,
    spine: 1.8,
    weightG: 440,
    pages: 192,
    colors: { cloth: "#24307A", endpaper: ENDPAPER, paper: PAPER, band: ["#E8B04A", "#E9E2D4"], ribbon: CRIMSON, foil: { primary: "#E8B04A", secondary: "#E8B04A" } },
    seeds: { block: 6201, ribbon: 6202 },
  },
  minilocker: {
    id: "minilocker",
    volume: 3,
    ...base,
    spine: 2.0,
    weightG: 490,
    pages: 224,
    colors: { cloth: "#D4B692", endpaper: ENDPAPER, paper: PAPER, band: [CRIMSON, "#16120E"], ribbon: CRIMSON, foil: { primary: "#3F6FC4", secondary: "#16120E" } },
    seeds: { block: 6301, ribbon: 6302 },
  },
  "next-inc-immersive": {
    id: "next-inc-immersive",
    volume: 4,
    ...base,
    spine: 1.6,
    weightG: 400,
    pages: 160,
    // the site's crimson darkened 35 percent
    colors: { cloth: "#7D0A1D", endpaper: ENDPAPER, paper: PAPER, band: ["#F5F0E6", "#16120E"], ribbon: CRIMSON, foil: { primary: "#2A0710", secondary: "#F5F0E6" } },
    seeds: { block: 6401, ribbon: 6402 },
  },
};

export const getBookSpec = (id: BookId): BookSpec => BOOKS[id];

/** The closed book's thickness: the page block plus the two boards. Mini Me: 2.4 + 2 x 0.3 = 3.0 cm. */
export const closedThickness = (spec: BookSpec): number => spec.spine + 2 * spec.board;
/** How many sheets can be turned (each sheet is two pages). */
export const sheetCount = (spec: BookSpec): number => spec.pages / 2;

/**
 * Where a book stands. Rotation order is Y (yaw on the desk), then X (pitch), then Z (roll), as in guide 02. The position is the
 * centre of the closed book's footprint, at the underside of its back board.
 */
export interface BookPose {
  position: readonly [number, number, number];
  yawDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
}

/** Yaw that turns the spine to face the camera (+Z) for a book lying face up: the local -X axis goes to world +Z. */
export const SPINE_TO_CAMERA_YAW_DEG = 90;

/**
 * The three books of the opening pile, bottom to top. S02 reads the spines top to bottom: MiniMe, MiniLocker, SPHEREx.
 * Imperfection (guide 03 section 6): yaw offsets of +3, -2 and +1 degrees about the spine-to-camera direction, lateral offsets of
 * 3 to 8 mm. `dx` is to the right and `dzd` towards the wall, both in desk coordinates (cm).
 */
export interface PileSlot {
  id: BookId;
  yawDeg: number;
  dx: number;
  dzd: number;
}
export const PILE: readonly PileSlot[] = [
  { id: "spherex-blink", yawDeg: 3, dx: -0.3, dzd: 0.2 },
  { id: "minilocker", yawDeg: -2, dx: 0.5, dzd: -0.4 },
  { id: "mini-me", yawDeg: 1, dx: 0.8, dzd: 0.3 },
];

/** The pose of every book in the pile when it stands on a desk anchor (X, Zd). World Z is -Zd (guide 02). */
export function pilePoses(anchor: { X: number; Zd: number }): { id: BookId; pose: BookPose }[] {
  let y = 0;
  return PILE.map((slot) => {
    const spec = BOOKS[slot.id];
    const pose: BookPose = { position: [anchor.X + slot.dx, y, -(anchor.Zd + slot.dzd)], yawDeg: SPINE_TO_CAMERA_YAW_DEG + slot.yawDeg };
    y += closedThickness(spec);
    return { id: slot.id, pose };
  });
}
