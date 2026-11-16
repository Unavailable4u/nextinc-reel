import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S19 - Book 2: riffle, then gallery spread (Patch 18). One short riffle: 10 sheets, each turning in 20 frames with the starts 3 to 5 frames apart, from frame 3510
// to the last landing on 3566 (56 frames; guide 08's cue sheet has it from 3480 to 3535: it starts 30 frames later so that the title spread can be read for 120
// frames, guide 07). The stacks go from 0 to 48 sheets of the 112, the middle of the block, and the book lands on the gallery spread (pages 2 and 3, the four
// cropped screenshots with their captions: `BOOK_TEXT.minilocker.screenshots`). The book is raised upright with the riffle (pitch -10 to +7, yaw 0 to 3.5 over
// 3510-3570, `config/heroMotion.ts`). The gallery is on screen from the last landing (3566) until the film spread's turn is vertical (3708): 142 frames.
// The turn itself is the last 30 frames of the shot: a quick turn from 3690 (36 frames) that lands on 3726, so that the film spread and its QR page are there for S20.
//
// The camera: a rest on the open view from 3480 to 3510 (30 frames), the pull back to the block view over the riffle (3510-3570: M 6.32 to 5.8, focus 32 to 36),
// then one straight push of 240 frames to the links view on 3810 (M 6.52, the window 18 px towards the right page, the focus racked to 28 over the first 60 frames,
// the key on 3630): the gallery and the film spread are read while the picture grows 12 percent, as S11-S13's did 4 percent a spread.
export const S19 = defineShot("S19", {
  camera: SHOT_KEYFRAMES.S19,
  // guide 08: `riffle` (short) and the `paper-settle` on the beat after the last landing; the turn of the film spread has a `page-turn` of its own on its start frame
  cues: [
    { frame: 3510, name: "riffle" },
    { frame: 3570, name: "paper-settle" },
    { frame: 3690, name: "page-turn" },
  ],
});
