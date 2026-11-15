import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S13 - Links spread: QR codes and addresses (Patch 16). The turn of frame 2520 lands on the spread of pages 10 and 11: "Read on the web"
// on the left, the two QR codes (the case study and the film, 4.6 cm on paper) with their addresses on the right. From frame 2574 (the sheet
// has landed) to 2759 the page is square-on within 4 degrees (the book is raised to a pitch of 87 degrees and turned 3.5 degrees,
// `config/heroMotion.ts`), flat, and steady: the hand's sway of the book is faded out (`MOTION.steady`, `book/rig/hold.ts`) and so are the
// camera's breathing and tremor (`STEADY_RANGES`); the flutter of the landed sheet is over by 2632 and it is on the left page anyway.
// The one key is the closing one on frame 2760, the end of the straight push (M 6.52, focus 28, f/2.8) that S14 starts from.
export const S13 = defineShot("S13", {
  camera: SHOT_KEYFRAMES.S13,
  cues: [{ frame: 2520, name: "page-turn" }],
});
