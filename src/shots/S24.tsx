import { SHOT_KEYFRAMES } from "../config/camera";
import { DIM } from "../config/dim";
import { WORDMARK } from "../config/wordmark";
import { Wordmark } from "../fx/Wordmark";
import { defineShot } from "./define";

// S24 - Room dims, wordmark and tagline (Patch 20). From 4800 the room goes down 1.5 stops over 2 s (the global `fx/Dim.tsx` and the lights of `light/Rig.tsx`, both from `config/dim.ts`: the lamp falls and
// warms, the strips keep the books lit); the camera carries on from the riser view, slower, to M 4.09 at f/2.8 on 5280 (`config/camera.ts`); the overlay is the wordmark (`fx/Wordmark.tsx`, every number in
// `config/wordmark.ts`, every word from `getCompany()`): the site's crimson italic x stroked on from 4860, the letters risen into place by 5012, the tagline on 5040, the address on 5100.
export const S24 = defineShot("S24", {
  camera: SHOT_KEYFRAMES.S24,
  overlay: Wordmark,
  // guide 08: "4800-5000 the lamp's warmth falls: a low swell" (the dim's first frame) and "4860 wordmark: one soft, round tone" (the x's first frame)
  cues: [
    { frame: DIM.from, name: "lamp-swell" },
    { frame: WORDMARK.stroke.from, name: "wordmark-tone" },
  ],
});
