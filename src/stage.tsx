import React from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { HEIGHT, WIDTH } from "./config/timeline";
import { PLATE_MATCH, plateCameraRig, plateTransform, type PlateMatch, type PlateView } from "./plate/PlateFollow";
import { Plate } from "./plate/Plate";
import { Pillarbox } from "./plate/Pillarbox";
import { CameraSpace, MatchCamera } from "./plate/MatchCamera";

/**
 * The one 3D canvas of the film: renderer settings fixed here for every composition (guide 02, "Colour pipeline"):
 * no tone mapping, sRGB output, opaque black background. Later patches add the camera rig, lights, books and effects as children.
 *
 * The camera is the MATCH camera (Patch 03): the desk plane y = 0 lies on the plate's desk strip, and `view` is a window of its
 * sensor. Children are in WORLD space (cm; the desk front edge at the pile centre is the origin, the desk runs away along -Z), so a
 * box at (0, 1, -16) stands on the pile anchor at every view. The plate card and the pillarbox are in camera space.
 */
export const Stage: React.FC<{ view: PlateView; feather?: number; match?: PlateMatch; children?: React.ReactNode }> = ({ view, feather, match = PLATE_MATCH, children }) => {
  const transform = plateTransform(view, match);
  // a stable options object: R3F builds a new camera whenever it changes, so it is made once per match (the real pose is set by <MatchCamera> every frame)
  const camera = React.useMemo(() => {
    const rig = plateCameraRig({ M: 1, cx: 0, cy: 0 }, match);
    return { fov: rig.fovDeg, aspect: rig.aspect, near: 1, far: 5000, position: rig.position, rotation: [rig.rotationX, 0, 0] as [number, number, number] };
  }, [match]);
  return (
    <ThreeCanvas
      width={WIDTH}
      height={HEIGHT}
      flat
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
      camera={camera}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        scene.background = new THREE.Color("#000000");
      }}
    >
      <MatchCamera view={view} match={match} />
      <CameraSpace match={match}>
        <Plate view={view} match={match} transform={transform} />
        <Pillarbox transform={transform} feather={feather} />
      </CameraSpace>
      {children}
    </ThreeCanvas>
  );
};
