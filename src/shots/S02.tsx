import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S02 - Approach B: the pile resolves, focus pull. The camera is the lean-in authored in Patch 05; Patch 14 adds the rest (cues). Frames come from the SHOTS table.
export const S02 = defineShot("S02", { camera: SHOT_KEYFRAMES.S02 });
