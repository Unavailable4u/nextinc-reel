import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S01 - Approach A: someone walks to the desk. The camera is the walk authored in Patch 05; Patch 14 adds the rest (cues). Frames come from the SHOTS table.
export const S01 = defineShot("S01", { camera: SHOT_KEYFRAMES.S01 });
