import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S15 - Set down and settle (Patch 17). The carry is the ledger's: on frame 2880 Mini Me leaves the hand (the sway fades out, the book is
// carried to the left of the pile, turned flat and lowered, `book/rig/setDown.ts`), touches the desk on frame 2940 (beat 98, the middle of
// the shot: a carry of 60 frames, which for the book's 560 g is a speed of 1.48, see `BOOK_SCRIPT`) and has settled by 2952 (the rebound of
// 0.3 mm by the spring `settle`, 4 to 6 frames). While it comes down the contact patch under it tightens (`contactLook` in
// `config/lights.ts`, drawn by `ContactDecal`): it is not there while the book is high, faint and wide as it nears the desk and the tight
// dark line at the touch. From 2880 the ledger has MiniLocker as the top book of the pile.
//
// The camera is the second half of the glide that S14 starts (`VIEW_SET`): M 5.29 on 2880 to 4.63 on 3000, the window sliding to the pile
// hold's, focus 38 to 40. Keys: 2910 (the ease-out starts, regime "R3/2") and the closing key on 3000, the state S16 starts from, with the
// ease and regime of the lift of S04 (`signature`, R3). The plate comes back as a pure dolly: no key changes the plate, the book
// leaving the frame is the only cover, and the audit's POP check holds every frame.
export const S15 = defineShot("S15", {
  camera: SHOT_KEYFRAMES.S15,
  // `book-set` is the one cue that leads the picture here: the touch is on 2940 and the sound starts two frames before it, as the spec of the
  // patch says (the guide's sheet lists it on 2940, the visual event; Patch 21 must not lead it a second time)
  cues: [{ frame: 2938, name: "book-set" }],
});
