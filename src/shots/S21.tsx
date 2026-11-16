import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S21 - Book 2: close and set down (Patch 18). Everything overlaps, the way a hand that knows the book does it (the book's moves are 30 percent faster): the pages go back
// to the front as one quick chunk from 3816 (S20's last frames) (it lands on 3852, the 49 sheets and 2 leaves of the script), the carry starts on 3840 (the first frame beside the pile, the
// ledger's), the board starts to swing on 3846 as the chunk lands and lands on 3884 (38 frames), and the book touches the desk beside Mini Me on frame 3900 (beat 130) after a
// carry of 60 frames, with the rebound of 0.3 mm done by 3912. Two books now lie beside a pile of one: the ledger has MiniLocker "beside" from 3840 and SPHEREx alone in the pile.
//
// The camera is the glide that S20's key starts: 60 frames of ease-in (3810-3870), a straight run to 3900 and 60 of ease-out to the pile view on 3960 (M 4.63, focus 40), the
// state S22 starts from. The keys are 3870 and 3900 (regime R3/2 from 3900: the plate comes back) and the closing key on 3960.
export const S21 = defineShot("S21", {
  camera: SHOT_KEYFRAMES.S21,
  // guide 08: `cover-close` 3870 and `book-set` 3900. Here the cover-close cue is the start of the board's swing (3846, as S14's is 2820), off the beat because the page-back chunk
  // may not start before 3816 (the QR hold, see S20). `book-set` is two frames before the touch, as S15's: Patch 21 must not lead it again.
  cues: [
    { frame: 3846, name: "cover-close" },
    { frame: 3898, name: "book-set" },
  ],
});
