import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S05 - Cover hero: MiniMe in full view (Patch 15). The book is held in front of the lens; the camera is two keys on the way from S04's
// closing key (frame 1080, M 6.0, the pan of the pile hold) to the hero view on frame 1440 (S06's first key): the window slides 48 photo px
// down the plate so the cover stands in the middle of the frame, with a 4 percent push (M 6.24), the lens of the lift (focus 30, f/2).
// The glide is 60 frames of ease-in, a straight run and 90 of ease-out, so the speed never jumps; it is under the R3 limit (10 cm/s,
// 1.5 x per second of M) and the audit finds no hold over 60 frames in it.
//
// The book's own moves are the ledger's and `config/heroMotion.ts`'s, not this file's: the slow yaw orbit of +-8 degrees (the match
// camera cannot orbit, so the cover turns in front of it, D-65) whose middle, the sweep of the foil's reflection across the logo, is
// frame 1260, beat 3 of bar 10. Nothing here places the book.
export const S05 = defineShot("S05", {
  camera: SHOT_KEYFRAMES.S05,
  // guide 01 gives the cover hero no sound of its own: the held breath of S04 carries on (the audio patch decides the room tone)
  cues: [],
});
