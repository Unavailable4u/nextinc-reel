import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S08 - Page turn 2: abstract and figure (Patch 15). The second sheet is turned on frame 1680; the spread is the abstract on the left (page 4,
// "Abstract." and a paragraph) and Fig. 1 with its caption on the right (page 5). "Abstract." and the caption are on screen from about frame 1710
// to the end of the film's reading hold (the next turn is Patch 16's, frame 1920 on), so they are shown for hundreds of frames.
//
// No camera key of its own: the straight run from S07's key to S09's closing key goes through the shot.
export const S08 = defineShot("S08", {
  camera: SHOT_KEYFRAMES.S08,
  cues: [{ frame: 1680, name: "page-turn" }],
});
