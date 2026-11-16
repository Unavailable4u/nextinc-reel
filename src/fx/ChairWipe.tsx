import React from "react";
import { useCurrentFrame } from "remotion";
import { CHAIR_WIPE, chairAlpha, chairBandAt, chairColour, chairSeams } from "../config/chairWipe";

const STOP_PX = 30;

/**
 * THE CHAIR WIPE (Patch 19): the overlay of S22. A band of dark, soft leather that covers the whole frame from 4134 to 4206 so the set can be swapped (4140-4199)
 * without a frame showing it. Everything is `config/chairWipe.ts`: the alpha of every column, its colour and the seams are the functions the test measures. One
 * full-frame gradient (a stop every 30 px) and a few seams; plain alpha, no blend mode, no filter, nothing that moves except through the frame number.
 */
export const ChairWipe: React.FC = () => {
  const frame = useCurrentFrame();
  if (!chairBandAt(frame)) return null;
  const stops: string[] = [];
  for (let x = 0; x <= CHAIR_WIPE.width; x += STOP_PX) {
    const [r, g, b] = chairColour(frame, x);
    stops.push(`rgba(${r},${g},${b},${chairAlpha(frame, x).toFixed(4)}) ${x}px`);
  }
  const [r, g, b] = chairColour(frame, CHAIR_WIPE.width);
  stops.push(`rgba(${r},${g},${b},${chairAlpha(frame, CHAIR_WIPE.width).toFixed(4)}) ${CHAIR_WIPE.width}px`);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: CHAIR_WIPE.width, height: CHAIR_WIPE.height, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${stops.join(", ")})` }} />
      {chairSeams(frame).map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 0,
            height: CHAIR_WIPE.height,
            left: s.x - CHAIR_WIPE.seamWidth / 2,
            width: CHAIR_WIPE.seamWidth,
            opacity: s.opacity,
            background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.9) 50%, rgba(0,0,0,0))",
          }}
        />
      ))}
    </div>
  );
};
