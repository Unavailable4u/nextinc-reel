// THE MASTER CLOCK. 60 fps, 120 BPM: 1 beat = 30 frames, 1 bar = 120 frames. 5400 frames = 90.000 s.
// The SHOTS table below is copied from docs/guide/01-storyboard.md ("Master shot list"). If you change one, change the other
// and record it in docs/PATCH_NOTES.md.
//
// This file has no imports on purpose, so a plain `node` can read it (see `npm run timeline`).

export const FPS = 60;
export const BEAT = 30;
export const BAR = 120;
export const TOTAL = 5400;

export const WIDTH = 1920;
export const HEIGHT = 1080;

/** seconds -> frames */
export const sec = (s: number): number => Math.round(s * FPS);
/** beats -> frames */
export const beat = (n: number): number => Math.round(n * BEAT);
/** bars -> frames */
export const bar = (n: number): number => Math.round(n * BAR);
/** marks a literal frame number in a table (documentation only) */
export const f = (n: number): number => n;

/** R1 establishing, R2 plate-follow, R3 hero (book held in front of the camera), R4 truck / display. See guide 05. */
export type Regime = "R1" | "R2" | "R3" | "R4" | "R3/2" | "R2/4";

export interface Shot {
  id: string;
  name: string;
  /** first frame (inclusive) */
  from: number;
  /** last frame (inclusive) */
  to: number;
  regime: Regime;
}

const s = (id: string, name: string, from: number, to: number, regime: Regime): Shot => ({ id, name, from, to, regime });

export const SHOTS: readonly Shot[] = [
  s("S00", "Plate: the desk, untouched", 0, 239, "R1"),
  s("S01", "Approach A: someone walks to the desk", 240, 479, "R2"),
  s("S02", "Approach B: the pile resolves, focus pull", 480, 839, "R2"),
  s("S03", "Pile hold: the spines read", 840, 959, "R2"),
  s("S04", "Lift: the top book rises and turns to us", 960, 1079, "R3"),
  s("S05", "Cover hero: MiniMe in full view", 1080, 1439, "R3"),
  s("S06", "Open the cover", 1440, 1559, "R3"),
  s("S07", "Page turn 1: title page", 1560, 1679, "R3"),
  s("S08", "Page turn 2: abstract and figure", 1680, 1799, "R3"),
  s("S09", "Read hold", 1800, 1919, "R3"),
  s("S10", "Riffle to the middle", 1920, 2039, "R3"),
  s("S11", "Gallery spread: screenshots and captions", 2040, 2279, "R3"),
  s("S12", "Film spread: promo thumbnail with play mark", 2280, 2519, "R3"),
  s("S13", "Links spread: QR codes and addresses", 2520, 2759, "R3"),
  s("S14", "Close the book", 2760, 2879, "R3"),
  s("S15", "Set down and settle", 2880, 2999, "R2"),
  s("S16", "Book 2 (MiniLocker): lift", 3000, 3119, "R3"),
  s("S17", "Book 2: cover hero", 3120, 3359, "R3"),
  s("S18", "Book 2: open", 3360, 3479, "R3"),
  s("S19", "Book 2: riffle, then gallery spread", 3480, 3719, "R3"),
  s("S20", "Book 2: film spread and QR", 3720, 3839, "R3"),
  s("S21", "Book 2: close and set down", 3840, 3959, "R3/2"),
  s("S22", "Pull back and truck right (chair wipe)", 3960, 4319, "R2/4"),
  s("S23", "Riser reveal: the four books, marked", 4320, 4799, "R4"),
  s("S24", "Room dims, wordmark and tagline", 4800, 5279, "R4"),
  s("S25", "End hold and fade to black", 5280, 5399, "R4"),
];

/** Throws unless the shots are contiguous from 0, in order, and sum to TOTAL. Runs when this module loads. */
export function checkTimeline(shots: readonly Shot[] = SHOTS, total: number = TOTAL): void {
  let expect = 0;
  shots.forEach((sh, i) => {
    const want = `S${String(i).padStart(2, "0")}`;
    if (sh.id !== want) throw new Error(`timeline: shot ${i} is "${sh.id}", expected "${want}"`);
    if (sh.from !== expect) throw new Error(`timeline: ${sh.id} starts at ${sh.from}, expected ${expect} (gap or overlap)`);
    if (sh.to < sh.from) throw new Error(`timeline: ${sh.id} ends (${sh.to}) before it starts (${sh.from})`);
    if ((sh.to - sh.from + 1) % BAR !== 0) throw new Error(`timeline: ${sh.id} is ${sh.to - sh.from + 1} frames, not a whole number of bars (${BAR})`);
    expect = sh.to + 1;
  });
  if (expect !== total) throw new Error(`timeline: shots end at frame ${expect - 1}, expected ${total - 1} (TOTAL ${total})`);
}
checkTimeline();

/** The shot a frame belongs to (frames outside the film clamp to the first or last shot). */
export function shotAt(frame: number): Shot {
  const fr = Math.min(Math.max(Math.round(frame), 0), TOTAL - 1);
  let lo = 0;
  let hi = SHOTS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (SHOTS[mid].from <= fr) lo = mid;
    else hi = mid - 1;
  }
  return SHOTS[lo];
}

/** 0-based beat and bar numbers of a frame, and the frame's position inside its beat. */
export function clockAt(frame: number): { beat: number; bar: number; beatInBar: number; frameInBeat: number } {
  const fr = Math.max(0, Math.round(frame));
  const b = Math.floor(fr / BEAT);
  return { beat: b, bar: Math.floor(fr / BAR), beatInBar: b % (BAR / BEAT), frameInBeat: fr % BEAT };
}

/** "m:ss.ss" */
export function timecode(frame: number): string {
  const t = Math.max(0, frame) / FPS;
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
}

/** Frames where one shot ends and the next begins. All land on a bar line. */
export const CUT_FRAMES: readonly number[] = SHOTS.slice(1).map((sh) => sh.from);
