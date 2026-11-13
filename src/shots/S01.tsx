import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S01 - Approach A: someone walks to the desk. The camera is the walk authored in Patch 05; The walking bob fades out over frames 440-480 in `src/camera/operator.ts`; the cues are below (Patch 14). Frames come from the SHOTS table.
export const S01 = defineShot("S01", {
  camera: SHOT_KEYFRAMES.S01,
  // guide 01, Act 1: no footsteps (the room is carpeted), only the cloth of the operator
  cues: [{ frame: 240, name: "cloth-rustle" }],
});
