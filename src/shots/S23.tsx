import { SHOT_KEYFRAMES } from "../config/camera";
import { LABELS, labelFrame } from "../config/labels";
import { BOOK_IDS } from "../config/books";
import { Labels } from "../fx/Labels";
import { defineShot } from "./define";

// S23 - Riser reveal: the four books, marked (Patch 19). The camera is settled beside the riser on 4380 and pushes in 5.9 percent to 4800 (`config/camera.ts`); the four
// books stand on the riser from 4200 (the ledger); the labels are `fx/Labels.tsx` (every number in `config/labels.ts`, every word from `getRiserLabel`): one a bar after the
// other (4380, 4440, 4500, 4560), each with a soft highlight sweep over its book, and they fade out over the last second so S24 starts on a clean picture.
export const S23 = defineShot("S23", {
  camera: SHOT_KEYFRAMES.S23,
  overlay: Labels,
  // guide 08: "4380, 4440, 4500, 4560 soft label ticks (one per book)": on the frame each label arrives on
  cues: BOOK_IDS.map((id) => ({ frame: labelFrame(id), name: "label-tick" })).filter((c) => c.frame >= LABELS.first),
});
