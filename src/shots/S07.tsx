import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S07 - Page turn 1: the title page (Patch 15). The first sheet (the half-title) is turned on frame 1560 for 54 frames (`BOOK_SCRIPT`, the
// sheet is `book/Sheet.tsx`, the physics is guide 06): it lifts at the fore-edge corner, bends, passes vertical lit from behind by the
// lamp, and lands. The spread then is the back of the half-title (blank) on the left and the title page on the right (pages 2 and 3).
// The title page is readable from the turn passing vertical (about frame 1590) to the next turn passing vertical (about frame 1710),
// 120 frames, which is the must-read rule's minimum, and not a frame shorter: `tests/acts3to4a.test.ts` holds it.
//
// The camera: the one key is the open view on frame 1560; from it the camera runs straight on to S09's closing key on frame 1920 at constant
// speed (a slow push and drift, no stop), so the pages are read from a camera that is never still.
export const S07 = defineShot("S07", {
  camera: SHOT_KEYFRAMES.S07,
  cues: [{ frame: 1560, name: "page-turn" }],
});
