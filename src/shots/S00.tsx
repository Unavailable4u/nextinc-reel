import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S00 - Plate: the desk, untouched. The camera is the opening hold authored in Patch 05; Patch 14 adds the rest (dust, cues). Frames come from the SHOTS table.
export const S00 = defineShot("S00", { camera: SHOT_KEYFRAMES.S00 });
