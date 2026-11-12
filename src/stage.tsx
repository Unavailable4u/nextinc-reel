import React from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { HEIGHT, WIDTH } from "./config/timeline";
import { PLATE_MATCH, plateCameraRig, plateTransform, type PlateMatch, type PlateView } from "./plate/PlateFollow";
import { Plate } from "./plate/Plate";
import { Pillarbox } from "./plate/Pillarbox";
import { CameraSpace, MatchCamera } from "./plate/MatchCamera";
import { plateBlurPx, type Lens } from "./camera/focus";

/**
 * The one 3D canvas of the film: renderer settings fixed here for every composition (guide 02, "Colour pipeline"):
 * no tone mapping, sRGB output, opaque black background. Later patches add the camera rig, lights, books and effects as children.
 *
 * The camera is the MATCH camera (Patch 03): the desk plane y = 0 lies on the plate's desk strip, and `view` is a window of its
 * sensor. Children are in WORLD space (cm; the desk front edge at the pile centre is the origin, the desk runs away along -Z), so a
 * box at (0, 1, -16) stands on the pile anchor at every view. The plate card and the pillarbox are in camera space.
 *
 * `rollDeg` (Patch 05) rolls the picture about the centre of the frame; the plate and everything on the desk roll together.
 *
 * `lens` (Patch 04) sets the plate's defocus: the larger of the thin lens and the magnification table (src/camera/focus.ts). Without
 * a lens the plate is not blurred at all, which is what the opening view and `npm run plate:verify` use. Shadow maps are enabled
 * (PCF, fixed size); they cost nothing until a light casts a shadow.
 */
export const Stage: React.FC<{ view: PlateView; feather?: number; match?: PlateMatch; lens?: Lens; rollDeg?: number; children?: React.ReactNode }> = ({ view, feather, match = PLATE_MATCH, lens, rollDeg = 0, children }) => {
  const transform = plateTransform(view, match);
  const blurPx = lens ? plateBlurPx(view.M, lens, match) : 0;
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
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFShadowMap;
        scene.background = new THREE.Color("#000000");
      }}
    >
      <MatchCamera view={view} match={match} rollDeg={rollDeg} />
      <CameraSpace match={match}>
        <Plate view={view} match={match} transform={transform} blurPx={blurPx} />
        <Pillarbox transform={transform} feather={feather} />
      </CameraSpace>
      {children}
    </ThreeCanvas>
  );
};
