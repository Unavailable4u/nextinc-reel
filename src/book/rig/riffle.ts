// THE RIFFLE (Patch 10, shot S10). 10 to 14 sheets, each turning in `turnFrames` (30), the start of each a little later than the one before:
// the gaps grow from `gapFrom` (6 frames) to `gapTo` (10) in even steps, so the fan opens quickly and thins out. Counting from the first
// sheet's start to the last sheet's start, 12 to 14 sheets take 88 to 104 frames (the config's note); the last sheet lands `turnFrames` later.
//
// Pure functions of the frame, like `turn.ts`: `riffleSheets(frame, params)` gives, for every sheet, its eased progress and the time since
// it landed. Rank 0 turns first; it lies on top of the right-hand stack and lands at the bottom of the left-hand pile (`restOffsets`).

import { SHEET } from "../../config/sheets";
import { EASES, type EaseName } from "../../lib/ease";
import type { SheetPlacement } from "../sheetShape";
import { landSeconds } from "./turn";

export interface RiffleParams {
  /** the frame the first sheet starts to turn */
  start: number;
  /** how many sheets (10 to 14); default `SHEET.riffle.count` */
  count?: number;
  /** frames one sheet takes to turn; default 30 */
  turnFrames?: number;
  /** the gap between the first two starts and between the last two, frames; default 6 and 10 */
  gapFrom?: number;
  gapTo?: number;
  ease?: EaseName;
  /** the book's number of the first sheet that turns (it seeds each sheet's own variation, so a sheet is the same in every render); default 0 */
  first?: number;
  /** sheets already turned when the riffle begins (the Book's `turned` before it); default 0 */
  baseTurned?: number;
}

export interface RiffleSheet {
  /** 0 is the sheet that turns first */
  rank: number;
  count: number;
  /** the sheet's number in the book (`first + rank`) */
  index: number;
  start: number;
  /** the frame it reaches P = 1 */
  end: number;
  P: number;
  landSec: number;
  place: SheetPlacement;
}

const R = SHEET.riffle;

function resolve(p: RiffleParams): Required<Omit<RiffleParams, "start">> & { start: number } {
  const count = p.count ?? R.count;
  if (!Number.isInteger(count) || count < R.min || count > R.max) throw new Error(`riffle: ${R.min} to ${R.max} sheets, got ${count}`);
  const turnFrames = p.turnFrames ?? R.turnFrames;
  if (!(turnFrames > 0)) throw new Error(`riffle: a sheet needs a positive number of frames to turn, got ${turnFrames}`);
  const gapFrom = p.gapFrom ?? R.gapFrom;
  const gapTo = p.gapTo ?? R.gapTo;
  if (!(gapFrom > 0 && gapTo > 0)) throw new Error(`riffle: the gaps between starts must be positive, got ${gapFrom} and ${gapTo}`);
  return { start: p.start, count, turnFrames, gapFrom, gapTo, ease: p.ease ?? R.ease, first: p.first ?? 0, baseTurned: p.baseTurned ?? 0 };
}

/** The start frame of every sheet, rank 0 first. The gap before sheet k + 1 is `gapFrom + (gapTo - gapFrom) k / (count - 2)`. */
export function riffleStarts(params: RiffleParams): number[] {
  const p = resolve(params);
  const gaps = p.count - 1;
  const starts = [p.start];
  for (let k = 0; k < gaps; k++) {
    const gap = gaps > 1 ? p.gapFrom + ((p.gapTo - p.gapFrom) * k) / (gaps - 1) : p.gapFrom;
    starts.push(starts[k] + gap);
  }
  return starts;
}

/** Where the riffle begins and ends, in frames. `startsSpan` is the first start to the last start; `total` is the first start to the last landing. */
export function riffleFrames(params: RiffleParams): { first: number; lastStart: number; last: number; startsSpan: number; total: number } {
  const p = resolve(params);
  const starts = riffleStarts(params);
  const lastStart = starts[starts.length - 1];
  return { first: p.start, lastStart, last: lastStart + p.turnFrames, startsSpan: lastStart - p.start, total: lastStart + p.turnFrames - p.start };
}

/** Every sheet of the riffle at `frame`. */
export function riffleSheets(frame: number, params: RiffleParams): RiffleSheet[] {
  const p = resolve(params);
  const ease = EASES[p.ease];
  return riffleStarts(params).map((start, rank): RiffleSheet => {
    const t = (frame - start) / p.turnFrames;
    return {
      rank,
      count: p.count,
      index: p.first + rank,
      start,
      end: start + p.turnFrames,
      P: ease(Math.min(1, Math.max(0, t))),
      landSec: landSeconds(frame, start, p.turnFrames),
      place: { rank, count: p.count },
    };
  });
}

/**
 * The number to give the Book as `turned` during the riffle: the sheets already turned plus each riffling sheet's progress, so the right-hand
 * stack thins and the left-hand one grows continuously as the sheets cross (guide 06 section 3: "that change is the best 'it is thick' cue").
 * The stacks tile the block exactly whatever this number is; a sheet in the air is the thin leaf drawn on top of them.
 */
export function riffleTurned(frame: number, params: RiffleParams): number {
  const p = resolve(params);
  return p.baseTurned + riffleSheets(frame, params).reduce((sum, s) => sum + s.P, 0);
}