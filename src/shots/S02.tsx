import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S02 - Approach B: the pile resolves, focus pull. The camera is the lean-in authored in Patch 05; The focus pull and the lean-in are in the keyframes and in `src/camera/operator.ts`; the cue is below (Patch 14). Frames come from the SHOTS table.
export const S02 = defineShot("S02", {
  camera: SHOT_KEYFRAMES.S02,
  // guide 01, Act 1: "a quiet breath-like pause at the arrival"
  cues: [{ frame: 480, name: "arrival-breath" }],
});
