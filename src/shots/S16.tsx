import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S16 - Book 2 (MiniLocker): lift (Patch 18). The lift of S04 without the pile hold before it: the pile is already close from S15, so the book goes
// straight up, in the same 120 frames (the guide's "2 s instead of the 4 s that S03-S04 took" counts the hold). The book is the ledger's: `BOOK_SCRIPT`
// lifts MiniLocker on frame 3000 with a speed of 1.3 (the press 6 frames, the rise 59, overshoot and settle done by 3100), `getBookPose` is its one
// source, and the hero tracks of `config/heroMotion.ts` are 0 until the orbit of S17. The pile is SPHEREx alone from 3000 (the ledger).
//
// The camera is one key, on frame 3120 (the closing key on the first frame of S17, as S04's is): the segment from S15's closing key (the pile view,
// M 4.63, focus 40) to it is the R2 to R3 handover again, one `signature` ease to M 6.0, focus 30, f/2 (`HERO_STATES.lift`); its ease is the one S17's glide
// starts with. The operator's reach is S04's alone: nothing in `camera/operator.ts` changes for this shot.
export const S16 = defineShot("S16", {
  camera: SHOT_KEYFRAMES.S16,
  // guide 08's cue sheet: `book-lift` on 3000; the cloth of the second grip is S04's `cloth-on-cloth`, 30 frames in (30 percent faster than 990)
  cues: [
    { frame: 3000, name: "cover-board-thud" },
    { frame: 3030, name: "cloth-on-cloth" },
  ],
});
