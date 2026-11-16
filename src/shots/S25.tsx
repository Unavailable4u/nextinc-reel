import type { FC } from "react";
import { SHOT_KEYFRAMES } from "../config/camera";
import { Wordmark } from "../fx/Wordmark";
import { FadeOut } from "../fx/FadeOut";
import { defineShot } from "./define";

// S25 - End hold and fade to black (Patch 20). The card of S24 is finished and held for 1.5 s (5280-5369), then black comes over everything the shot draws over 0.5 s (5370-5399, the last frame black:
// `fx/FadeOut.tsx`, `END` in `config/wordmark.ts`). The camera is S24's line carried on (`config/camera.ts`): the table's "hold with micro-drift", M 4.09 to 4.12, no change of lens.
const EndCard: FC = () => (
  <>
    <Wordmark />
    <FadeOut />
  </>
);

export const S25 = defineShot("S25", {
  camera: SHOT_KEYFRAMES.S25,
  overlay: EndCard,
  // guide 08: "5280-5399 everything fades to silence over the last 1 s" (the last second is 5340-5399; the picture's fade is the last half of it)
  cues: [{ frame: 5340, name: "room-tone-fade" }],
});
