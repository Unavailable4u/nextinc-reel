import { SHOT_KEYFRAMES, VIEW_LIFT } from "../config/camera";
import { defineShot } from "./define";

// S04 - Lift: the top book rises and turns to us (R3). The book's own moves (the press, the slide, the rise, the turn, the sway) are the
// ledger's: `BOOK_SCRIPT` lifts MiniMe on frame 960 and `getBookPose` is its one source, so this file gives only the camera and the cues.
//
// The camera is one key, on frame 1080 (the closing key on the first frame of S05, the state S05 starts from, D-51). The segment from
// S03's closing key on frame 960 to it is the R2 to R3 handover: one dolly toward the pile from M 4.63 to `VIEW_LIFT.M`, with the pan of the
// pile hold, so the plate does not slide behind the book, and the focus pulls from the pile (36) to the book (30) and opens to f/2.
// Above M 5 the plate is in the bokeh band and the lens gives it at least 25 px of blur (the audit's DEEP check holds every frame to it).
// The key's ease is the one S05's glide starts with (`signatureIn`: it leaves the key from rest and runs on into a straight line, Patch 15).
// The operator's reach (a dip from frame 990, let go on 1050) and the lean-in of frames 960-1080 are in
// `src/camera/operator.ts`.
const last = SHOT_KEYFRAMES.S03[SHOT_KEYFRAMES.S03.length - 1];

export const S04 = defineShot("S04", {
  camera: [{ ...last, frame: 1080, M: VIEW_LIFT.M, focusCm: VIEW_LIFT.focusCm, aperture: VIEW_LIFT.aperture, ease: "signatureIn", regime: "R3" }],
  // guide 01, Act 2: "soft thud of the cover board lifting off the stack, cloth on cloth, a held breath"
  cues: [
    { frame: 960, name: "cover-board-thud" },
    { frame: 990, name: "cloth-on-cloth" },
    { frame: 1050, name: "breath-held" },
  ],
});
