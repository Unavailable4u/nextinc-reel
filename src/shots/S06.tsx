import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S06 - Open the cover (Patch 15). The front board opens about 165 degrees on its spine hinge with a damped overshoot: the book's move is
// `BOOK_SCRIPT` in `config/ledger.ts` (open on frame 1440; the rig is `book/rig/cover.ts`) and the reading tilt, the book's pitch going
// from 80 to 70 degrees over frames 1440-1560, is `config/heroMotion.ts`. The inside shows the endpaper (page 0, P-END) on the left board and
// the half-title (page 1, P-HALF) on the right: `Pile` draws them from the painted pages of Mini Me (texture load and release by act).
//
// The camera: its one key is the hero view on frame 1440 (the state S05 ends in), and the segment from it to S07's key on frame 1560 is one
// `signature` ease: the window slides 20 photo px to the open book's middle (3.5 cm/s on average, 10 cm/s at the peak: the R3 limit) while the
// cover swings, and the lens goes from the lift's (focus 30, f/2) to the reading lens (focus 32, f/2.8).
export const S06 = defineShot("S06", {
  camera: SHOT_KEYFRAMES.S06,
  // guide 08, cue sheet: `cover-open` on frame 1440 (the sound file starts a frame or two earlier, the audio patch's job)
  cues: [{ frame: 1440, name: "cover-open" }],
});
