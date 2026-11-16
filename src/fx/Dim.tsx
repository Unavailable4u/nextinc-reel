import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { dimAt, dimRgb } from "../config/dim";

/**
 * THE DIM (Patch 20, S24): the room goes down by 1.5 stops over 2 s from frame 4800 (`config/dim.ts` says how, and why the lamp and the strips are in `light/Rig.tsx`). The photograph is
 * unlit and cannot be relit, so its exposure is a gain on the finished picture: one warm-black layer over the whole canvas, its alpha a pure function of the frame. It sits above the
 * canvas and below the shots' overlays, so the wordmark and the labels are never dimmed, and below the grain and the vignette, which belong to the lens and not to the room.
 * Plain alpha, no blend mode and no filter (guide 02, determinism). Before frame 4800 the alpha is exactly 0 and the component returns null: no element at all, so the film before S24 is untouched.
 * `on` false draws nothing; `frame` is for the dev tools that draw a frame other than the current one.
 */
export const Dim: React.FC<{ on?: boolean; frame?: number }> = ({ on = true, frame }) => {
  const current = useCurrentFrame();
  const a = dimAt(frame ?? current).overlayAlpha;
  if (!on || !(a > 0)) return null;
  return <AbsoluteFill style={{ background: `rgba(${dimRgb()},${a.toFixed(4)})`, pointerEvents: "none" }} />;
};
