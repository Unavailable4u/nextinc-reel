import React from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { HEIGHT, WIDTH } from "./config/timeline";
import { PLACEHOLDER_MATCH, plateTransform, type PlateMatch, type PlateView } from "./plate/PlateFollow";
import { Plate } from "./plate/Plate";
import { Pillarbox } from "./plate/Pillarbox";

/**
 * The one 3D canvas of the film: renderer settings fixed here for every composition (guide 02, "Colour pipeline"):
 * no tone mapping, sRGB output, opaque black background. Later patches add the camera rig, lights, books and effects as children.
 */
export const Stage: React.FC<{ view: PlateView; feather?: number; match?: PlateMatch; children?: React.ReactNode }> = ({ view, feather, match = PLACEHOLDER_MATCH, children }) => {
  const transform = plateTransform(view, match);
  return (
    <ThreeCanvas
      width={WIDTH}
      height={HEIGHT}
      flat
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={{ fov: match.fovDeg, near: 1, far: 5000, position: [0, 0, 0] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        scene.background = new THREE.Color("#000000");
      }}
    >
      <Plate view={view} match={match} transform={transform} />
      <Pillarbox transform={transform} feather={feather} />
      {children}
    </ThreeCanvas>
  );
};
