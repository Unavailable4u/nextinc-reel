import { defineShot } from "./define";

// S12 - Film spread: promo thumbnail with a play mark (Patch 16). The turn of frame 2280 (54 frames, the full turn animation, the third turn
// of Mini Me's script) lands on the spread of pages 8 and 9: a gallery page on the left and the film page on the right (the thumbnail in its
// frame with the play mark, the duration, a one-line caption and the "Interactive edition" tag, all painted by `paint/pages`). The film NEVER
// plays: nothing in the scene is animated on the page, and a test holds it (`tests/acts4.test.ts`). No camera key: the straight push of
// S11 goes through this shot.
export const S12 = defineShot("S12", {
  camera: [],
  cues: [{ frame: 2280, name: "page-turn" }],
});
