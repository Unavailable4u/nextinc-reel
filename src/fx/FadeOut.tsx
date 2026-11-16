import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fadeAlpha } from "../config/wordmark";

/**
 * THE FADE TO BLACK (Patch 20, S25): black over everything the shot draws, 0 until frame 5370 and 1 on the last frame, 5399 (`END` in `config/wordmark.ts`). It is the top of S25's overlay, so
 * the wordmark goes with it; the global grain and vignette are drawn above it (they are the lens's, Patch 22's to tune), so the last frame is black with the grain on it, not a hard zero.
 * A pure function of the frame; returns null while the alpha is 0.
 */
export const FadeOut: React.FC = () => {
  const a = fadeAlpha(useCurrentFrame());
  if (!(a > 0)) return null;
  return <AbsoluteFill style={{ background: `rgba(0,0,0,${a.toFixed(4)})`, pointerEvents: "none" }} />;
};
