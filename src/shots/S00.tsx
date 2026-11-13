import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S00 - Plate: the desk, untouched. The camera is the opening hold authored in Patch 05; the dust is the set's (`FilmSet`, drawn from frame 0) and the cues are below (Patch 14). Frames come from the SHOTS table.
export const S00 = defineShot("S00", {
  camera: SHOT_KEYFRAMES.S00,
  // guide 01, Act 0: room tone fades in over 1 s, a faint lamp hum, an optional clock-like tick on bar 2
  cues: [
    { frame: 0, name: "room-tone-in" },
    { frame: 0, name: "lamp-hum" },
    { frame: 120, name: "clock-tick" },
  ],
});
