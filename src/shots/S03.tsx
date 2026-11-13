import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S03 - Pile hold: the spines read. The camera is the hold authored in Patch 05 (its last key, on frame 960, is the state S04 starts from); Patch 14 adds the rest (cues). Frames come from the SHOTS table.
export const S03 = defineShot("S03", { camera: SHOT_KEYFRAMES.S03 });
