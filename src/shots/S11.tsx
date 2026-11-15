import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S11 - Gallery spread: screenshots and captions (Patch 16). The spread is page 6 and 7 of Mini Me (`BOOK_PAGES`: the left page's two
// screenshots, the right page's one and a block of text, each with a caption of at most 8 words, all from the data). The riffle has landed
// on 2030, so the spread is held for 240 frames (the pages are readable well over the 120 frames guide 07 asks for) until the turn of S12.
// The camera is the start of one straight push (`MIDDLE` in `config/camera.ts`): the ease-in ends on frame 2100, the key this file owns, and
// the push goes on at a constant rate to S13: 4 percent a spread, with the window sliding towards the right page.
export const S11 = defineShot("S11", {
  camera: SHOT_KEYFRAMES.S11,
  // guide 08's cue sheet: the soft settle of the riffle's last page, on the first frame of the shot
  cues: [{ frame: 2040, name: "paper-settle" }],
});
