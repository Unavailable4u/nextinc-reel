// THE CONTINUITY LEDGER, SKELETON (Patch 11). Every book exists once (guide 01, "Continuity ledger"): at every frame a book is in the
// pile, in the hand, beside the pile, on the riser, under the chair wipe's swap, or not in the scene yet. `getBookLocation(id, frame)`
// is the ONE function that says which, so the swap can never drift; `getBookPose(id, frame)` is where the book then is, from the rigs.
//
// WHAT IS HERE. The table, the rigs and (Patch 12) the places: the pile, the spots beside it and the riser. `getBookPose` returns the pose
// of a book that is in the pile, in the hand, beside the pile or on the riser, and null for a book that is under the chair wipe's swap
// (the set is being changed out of sight) or not in the scene yet. The riser's poses come from `config/riser.ts`, the pile's from
// `config/books.ts`; this file only says which one applies at a frame.
//
// The SCRIPT of a book (`BOOK_SCRIPT`) holds the frames of its moves for the shots this patch can verify (S04 to S16, S18,
// S20 to S21). Mini Me's riffle and the turns of S12 and S13 were added by Patch 16; the rest of the second book's shots are not in it
// yet: the shot patches (17 to 19) add their moves and may change a start frame, never a rig.

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
import { riffleFrames, riffleSheets } from "../book/rig/riffle";
import { landSeconds, turnFrames, turnProgress } from "../book/rig/turn";
import { SINGLE, type SheetPlacement } from "../book/sheetShape";

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

/**
 * A page turn: it starts at a frame, takes 54 frames (36 if quick) and turns the next sheet over to the left, or (dir -1) the top sheet of
 * the left stack back.
 *
 * Two numbers say what a turn does to the book beyond the one sheet it draws (Patch 16). The block has many sheets (128 for Mini Me) but the
 * painted pages are a short list (`BOOK_PAGES`, 6 leaves), so a turn can carry more than one of each:
 *   `through`  how many sheets of the BLOCK the two stacks change by (the number the Book is given as `turned`); default 1
 *   `leaves`   how many leaves of the PAGE LIST the faces move on by; default 1
 * A turn that flips a chunk of pages back (S14) has both above 1; the sums over a book's script must be 0 when it is closed (`checkTurns`).
 *
 * With `riffle` it is not one sheet but a riffle (S10, `book/rig/riffle.ts`): that many sheets (10 to 14) whip across, one after another,
 * and the book lands on a spread further on. `through` is then how many sheets of the block the stacks change by in all (default the
 * number drawn): a riffle that shows 11 sheets can take the book to the middle of its 128, which is what makes the block read as thick.
 * A riffle always goes forward. Its own sheets are blank paper, except the first (it carries the right page the riffle starts from) and
 * the last (its back is the left page the riffle lands on).
 */
export interface TurnEvent {
  start: number;
  dir?: 1 | -1;
  quick?: boolean;
  /** a riffle of this many sheets (10 to 14) instead of a single sheet */
  riffle?: number;
  /** sheets of the block the stacks change by (default 1; for a riffle, the number of sheets drawn) */
  through?: number;
  /** leaves of the page list the faces move on by (default 1) */
  leaves?: number;
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
      { kind: "close", start: 2820, opts: { speed: 1.4 } }, // S14, after the pages are flipped back (they land on 2808): the board lands on 2870
    ],
    turns: [
      { start: 1560 }, // S07: the half-title
      { start: 1680 }, // S08: the title page
      { start: 1920, riffle: 11, through: 62 }, // S10: the riffle, 11 sheets over frames 1920-2030, to the middle of the 128 sheets (gallery spread)
      { start: 2280 }, // S12: the film spread (the full turn animation, guide 01)
      { start: 2520 }, // S13: the links spread
      // S14: the pages flip back to the front in two chunks (33 sheets and 3 leaves, then 33 sheets and 2 leaves), so the block is closed on 0 turned
      { start: 2760, dir: -1, quick: true, through: 33, leaves: 3 },
      { start: 2772, dir: -1, quick: true, through: 33, leaves: 2 },
    ],
    // S15. The carry has to touch the desk on beat 98 (frame 2940, Patch 17): 60 frames. The book's 560 g make a carry of 89 frames at speed 1
    // (contact on 2969, off the beat); every speed from 1.470 to 1.494 gives 60 (`framesFor` rounds), 1.48 is the middle of them.
    setDown: { start: 2880, speed: 1.48 },
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

/**
 * Throws unless a book's turns bring it back to a closed block: at no frame are fewer than 0 sheets or leaves turned, and at the end both
 * sums are 0 (the cover closes on a block with nothing turned: S14, S21). Runs for every script when this module loads.
 */
export function checkTurns(id: string, turns: readonly TurnEvent[]): void {
  let sheets = 0;
  let leaves = 0;
  [...turns]
    .sort((a, b) => a.start - b.start)
    .forEach((e, i) => {
      const dir = e.dir ?? 1;
      if (e.riffle && dir !== 1) throw new Error(`ledger: ${id} turn ${i}: a riffle only goes forward`);
      if (e.riffle && (e.riffle < 10 || e.riffle > 14)) throw new Error(`ledger: ${id} turn ${i}: a riffle is 10 to 14 sheets, got ${e.riffle}`);
      const phys = e.through ?? (e.riffle ?? 1);
      if (!(phys >= (e.riffle ?? 1))) throw new Error(`ledger: ${id} turn ${i}: it changes the stacks by ${phys} sheets but draws ${e.riffle ?? 1}`);
      sheets += dir * phys;
      leaves += dir * (e.leaves ?? 1);
      if (sheets < 0 || leaves < 0) throw new Error(`ledger: ${id} turn ${i} (frame ${e.start}) turns back more than has been turned (${sheets} sheets, ${leaves} leaves)`);
    });
  if (sheets !== 0 || leaves !== 0) throw new Error(`ledger: the turns of ${id} end with ${sheets} sheets and ${leaves} leaves turned, the book is closed on a block with nothing turned`);
}
for (const [id, s] of Object.entries(BOOK_SCRIPT)) checkTurns(id, s.turns);

// ---------------------------------------------------------------------------------------------------------------------------
// the turns
// ---------------------------------------------------------------------------------------------------------------------------

/** The sheets a riffle event draws. */
const riffleCount = (e: TurnEvent): number => e.riffle ?? 1;
/** The sheets of the block a turn event changes the stacks by, and the leaves of the page list it moves the faces by. */
const sheetsOf = (e: TurnEvent): number => e.through ?? riffleCount(e);
const leavesOf = (e: TurnEvent): number => e.leaves ?? 1;

/** The frames a turn event takes: a sheet's 54 (36 quick), or a riffle's first start to its last landing. */
const turnLength = (e: TurnEvent): number => (e.riffle ? riffleFrames({ start: e.start, count: e.riffle }).total : turnFrames(e.quick ?? false));

/** The number to give the Book as `turned` at a frame: each turn adds (or takes away) its `through` sheets as its eased progress goes, a riffle as its sheets cross. */
export function turnedAt(frame: number, turns: readonly TurnEvent[]): number {
  let n = 0;
  for (const e of turns) {
    if (e.riffle) {
      const crossed = riffleSheets(frame, { start: e.start, count: e.riffle }).reduce((sum, x) => sum + x.P, 0);
      n += (sheetsOf(e) * crossed) / e.riffle;
    } else {
      n += (e.dir ?? 1) * sheetsOf(e) * turnProgress(frame, e.start, turnLength(e));
    }
  }
  return n;
}

/**
 * The PAGES' count of leaves turned to the left (a turn whose sheet has landed counts, a turn back is taken off at its start, a riffle
 * counts once its last sheet has landed; each by its `leaves`) and whether a sheet is in the air, at a frame. It says which pages are on
 * the two stacks' faces (`faceIndices`) and which sheets `<Sheet>` draws. It is not the number of sheets of the block that are turned
 * (`turnedAt`): a riffle moves the block's stacks by many sheets and the pages by one leaf.
 */
export function stacksAt(frame: number, turns: readonly TurnEvent[]): { left: number; airborne: boolean } {
  let left = 0;
  let airborne = false;
  for (const e of turns) {
    const len = turnLength(e);
    if (e.riffle) {
      if (frame >= e.start + len) left += leavesOf(e);
      if (frame >= e.start && frame < e.start + len) airborne = true;
      continue;
    }
    const P = turnProgress(frame, e.start, len);
    if (e.dir === -1) {
      if (frame >= e.start) left -= leavesOf(e);
      if (frame >= e.start && P < 1) airborne = true;
    } else {
      if (P >= 1) left += leavesOf(e);
      if (frame >= e.start && P < 1) airborne = true;
    }
  }
  return { left, airborne };
}

/** The leaves of the page list that the turn in the air (if any) moves the faces by: the page under it is that many leaves further on. */
function leavesInAir(frame: number, turns: readonly TurnEvent[]): number {
  for (const e of turns) {
    if (e.riffle) continue;
    const len = turnLength(e);
    const P = turnProgress(frame, e.start, len);
    if (frame >= e.start && P < 1) return leavesOf(e);
  }
  return 1;
}

/** The index that means "no painted page": a face of body text the book's page list does not paint, drawn as blank paper (`PageSet.texture` gives null for it). */
export const BLANK_PAGE = -1;

/**
 * The indices (in `BOOK_PAGES`) of the page on the left face and on the right face of an open book at a frame, or `BLANK_PAGE`. The leaf k has page 2k + 1
 * on its front and 2k + 2 on its back, so with `left` leaves turned the left face shows the back of leaf left - 1 (index 2 x left; the
 * endpaper, index 0, before any turn) and the right face the front of the next leaf (index 2 x left + 1); while a sheet is in the air the
 * right face already shows the page under it (2 x (left + 1) + 1).
 *
 * During a riffle (Patch 16) the faces are the ones the fan shows: the right face is the page the riffle starts from until the first
 * sheet has left it, then blank paper, and the page the riffle lands on (2 x (left + 1) + 1) from the frame the last sheet starts to
 * turn; the left face keeps its page until the first sheet has landed on it, is blank paper while the sheets pile up, and shows the
 * page the riffle lands on (2 x (left + 1)) once the last sheet has landed. A sheet always covers the face it leaves or lands on, so
 * none of these changes is seen.
 */
export function faceIndices(frame: number, turns: readonly TurnEvent[]): { left: number; right: number } {
  for (const e of turns) {
    if (!e.riffle) continue;
    const len = turnLength(e);
    if (frame < e.start || frame >= e.start + len) continue;
    const before = stacksAt(e.start - 1, turns).left;
    const sheets = riffleSheets(frame, { start: e.start, count: e.riffle });
    const first = sheets[0];
    const last = sheets[sheets.length - 1];
    return {
      left: first.P < 1 ? 2 * before : BLANK_PAGE,
      right: last.P > 0 ? 2 * (before + leavesOf(e)) + 1 : frame > e.start ? BLANK_PAGE : 2 * before + 1,
    };
  }
  const st = stacksAt(frame, turns);
  return { left: 2 * st.left, right: 2 * (st.left + (st.airborne ? leavesInAir(frame, turns) : 0)) + 1 };
}

/** A sheet that is in the air, or has only just landed (its flutter is still audible): what the `<Sheet>` is given. */
export interface AirSheet {
  /** the sheet's number in the book (it seeds the sheet's own small differences) */
  index: number;
  /** the number of sheets turned when its turn began (the Sheet's `baseTurned`) */
  baseTurned: number;
  /** the Sheet's progress: 0 on the right stack, 1 on the left (a turn back runs from 1 to 0) */
  progress: number;
  landSec: number;
  /** where the sheet stands in its group: alone for a single turn, the rank and count of a riffle (`SINGLE` or `{ rank, count }`) */
  place: SheetPlacement;
  /** the pages on the sheet's two sides, as indices in `BOOK_PAGES` (`BLANK_PAGE` for a side that is blank paper): the right page it starts on, the left page it ends on */
  front: number;
  back: number;
}

/** How long after landing a sheet still flutters enough to be drawn as a Sheet (eight time constants of its flutter, `SHEET.flutter.tauSec`). */
export const FLUTTER_SEC = 8 * SHEET.flutter.tauSec;

export function airSheetsAt(frame: number, turns: readonly TurnEvent[]): AirSheet[] {
  const out: AirSheet[] = [];
  // `before` counts the sheets of the block turned so far, `leaf` the leaves of the page list: they differ after a riffle or a chunk
  let before = 0;
  let leaf = 0;
  for (const e of turns) {
    const len = turnLength(e);
    const L = leavesOf(e);
    if (e.riffle) {
      const count = e.riffle;
      for (const x of riffleSheets(frame, { start: e.start, count, first: before, baseTurned: before })) {
        if (frame >= x.start && x.landSec < FLUTTER_SEC) {
          out.push({
            index: x.index,
            baseTurned: before,
            progress: x.P,
            landSec: x.landSec,
            place: x.place,
            front: x.rank === 0 ? 2 * leaf + 1 : BLANK_PAGE,
            back: x.rank === count - 1 ? 2 * (leaf + L) : BLANK_PAGE,
          });
        }
      }
      before += sheetsOf(e);
      leaf += L;
      continue;
    }
    const dir = e.dir ?? 1;
    const index = dir === 1 ? before : before - 1;
    const P = turnProgress(frame, e.start, len);
    const landSec = landSeconds(frame, e.start, len);
    if (frame >= e.start && (dir === -1 ? frame < e.start + len : landSec < FLUTTER_SEC)) {
      // forward: the right page it starts on, the left page it lands on; back: the left page it starts on, the right page it lands on
      const front = dir === 1 ? 2 * leaf + 1 : 2 * (leaf - L) + 1;
      const back = dir === 1 ? 2 * (leaf + L) : 2 * leaf;
      out.push({ index, baseTurned: index, progress: dir === 1 ? P : 1 - P, landSec: dir === 1 ? landSec : 0, place: SINGLE, front, back });
    }
    before += dir * sheetsOf(e);
    leaf += dir * L;
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
