import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S10 - Riffle to the middle (Patch 16). The book is the ledger's: 11 sheets whip across from frame 1920 and the last lands on frame 2030
// (`BOOK_SCRIPT`, `book/rig/riffle.ts`), the stacks go from 2 sheets turned to the middle of the block (64 of 128), and the held book is
// raised from the reading pitch to upright (`config/heroMotion.ts`: pitch -10 to +7 and yaw 0 to 3.5 over frames 1920-2040) so that the
// pages of the next three shots face the camera. This file gives the camera and the cues: one `signature` ease (the ease of S09's key)
// from the reading view to `VIEW_BLOCK` (M 6.52 to 5.8, the window onto the spread's middle, focus 32 to 36), the closing key on frame 2040
// that S11's push starts from. No blur on the riffle yet: the motion-blur decision is Patch 22's.
export const S10 = defineShot("S10", {
  camera: SHOT_KEYFRAMES.S10,
  // guide 08's cue sheet: `riffle` on 1920 (it runs to 2030, the loudest paper sound in the film); the `paper-settle` on 2040 is S11's
  cues: [{ frame: 1920, name: "riffle" }],
});
