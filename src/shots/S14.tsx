import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S14 - Close the book (Patch 17). The book is the ledger's (`BOOK_SCRIPT`, `book/rig/*`): the pages flip back to the front in two quick
// chunks on frames 2760 and 2772 (the block ends on 0 sheets turned, D-70), the front board swings shut from frame 2820 and lands on 2870
// (50 frames for the speed of 1.4 and the book's 560 g, `closeFrames`; the 6-frame air puff of guide 06 is the board's rebound after the
// landing, `settle`: about 0.4 degrees at most, gone by 2880; the dust takes the close's puff on 2870, `dustSources`), and the book is held
// closed for the 10 frames before the carry of S15 starts on 2880.
// The held book's hand-held pose goes back to the reading pose over the shot (`config/heroMotion.ts`: pitch and yaw back to 0 by 2880),
// so the carry starts from where `setDownPoseAt` expects it. This file gives the camera and the cues, and places nothing.
//
// The camera is the first half of one glide from the links view (frame 2760, S13's key) to the pile view (frame 3000, S15's closing key):
// the pull back "to the whole closing book" (guide 05 section 4). The one key of this shot is on frame 2820, where the ease-in ends and
// the lens has racked from 28 to 38 (the table's focus for S14, f/2.8): it happens as the board starts to swing, under the closing cover.
export const S14 = defineShot("S14", {
  camera: SHOT_KEYFRAMES.S14,
  // guide 08's cue sheet puts `cover-close` on 2820 (the board starts to swing). The two chunks of the flip back are a short riffle: the
  // same foley as S10's, much quieter (the sheet lists none for them; Patch 21 sets its level). Both cues are on the picture's frame, as
  // those of every shot before this one are: the audio patch applies the lead of one or two frames (guide 08 section 2).
  cues: [
    { frame: 2760, name: "riffle" },
    { frame: 2820, name: "cover-close" },
  ],
});
