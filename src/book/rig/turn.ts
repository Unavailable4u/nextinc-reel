// THE CLOCK OF A TURN (Patch 10). A turn is a start frame, a length in frames and an ease; everything a sheet needs is a pure function
// of the frame number (determinism rule: frame N is a pure function of N). No state, no spring, no Math.random.
//
//   turnProgress(frame, start, durationFrames, ease)   P, 0 to 1, eased
//   turnState(...)                                     P and the time since the turn ended (the sheet's flutter clock)
//
// Time since landing is in SECONDS (the flutter's decay and frequency are in seconds, `config/sheets.ts`); frames are 60 per second.

import { SHEET } from "../../config/sheets";
import { EASES, clamp01, type EaseName } from "../../lib/ease";
import { FPS } from "../../config/timeline";

/** The eased progress of a turn at `frame`: 0 before `start`, 1 from `start + durationFrames` on. */
export function turnProgress(frame: number, start: number, durationFrames: number, ease: EaseName = SHEET.turn.ease): number {
  if (!(durationFrames > 0)) throw new Error(`turn: a turn needs a positive length in frames, got ${durationFrames}`);
  return EASES[ease](clamp01((frame - start) / durationFrames));
}

/** Seconds since the turn reached P = 1 (0 while it has not). */
export const landSeconds = (frame: number, start: number, durationFrames: number): number => Math.max(0, (frame - (start + durationFrames)) / FPS);

export interface TurnState {
  /** eased progress, 0 to 1 */
  P: number;
  /** seconds since the turn ended */
  landSec: number;
}

export function turnState(frame: number, start: number, durationFrames: number, ease: EaseName = SHEET.turn.ease): TurnState {
  return { P: turnProgress(frame, start, durationFrames, ease), landSec: landSeconds(frame, start, durationFrames) };
}

/** The length of a turn in frames: 54 (0.9 s), or the quick 36 (0.6 s) of Book 2's shot. */
export const turnFrames = (quick = false): number => (quick ? SHEET.turn.quickFrames : SHEET.turn.frames);

/**
 * The number to give the Book as `turned` while one sheet crosses: the sheets turned before it plus its progress, so the right-hand stack thins
 * and the left-hand one grows as the sheet goes (`riffleTurned` does the same for a group). The stacks tile the block exactly whatever it is.
 */
export const turnedDuring = (baseTurned: number, P: number): number => baseTurned + P;
