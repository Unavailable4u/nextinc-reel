// THE CONTINUITY LEDGER, SKELETON (Patch 11). Every book exists once (guide 01, "Continuity ledger"): at every frame a book is in the
// pile, in the hand, beside the pile, on the riser, under the chair wipe's swap, or not in the scene yet. `getBookLocation(id, frame)`
// is the ONE function that says which, so the swap can never drift; `getBookPose(id, frame)` is where the book then is, from the rigs.
//
// WHAT IS HERE. The table, the rigs and (Patch 12) the places: the pile, the spots beside it and the riser. `getBookPose` returns the pose
// of a book that is in the pile, in the hand, beside the pile or on the riser, and null for a book that is under the chair wipe's swap
// (the set is being changed out of sight) or not in the scene yet. The riser's poses come from `config/riser.ts`, the pile's from
// `config/books.ts`; this file only says which one applies at a frame.
//
// The SCRIPT of a book (`BOOK_SCRIPT`) holds the frames of its moves for the shots this patch can verify (S04 to S09, S14 to S16, S18,
// S20 to S21). The riffle and the spreads of S10 to S13 and the rest of the second book's shots are not in it yet: the shot patches
// (14 to 19) add their moves and may change a start frame, never a rig.

import { BOOKS, BOOK_IDS, PILE, pilePoses, type BookId, type BookPose } from "./books";
import { MOTION } from "./bookMotion";
import { heroOffsetAt } from "./heroMotion";
import { ZONES } from "./placement";
import { riserPose } from "./riser";
import { SHEET } from "./sheets";
import { TOTAL } from "./timeline";
import { closeFrames, coverAngleAt, coverOpenSettleFrames, coverSpans, openShape, type CoverEvent } from "../book/rig/cover";
import { liftPoseAt, liftSpan, liftTimes } from "../book/rig/lift";
import { motionActivity, ribbonSwingAt, swaySeedOf, withHero } from "../book/rig/hold";
import { setDownPoseAt, setDownSpan, setDownTimes } from "../book/rig/setDown";
import { landSeconds, turnFrames, turnProgress } from "../book/rig/turn";

export type BookLocation = "pile" | "hand" | "beside" | "riser" | "swap" | "absent";

/** One row of the table in guide 01: the frames (inclusive) and where each book is. */
export interface LedgerRow {
  from: number;
  to: number;
  where: Record<BookId, BookLocation>;
}

const row = (from: number, to: number, mini: BookLocation, locker: BookLocation, sphere: BookLocation, immersive: BookLocation): LedgerRow => ({
  from,
  to,
  where: { "mini-me": mini, minilocker: locker, "spherex-blink": sphere, "next-inc-immersive": immersive },
});

/** The table of guide 01 ("Continuity ledger"). Immersive has never been in the pile: it is on the riser from the start of the swap. */
export const LEDGER: readonly LedgerRow[] = [
  row(0, 959, "pile", "pile", "pile", "absent"),
  row(960, 2879, "hand", "pile", "pile", "absent"),
  row(2880, 2999, "beside", "pile", "pile", "absent"),
  row(3000, 3839, "beside", "hand", "pile", "absent"),
  row(3840, 4139, "beside", "beside", "pile", "absent"),
  row(4140, 4199, "swap", "swap", "swap", "riser"),
  row(4200, TOTAL - 1, "riser", "riser", "riser", "riser"),
];

/** Where a book is at a frame (frames outside the film clamp to the first or last row). */
export function getBookLocation(id: BookId, frame: number): BookLocation {
  const fr = Math.min(Math.max(Math.round(frame), 0), TOTAL - 1);
  const r = LEDGER.find((x) => fr >= x.from && fr <= x.to);
  if (!r) throw new Error(`ledger: no row covers frame ${fr}`);
  return r.where[id];
}

/** Every book at a frame, grouped by where it is: the table of guide 01 as one object. A book appears in exactly one list. */
export function booksAt(frame: number): Record<BookLocation, BookId[]> {
  const out: Record<BookLocation, BookId[]> = { pile: [], hand: [], beside: [], riser: [], swap: [], absent: [] };
  for (const id of BOOK_IDS) out[getBookLocation(id, frame)].push(id);
  return out;
}

/** Throws unless the rows are contiguous from 0 to the last frame. Runs when this module loads. */
export function checkLedger(rows: readonly LedgerRow[] = LEDGER, total = TOTAL): void {
  let expect = 0;
  for (const r of rows) {
    if (r.from !== expect) throw new Error(`ledger: a row starts at ${r.from}, expected ${expect} (gap or overlap)`);
    if (r.to < r.from) throw new Error(`ledger: a row ends (${r.to}) before it starts (${r.from})`);
    expect = r.to + 1;
  }
  if (expect !== total) throw new Error(`ledger: the rows end at frame ${expect - 1}, expected ${total - 1}`);
}
checkLedger();

// ---------------------------------------------------------------------------------------------------------------------------
// where a book rests
// ---------------------------------------------------------------------------------------------------------------------------

/** The pose of a book lying in the pile (Patch 06's `pilePoses` at the pile zone's anchor). */
export function pilePose(id: BookId): BookPose {
  const p = pilePoses(ZONES.L.anchor).find((x) => x.id === id);
  if (!p) throw new Error(`ledger: ${id} is not one of the pile's books (${PILE.map((s) => s.id).join(", ")})`);
  return p.pose;
}

/**
 * Where a book lies BESIDE the pile, desk coordinates relative to the pile's anchor (Patch 12). The two books lie face up with the spine
 * to the left (the way they were read), to the pile's left, a little apart, a little askew (guide 03 section 6): the nearer book
 * first. Lying like this a book is 15.2 cm across, so the pair spans X -47.9 to -14.5 from the pile's middle: 2.4 cm from the pile, 1.6 cm
 * between the books, 5.6 cm inside the desk's left end and 25 cm in front of the lamp's base (which stands at the back, Zd 53 and more).
 * `tests/set.test.ts` checks that the books clear the pile, each other, the desk's edges and every exclusion.
 */
export const BESIDE: Partial<Record<BookId, { dx: number; dzd: number; yawDeg: number }>> = {
  "mini-me": { dx: -22.5, dzd: 0.4, yawDeg: -2 },
  minilocker: { dx: -40, dzd: -0.3, yawDeg: 1.5 },
};

export function besidePose(id: BookId): BookPose {
  const b = BESIDE[id];
  if (!b) throw new Error(`ledger: ${id} has no spot beside the pile`);
  const a = ZONES.L.anchor;
  return { position: [a.X + b.dx, 0, -(a.Zd + b.dzd)], yawDeg: b.yawDeg };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the script of a book
// ---------------------------------------------------------------------------------------------------------------------------

/** A page turn: it starts at a frame, takes 54 frames (36 if quick) and turns the next sheet over to the left, or (dir -1) the top sheet of the left stack back. */
export interface TurnEvent {
  start: number;
  dir?: 1 | -1;
  quick?: boolean;
}

export interface BookScript {
  /** the first frame of the press: it is the first frame the book is in the hand */
  lift: { start: number; speed: number };
  cover: readonly CoverEvent[];
  turns: readonly TurnEvent[];
  /** the first frame of the carry: it is the first frame the book is beside the pile */
  setDown: { start: number; speed: number };
}

/**
 * The first two books (guide 01, Acts 2, 3, 5 and 6; the second book's moves are 30 percent faster). Frames are the start frames of the
 * moves; the shot patches (14 to 19) refine them.
 */
export const BOOK_SCRIPT: Partial<Record<BookId, BookScript>> = {
  "mini-me": {
    lift: { start: 960, speed: 1 }, // S04
    cover: [
      { kind: "open", start: 1440 }, // S06
      { kind: "close", start: 2808, opts: { speed: 1.4 } }, // S14, after the pages are flipped back
    ],
    turns: [
      { start: 1560 }, // S07: the half-title
      { start: 1680 }, // S08: the title page
      { start: 2760, dir: -1, quick: true }, // S14: the pages flip back to the front
      { start: 2772, dir: -1, quick: true },
    ],
    setDown: { start: 2880, speed: 1 }, // S15
  },
  minilocker: {
    lift: { start: 3000, speed: 1.3 }, // S16
    cover: [
      { kind: "open", start: 3360, opts: { speed: 1.3 } }, // S18
      { kind: "close", start: 3828, opts: { speed: 1.4 } }, // the page is back at 3828; the cover lands at 3875, 35 frames into the carry (see the notes of Patch 11)
    ],
    turns: [
      { start: 3420, quick: true }, // S18: straight to the title page
      { start: 3792, dir: -1, quick: true }, // S20: the page goes back
    ],
    setDown: { start: 3840, speed: 1.3 }, // S21
  },
};

export const scriptOf = (id: BookId): BookScript | null => BOOK_SCRIPT[id] ?? null;

const coverEvents = new Map<BookId, readonly CoverEvent[]>();

/**
 * The cover events of a book with the book's weight filled in, unless the script gave one: a heavier cover swings more slowly (the rule of
 * `config/bookMotion.ts`), and the rigs only know the weight if they are told it.
 */
export function coverEventsOf(id: BookId): readonly CoverEvent[] {
  const hit = coverEvents.get(id);
  if (hit) return hit;
  const s = scriptOf(id);
  const w = BOOKS[id].weightG;
  const out = (s?.cover ?? []).map((e): CoverEvent => (e.kind === "open" ? { ...e, opts: { weightG: w, ...e.opts } } : { ...e, opts: { weightG: w, ...e.opts } }));
  coverEvents.set(id, out);
  return out;
}

/** Throws unless every script agrees with the ledger: the lift starts on the first frame in the hand, the set-down on the first beside. */
export function checkScripts(): void {
  for (const [id, s] of Object.entries(BOOK_SCRIPT) as [BookId, BookScript][]) {
    const hand = LEDGER.find((r) => r.where[id] === "hand");
    const beside = LEDGER.find((r) => r.where[id] === "beside");
    if (!hand || hand.from !== s.lift.start) throw new Error(`ledger: the script of ${id} lifts at ${s.lift.start} but the book is in the hand from ${hand?.from}`);
    if (!beside || beside.from !== s.setDown.start) throw new Error(`ledger: the script of ${id} sets down at ${s.setDown.start} but the book is beside the pile from ${beside?.from}`);
  }
}
checkScripts();

// ---------------------------------------------------------------------------------------------------------------------------
// the turns
// ---------------------------------------------------------------------------------------------------------------------------

const turnLength = (e: TurnEvent): number => turnFrames(e.quick ?? false);

/** The number to give the Book as `turned` at a frame: each turn adds (or takes away) its eased progress. */
export function turnedAt(frame: number, turns: readonly TurnEvent[]): number {
  let n = 0;
  for (const e of turns) n += (e.dir ?? 1) * turnProgress(frame, e.start, turnLength(e));
  return n;
}

/**
 * The sheets turned to the left (counting a turn whose sheet has landed, and taking one off at the start of a turn back) and whether a
 * sheet is in the air, at a frame. It says which pages are on the two stacks' faces (`faceIndices`) and which sheets `<Sheet>` draws.
 */
export function stacksAt(frame: number, turns: readonly TurnEvent[]): { left: number; airborne: boolean } {
  let left = 0;
  let airborne = false;
  for (const e of turns) {
    const len = turnLength(e);
    const P = turnProgress(frame, e.start, len);
    if (e.dir === -1) {
      if (frame >= e.start) left -= 1;
      if (frame >= e.start && P < 1) airborne = true;
    } else {
      if (P >= 1) left += 1;
      if (frame >= e.start && P < 1) airborne = true;
    }
  }
  return { left, airborne };
}

/**
 * The indices (in `BOOK_PAGES`) of the page on the left face and on the right face of an open book at a frame. The leaf k has page 2k + 1
 * on its front and 2k + 2 on its back, so with `left` sheets turned the left face shows the back of sheet left - 1 (index 2 x left; the
 * endpaper, index 0, before any turn) and the right face the front of the next sheet (index 2 x left + 1); while a sheet is in the air the
 * right face already shows the page under it (2 x (left + 1) + 1).
 */
export function faceIndices(frame: number, turns: readonly TurnEvent[]): { left: number; right: number } {
  const st = stacksAt(frame, turns);
  return { left: 2 * st.left, right: 2 * (st.left + (st.airborne ? 1 : 0)) + 1 };
}

/** A sheet that is in the air, or has only just landed (its flutter is still audible): what the `<Sheet>` is given. */
export interface AirSheet {
  /** the sheet's number in the book */
  index: number;
  /** the number of sheets turned when its turn began (the Sheet's `baseTurned`) */
  baseTurned: number;
  /** the Sheet's progress: 0 on the right stack, 1 on the left (a turn back runs from 1 to 0) */
  progress: number;
  landSec: number;
}

/** How long after landing a sheet still flutters enough to be drawn as a Sheet (eight time constants of its flutter, `SHEET.flutter.tauSec`). */
export const FLUTTER_SEC = 8 * SHEET.flutter.tauSec;

export function airSheetsAt(frame: number, turns: readonly TurnEvent[]): AirSheet[] {
  const out: AirSheet[] = [];
  let before = 0;
  for (const e of turns) {
    const dir = e.dir ?? 1;
    const len = turnLength(e);
    const index = dir === 1 ? before : before - 1;
    const P = turnProgress(frame, e.start, len);
    const landSec = landSeconds(frame, e.start, len);
    if (frame >= e.start && (dir === -1 ? frame < e.start + len : landSec < FLUTTER_SEC)) {
      out.push({ index, baseTurned: index, progress: dir === 1 ? P : 1 - P, landSec: dir === 1 ? landSec : 0 });
    }
    before += dir;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// the pose and the state
// ---------------------------------------------------------------------------------------------------------------------------

/** What a scene needs to draw a book at a frame. */
export interface BookMotionState {
  pose: BookPose;
  coverAngle: number;
  turned: number;
  ribbonSwing: number;
  airSheets: AirSheet[];
  location: BookLocation;
}

/**
 * The pose of a book at a frame, from the rigs and the places: the pile's, the lift's, the set-down's or the riser's slot. Null when the
 * book is under the chair wipe's swap or not in the scene yet.
 */
export function getBookPose(id: BookId, frame: number): BookPose | null {
  const where = getBookLocation(id, frame);
  const s = scriptOf(id);
  switch (where) {
    case "pile":
      return pilePose(id);
    case "hand": {
      if (!s) return null;
      // the lift's pose (press, rise, hold with its sway) with the hero motion on top: the orbit and the reading tilt of `config/heroMotion.ts`
      return withHero(liftPoseAt(frame, { id, start: s.lift.start, rest: pilePose(id), speed: s.lift.speed }), id, heroOffsetAt(frame));
    }
    case "beside": {
      if (!s) return null;
      return setDownPoseAt(frame, { id, start: s.setDown.start, rest: besidePose(id), speed: s.setDown.speed });
    }
    case "riser":
      return riserPose(id);
    default:
      return null;
  }
}

/** The spans of a book's moves, for the ribbon. */
export function motionSpans(id: BookId): { from: number; to: number }[] {
  const s = scriptOf(id);
  if (!s) return [];
  return [liftSpan(id, s.lift.start, s.lift.speed), ...coverSpans(coverEventsOf(id)), ...s.turns.map((e) => ({ from: e.start, to: e.start + turnLength(e) })), setDownSpan(id, s.setDown.start, s.setDown.speed)];
}

/** Everything a scene needs to draw a book at a frame, or null when it is not in the scene (under the swap, or not there yet). */
export function getBookState(id: BookId, frame: number): BookMotionState | null {
  const pose = getBookPose(id, frame);
  if (!pose) return null;
  const location = getBookLocation(id, frame);
  const s = scriptOf(id);
  if (!s) return { pose, coverAngle: 0, turned: 0, ribbonSwing: 0, airSheets: [], location };
  const activity = motionActivity(frame, motionSpans(id));
  return {
    pose,
    coverAngle: coverAngleAt(frame, coverEventsOf(id)),
    turned: turnedAt(frame, s.turns),
    ribbonSwing: ribbonSwingAt(frame, swaySeedOf(id), BOOKS[id].weightG, activity),
    airSheets: airSheetsAt(frame, s.turns),
    location,
  };
}

/** Frame numbers of the moves the rigs time themselves (for tests and the lab): the lift's and the set-down's key frames of a scripted book. */
export function keyFrames(id: BookId): { lift: ReturnType<typeof liftTimes>; setDown: ReturnType<typeof setDownTimes> } | null {
  const s = scriptOf(id);
  if (!s) return null;
  return { lift: liftTimes(id, s.lift.start, s.lift.speed), setDown: setDownTimes(id, s.setDown.start, s.setDown.speed) };
}
/**
 * What a book is doing at a frame, in words (for `DevBookMotion` and for the notes): the press, the rise, the lift's settle, the opening,
 * the closing, the turns in the air, the carry and the set-down's settle. More than one at a time is normal (the cover closes while the
 * book is carried, for the second book). An empty list is a book at rest or held still.
 */
export function movesAt(id: BookId, frame: number): string[] {
  const s = scriptOf(id);
  if (!s) return [];
  const out: string[] = [];
  const lt = liftTimes(id, s.lift.start, s.lift.speed);
  if (frame >= lt.start && frame < lt.riseStart) out.push("press");
  else if (frame >= lt.riseStart && frame < lt.riseEnd) out.push("rise");
  else if (frame >= lt.riseEnd && frame < lt.settled) out.push("lift settle");
  for (const e of coverEventsOf(id)) {
    const f = frame - e.start;
    if (f < 0) continue;
    if (e.kind === "open") {
      if (f < openShape(e.opts).swingFrames) out.push("cover opens");
      else if (f < coverOpenSettleFrames(e.opts)) out.push("cover settles");
    } else if (f < closeFrames(e.opts)) out.push("cover closes");
    else if (f < closeFrames(e.opts) + MOTION.restAfterFrames) out.push("cover lands");
  }
  s.turns.forEach((e, i) => {
    if (frame >= e.start && frame < e.start + turnLength(e)) out.push(`${e.dir === -1 ? "turn back" : "turn"} ${i + 1}`);
  });
  const dt = setDownTimes(id, s.setDown.start, s.setDown.speed);
  if (frame >= dt.start && frame < dt.contact) out.push("carry");
  else if (frame >= dt.contact && frame < dt.rest) out.push("set-down settle");
  return out;
}
