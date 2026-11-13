import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "../config/timeline";
import { GRAIN } from "../config/fx";
import { grainOffset, grainTile } from "./grainField";

const GrainCanvas: React.FC<{ seed: number; amount: number }> = ({ seed, amount }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const n = GRAIN.tilePx;
    const tile = document.createElement("canvas");
    tile.width = n;
    tile.height = n;
    const t = tile.getContext("2d");
    if (!t) return;
    t.putImageData(new ImageData(grainTile(frame, { seed, amount }), n, n), 0, 0);
    const pattern = g.createPattern(tile, "repeat");
    if (!pattern) return;
    const off = grainOffset(frame, seed);
    g.clearRect(0, 0, WIDTH, HEIGHT);
    g.save();
    // the tile is shifted by a different whole number of pixels on every frame, so no grain pixel sits in the same place twice in a row
    g.translate(-off.x, -off.y);
    g.fillStyle = pattern;
    g.fillRect(off.x, off.y, WIDTH, HEIGHT);
    g.restore();
  }, [frame, seed, amount]);
  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, pointerEvents: "none" }} />;
};

/**
 * THE GRAIN (Patch 13B, a placeholder tuned in Patch 22): faint monochrome grain over the whole frame. Every pixel is a pure function of
 * the frame number and `seed` (src/fx/grainField.ts, which draws from src/lib/prng.ts); no clock, no `Math.random()`. Plain alpha blending,
 * no blend mode. `on` false draws nothing at all: the component returns null, so no canvas is made.
 */
export const Grain: React.FC<{ on?: boolean; seed?: number; amount?: number }> = ({ on = true, seed = GRAIN.seed, amount = GRAIN.amount }) => {
  if (!on || !(amount > 0)) return null;
  return <GrainCanvas seed={seed} amount={amount} />;
};
