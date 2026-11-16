import { SHOT_KEYFRAMES } from "../config/camera";
import { defineShot } from "./define";

// S20 - Book 2: film spread and QR (Patch 18). The film page (the film's poster in its frame with the play mark, `2:50`, the caption and the "Interactive edition" tag; it
// does not play, D-72) on the left and the links page on the right, with the two QR codes (the repo and the film, from the data). The turn that brought it lands on 3726
// (S19 starts it on 3690); the QR page is uncovered from about 3708 and nothing crosses it until the page-back sheet of S21 is vertical on 3834. The whole shot is a
// steady range (`MOTION.steady`, `STEADY_RANGES`): the hand's sway of the book and the camera's breathing and tremor are off from 3708 to 3851 (the blends), the book is
// square-on within 4 degrees (pitch +7, yaw 3.5) and does not move from 3570 to 3816, so the hold is 3726-3834 for the page and 3720-3839 for the camera.
//
// The camera has one key, on frame 3810: the end of the push of S19 (M 6.52, focus 28, f/2.8), the state the glide of S21 starts from. The glide's ease-in (60 frames)
// has changed M by under 2 percent when the page is covered.
export const S20 = defineShot("S20", {
  camera: SHOT_KEYFRAMES.S20,
  // the page-back chunk of S21's close starts on 3816, the last 24 frames of this shot: the same quiet `riffle` as S14's, off the beat because the QR page may be covered only after 3830
  cues: [{ frame: 3816, name: "riffle" }],
});
