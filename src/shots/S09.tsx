import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S09 - Read hold (Patch 15). The book is held open at the abstract and the figure; the camera drifts on down the right page towards the
// caption: the one key is the closing one on frame 1920 (the first frame of S10, which starts from it): M 6.52, the window 12 photo px
// down the page from the open view, focus 32, f/2.8. It is the end of a straight run, so the camera arrives at speed; S10 (Patch 16) starts
// from this state and may change the ease of this key. The held book's hand-held sway (`book/rig/hold.ts`) is
// the only other movement, so the shot is never still (guide 05, rule 1).
export const S09 = defineShot("S09", {
  camera: SHOT_KEYFRAMES.S09,
  // guide 08 has no cue for the read hold; the page settle after the second turn is S08's
  cues: [],
});
