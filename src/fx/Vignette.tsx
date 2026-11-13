import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { VIGNETTE } from "../config/fx";
import { vignetteBackground } from "./vignetteField";

/**
 * THE VIGNETTE (Patch 13B, a placeholder tuned in Patch 22): a soft radial darkening towards the corners, a warm black (`VIGNETTE` in
 * src/config/fx.ts says how much and where it starts), nothing in the middle of the frame. One static gradient, so it is the same on every frame; no blend mode and no
 * `backdrop-filter` (guide 02, determinism rule 9). `on` false draws nothing at all: the component returns null.
 */
export const Vignette: React.FC<{ on?: boolean; strength?: number }> = ({ on = true, strength = VIGNETTE.strength }) => {
  const background = useMemo(() => vignetteBackground({ strength }), [strength]);
  if (!on || !(strength > 0)) return null;
  return <AbsoluteFill style={{ background, pointerEvents: "none" }} />;
};
