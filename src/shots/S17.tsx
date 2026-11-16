import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S17 - Book 2: cover hero (Patch 18). MiniLocker in full view for 4 seconds: parchment cloth, the five blue foil arcs, `Mini` in ink and `Locker` in crimson.
// The book is held in front of the lens as Mini Me was; its orbit is `config/heroMotion.ts`: yaw 0 on 3124 (after the lift has settled on 3100), -8 on 3182,
// through 0 on 3240 (beat 108, the middle of the shot: the foil's specular sweep, `LIGHTS.probe.sweep`, flares there), +8 on 3298 and 0 again on 3356, four
// frames before the cover opens. Nothing here places the book.
//
// The camera is one glide from S16's closing key (frame 3120, M 6.0, the pile hold's window) to the hero view on 3360 (M 6.24, the window on the middle of the
// held book): 60 frames in, a straight run, 60 out, the keys on 3180 and 3300. The held book is the same size and in the same place as Mini Me's, so the
// views of Patch 15 are used as they are.
export const S17 = defineShot("S17", {
  camera: SHOT_KEYFRAMES.S17,
  // like S05, no sound of its own
  cues: [],
});
