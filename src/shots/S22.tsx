import { SHOT_KEYFRAMES } from "../config/camera";
import { ChairWipe } from "../fx/ChairWipe";
import { defineShot } from "./define";

// S22 - Pull back and truck right (chair wipe) (Patch 19). The camera pulls back from the pile (M 4.63 to 2.46) and slides right along the desk past the keyboard; the
// chair back fills the frame from 4134 to 4206 and under it the set is swapped (the ledger's row 4140-4199: the pile and the two books beside it go, the riser arrives
// with Immersive, the other three books are on it from 4200); the camera rests under the wipe (4170) and settles beside the riser on 4380 (S23). The keys are
// `config/camera.ts`, the chair is `config/chairWipe.ts` and `fx/ChairWipe.tsx`. The camera of the second half is the table's "slide + settle".
export const S22 = defineShot("S22", {
  camera: SHOT_KEYFRAMES.S22,
  overlay: ChairWipe,
  // guide 08: "4140-4200 cloth rustle (the chair passes), low sweep". The picture's event is the frame the chair has filled the frame; Patch 21 leads the sound.
  cues: [{ frame: 4140, name: "chair-pass" }],
});
