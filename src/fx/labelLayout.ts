// THE LAYOUT OF THE RISER LABELS (Patch 19): where each label is on screen at a frame, from the camera and the riser's books. A pure function of the frame; the numbers are
// `src/config/labels.ts`. It is a separate file because it needs the camera path, which reads the shot files, which read the label frames.

import { BOOK_IDS, type BookId } from "../config/books";
import { CHIP_HEIGHT, LABELS, LABEL_PLACE, chipWidthBound, labelFrame, type LabelSide, type Rect } from "../config/labels";
import { getRiserSlots, standingCorners } from "../config/riser";
import { cameraAt } from "../camera/path";
import { PLATE_MATCH, photoToScreen } from "../plate/PlateFollow";
import { projectDesk } from "../plate/plateCamera";

let rects: Record<string, Rect> | null = null;

/** The part of each standing book's cover that shows, in PLATE px: the lower tier's books whole, the upper tier's the strip above the lower books. */
export function bookPlateRects(): Record<BookId, Rect> {
  if (!rects) {
    const out: Record<string, Rect> = {};
    const slots = getRiserSlots();
    for (const s of slots) {
      const pts = standingCorners(s.id, s.pose).map((c) => projectDesk(PLATE_MATCH, c.X, c.Y, c.Zd));
      out[s.id] = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
    }
    const lowerTop = Math.min(...slots.filter((s) => s.tier === "lower").map((s) => out[s.id].y0));
    for (const s of slots) if (s.tier === "upper") out[s.id] = { ...out[s.id], y1: Math.min(out[s.id].y1, lowerTop) };
    rects = out;
  }
  return rects as Record<BookId, Rect>;
}

export interface LabelFrame {
  id: BookId;
  /** the book's visible cover on screen */
  book: Rect;
  dot: { x: number; y: number };
  /** the leader's far end, which is the chip's near edge's middle */
  leaderEnd: { x: number; y: number };
  side: LabelSide;
  /** the chip's box on screen, from the upper bound for the width of its text */
  chip: Rect;
  /** 0 to 1 each */
  dotScale: number;
  leaderDraw: number;
  chipAlpha: number;
  /** the sweep: 0 before and after it, else how far along it is (0 to 1), and the band's alpha now */
  sweep: number;
  sweepAlpha: number;
  /** the fade at the end of S23 */
  fade: number;
}

const ease = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const prog = (f: number, a: number, b: number): number => Math.min(1, Math.max(0, (f - a) / (b - a)));

/** Every label at a frame (all four, with their progress; a label that has not arrived has everything at 0). */
export function labelsAt(frame: number): LabelFrame[] {
  const cam = cameraAt(frame);
  const toScreen = (x: number, y: number): { x: number; y: number } => photoToScreen(cam.view, x, y, cam.rollDeg);
  const plate = bookPlateRects();
  return BOOK_IDS.map((id): LabelFrame => {
    const r = plate[id];
    const a = toScreen(r.x0, r.y0);
    const b = toScreen(r.x1, r.y1);
    const book: Rect = { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    const p = LABEL_PLACE[id];
    const dot = { x: book.x0 + p.u * (book.x1 - book.x0), y: book.y0 + p.v * (book.y1 - book.y0) };
    const dir = p.side === "left" ? -1 : 1;
    const leaderEnd = { x: dot.x + dir * LABELS.leaderLen, y: dot.y };
    const w = chipWidthBound(id);
    const chip: Rect = p.side === "left" ? { x0: leaderEnd.x - w, x1: leaderEnd.x, y0: dot.y - CHIP_HEIGHT / 2, y1: dot.y + CHIP_HEIGHT / 2 } : { x0: leaderEnd.x, x1: leaderEnd.x + w, y0: dot.y - CHIP_HEIGHT / 2, y1: dot.y + CHIP_HEIGHT / 2 };
    const t0 = labelFrame(id);
    const s = prog(frame, t0, t0 + LABELS.sweepFrames);
    const fade = 1 - ease(prog(frame, LABELS.fadeOutFrom, LABELS.fadeOutTo));
    const here = frame >= t0;
    return {
      id,
      book,
      dot,
      leaderEnd,
      side: p.side,
      chip,
      dotScale: here ? ease(prog(frame, t0, t0 + LABELS.dotFrames)) : 0,
      leaderDraw: here ? ease(prog(frame, t0 + LABELS.leaderFrom, t0 + LABELS.leaderTo)) : 0,
      chipAlpha: here ? ease(prog(frame, t0 + LABELS.chipFrom, t0 + LABELS.chipTo)) : 0,
      sweep: here && s < 1 ? s : 0,
      sweepAlpha: here && s < 1 ? Math.sin(Math.PI * s) * LABELS.sweepAlpha : 0,
      fade,
    };
  });
}
