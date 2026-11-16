import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S18 - Book 2: open (Patch 18). The cover opens on frame 3360 (`BOOK_SCRIPT`: speed 1.3, the board swings 41 frames, the spring has settled by 3419) straight
// onto the title spread: MiniLocker's page list starts with the colophon (left, page 0) and the title page (right, page 1), there is no endpaper page and no
// half-title, so there is no turn in this shot ("straight to the title page", guide 01). The reading tilt of the held book (pitch -10) takes the 90 frames from
// 3360 to 3450 (`config/heroMotion.ts`). The title spread is on screen from the frame the board passes vertical until the first sheet of the riffle covers the right
// page (3510 + 12), more than the 120 frames guide 07 asks for.
//
// The camera: its one key is on frame 3360 (the hero view, the state S17 ends in); from it one `signature` ease takes the window 20 photo px to the left, towards the
// middle of the open spread, to the open view on 3480 (the key of S19) with the reading lens (focus 32, f/2.8), as S06's.
export const S18 = defineShot("S18", {
  camera: SHOT_KEYFRAMES.S18,
  cues: [{ frame: 3360, name: "cover-open" }],
});
