import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { PLATE_MATCH } from "../plate/PlateFollow";
import { Stage } from "../stage";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { ShadowCatcher } from "../plate/ShadowCatcher";
import { ObjectDefocus } from "../camera/ObjectDefocus";
import { objectsNeedDefocus } from "../camera/focus";
import { BENCH_FRAMES, SCENES, sceneDepthRange, sceneLens } from "./benchScenes";
import { PlaceholderPile } from "./PlaceholderPile";

/**
 * THE BENCHMARK COMPOSITION (Patch 04): 12 frames, each one a sample scene (src/dev/benchScenes.ts) with everything the real film
 * will switch on: key with soft shadow, rim, kicker, fill, catcher, contact decals, the probe, the plate's defocus and, when the lens
 * asks for it, the object blur. `npm run bench` renders these 12 frames and times each one.
 */
export const DevBench: React.FC = () => {
  const frame = useCurrentFrame();
  const sample = BENCH_FRAMES[Math.min(frame, BENCH_FRAMES.length - 1)];
  const scene = SCENES[sample.scene];
  const lens = sceneLens(scene, sample.t);
  const range = sceneDepthRange(scene);
  const needObjects = objectsNeedDefocus(lens, scene.view.M, range.near, range.far);
  return (
    <AbsoluteFill style={{ background: "#000" }} from={1}>
      <Stage view={scene.view} lens={lens} match={PLATE_MATCH}>
        <LightRig frame={frame} />
        <ProbeEnvironment />
        <ShadowCatcher />
        <PlaceholderPile boxes={scene.boxes} />
        {needObjects ? <ObjectDefocus lens={lens} M={scene.view.M} /> : null}
      </Stage>
    </AbsoluteFill>
  );
};
