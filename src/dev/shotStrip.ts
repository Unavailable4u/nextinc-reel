// THE SHOT STRIP, AS DATA (Patch 13D). Which film frame each of the 26 cells shows, what its label says and where it sits on the 1920 x 1080
// page. `DevShotStrip.tsx` draws; this file decides, so the choices can be read by a plain Node (`tests/shotstrip.test.ts` does) with no
// React, no three.js and no browser.
//
// A cell is a pure function of its frame: the frame is `shot.from + offset`, cut at the shot's last frame, and nothing else (no clock, no
// random, no state) goes into it. The shots come from the registry, so the strip follows the shot files; the registry checks them
// against the SHOTS table when it loads, so the strip can not disagree with the storyboard about where a shot starts.

import { BAR, HEIGHT, SHOTS, WIDTH, timecode, type Regime } from "../config/timeline";
import { SHOT_REGISTRY, tableRow, type Shot } from "../shots";

/** The longest shot is 480 frames (S23, S24), so an offset of 479 is the last frame of any shot; a shorter shot is cut at its own last frame. */
export const MAX_OFFSET: number = Math.max(...SHOTS.map((s) => s.to - s.from));

/** The default number of columns: 26 cells in 4 rows of 7, which with the hud on gives the biggest cells (252 x 141) that fit the page with the title and the labels. */
export const DEFAULT_COLUMNS = 7;
export const MAX_COLUMNS = 13;
/** The fewest columns the Studio offers: with 26 cells, fewer rows than this do not fit the page at a size worth looking at (see `stripLayout`). */
export const MIN_COLUMNS = 4;
/** The narrowest picture a cell may have, px. A grid that would make them smaller gets more columns instead. */
export const MIN_CELL_W = 96;

/** One cell of the strip. */
export interface StripCell {
  /** 0 to 25: the cell's place, in reading order, and the shot's row in the table */
  index: number;
  /** "S00" to "S25" */
  id: string;
  name: string;
  regime: Regime;
  /** the shot's first and last frame */
  from: number;
  to: number;
  /** the film frame this cell shows: `from + offset`, cut at `to` */
  frame: number;
  /** how far into the shot that is: 0 is the first frame (the offset asked for, or less when the shot is shorter) */
  into: number;
  /** the shot's length in bars (120 frames) */
  bars: number;
}

/** The frame a cell shows for a shot and an offset into it. Throws for an offset that is not a whole number of at least 0. */
export function cellFrame(shot: { from: number; to: number }, offset: number): number {
  if (!Number.isInteger(offset) || offset < 0) throw new Error(`shot strip: the offset must be a whole number of frames, 0 or more (got ${offset})`);
  return Math.min(shot.from + offset, shot.to);
}

/** The 26 cells, S00 to S25, for an offset into each shot (0 is the first frame of every shot). */
export function stripCells(offset = 0, shots: readonly Shot[] = SHOT_REGISTRY): StripCell[] {
  return shots.map((s, index) => {
    const row = tableRow(s.id);
    const frame = cellFrame(s, offset);
    return { index, id: s.id, name: row.name, regime: row.regime, from: s.from, to: s.to, frame, into: frame - s.from, bars: (s.to - s.from + 1) / BAR };
  });
}

const pad4 = (n: number): string => String(n).padStart(4, "0");

/**
 * What is written under a cell. `title` is always there: the shot id and the film frame (and how far into the shot, when that is not
 * its first frame). `hud` adds `detail`, the time, the regime and the length in bars, and `name`, the shot's name; they are what the
 * film's readout says, split so that each line is short enough for a cell about 250 px wide. Without `hud` both are null.
 */
export function cellLabel(cell: StripCell, hud: boolean): { title: string; detail: string | null; name: string | null } {
  const title = `${cell.id} · f${pad4(cell.frame)}${cell.into > 0 ? ` (+${cell.into})` : ""}`;
  if (!hud) return { title, detail: null, name: null };
  return { title, detail: `${timecode(cell.frame)} · ${cell.regime} · ${cell.bars} bar${cell.bars === 1 ? "" : "s"}`, name: cell.name };
}

/** The height of the label under a cell, px: one line, or three with `hud`. */
export const labelHeight = (hud: boolean): number => (hud ? 62 : 26);

export interface StripLayoutOptions {
  columns: number;
  count: number;
  /** the page, px (default the film's 1920 x 1080) */
  width?: number;
  height?: number;
  /** the space at the left, the right and the bottom of the page, px */
  margin?: number;
  /** the space between cells, px */
  gap?: number;
  /** the title above the grid, px */
  headerH?: number;
  /** the label under every cell, px (one line, or two with `hud`) */
  labelH?: number;
}

export interface StripLayout {
  columns: number;
  rows: number;
  /** a cell's picture, px, 16:9 within one pixel */
  cellW: number;
  cellH: number;
  labelH: number;
  /** the top-left corner of each cell's picture, in reading order */
  cells: { left: number; top: number }[];
}

/**
 * The grid: `columns` across (cut to 1 to `count`), as many rows as it takes, the biggest 16:9 picture such that the whole grid, its
 * labels and the title fit the page. Cells are in reading order (row by row from the top left), and a short last row is left-aligned
 * under the others. The grid is centred across the page.
 *
 * With too few columns the rows pile up past the bottom of the page (26 rows of labels alone are taller than it), so when the page is
 * too short for the rows and the picture would be narrower than `MIN_CELL_W`, the layout takes more columns, one at a time, until it is
 * not. (With many columns it is the width that limits the picture and more columns would only shrink it, so it stops.) `columns` in
 * the answer is the number it used, which is never less than the number asked for (up to `count`).
 */
export function stripLayout(o: StripLayoutOptions): StripLayout {
  const { count, width = WIDTH, height = HEIGHT, margin = 36, gap = 14, headerH = 78, labelH = 26 } = o;
  if (!Number.isInteger(count) || count < 1) throw new Error(`shot strip: there must be at least one cell (got ${count})`);
  if (!Number.isInteger(o.columns) || o.columns < 1) throw new Error(`shot strip: the columns must be a whole number of 1 or more (got ${o.columns})`);
  const fit = (columns: number): { rows: number; cellW: number; heightLimited: boolean } => {
    const rows = Math.ceil(count / columns);
    const byWidth = (width - 2 * margin - (columns - 1) * gap) / columns;
    const byHeight = (((height - headerH - margin - (rows - 1) * gap) / rows - labelH) * 16) / 9;
    return { rows, cellW: Math.floor(Math.min(byWidth, byHeight)), heightLimited: byHeight < byWidth };
  };
  // more columns help only while the page is too short for the rows; once the width is what limits the cell, more columns make it smaller
  let columns = Math.min(o.columns, count);
  while (columns < count) {
    const f = fit(columns);
    if (f.cellW >= MIN_CELL_W || !f.heightLimited) break;
    columns++;
  }
  const { rows } = fit(columns);
  const cellW = Math.max(1, fit(columns).cellW);
  const cellH = Math.max(1, Math.floor((cellW * 9) / 16));
  const left0 = margin + Math.floor((width - 2 * margin - (columns * cellW + (columns - 1) * gap)) / 2);
  const cells = Array.from({ length: count }, (_, i) => ({ left: left0 + (i % columns) * (cellW + gap), top: headerH + Math.floor(i / columns) * (cellH + labelH + gap) }));
  return { columns, rows, cellW, cellH, labelH, cells };
}
