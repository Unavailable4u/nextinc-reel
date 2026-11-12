import React from "react";
import { useCurrentFrame } from "remotion";
import type { CameraKeyframe } from "../config/camera";
import { PLATE_MATCH, type PlateMatch } from "../plate/PlateFollow";
import { Stage } from "../stage";
import { cameraAt } from "./path";

/**
 * THE CAMERA RIG (Patch 05): the one place where the camera path meets the 3D scene. For the current frame it asks `cameraAt` (keyframes
 * + operator model + margin rule, src/camera/path.ts) where the camera is, and hands the answer to `Stage`: the view (M and the photo
 * pixel at the centre of the frame), the roll, and the lens that defocuses the plate. Children are the scene, in world space exactly as
 * in `Stage` (cm, origin at the desk's front edge at the pile centre); they ride the same camera as the plate, so a box on the desk stays
 * on the desk at every zoom, slide, tilt and roll.
 *
 * It holds no state and reads no clock: the frame comes from Remotion and everything else is a pure function of it (determinism rule).
 * `frame` is only for the dev tools, which draw a frame other than the current one. `operator={false}` shows the authored path alone.
 *
 * The camera at frame 0 is the opening view (M 1.25, the whole plate, centred, f/8 on the pile), which draws no blur, so frame 0 is the
 * bare photo that `npm run plate:verify` compares.
 */
export const CameraRig: React.FC<{
  feather?: number;
  match?: PlateMatch;
  keys?: readonly CameraKeyframe[];
  operator?: boolean;
  frame?: number;
  children?: React.ReactNode;
}> = ({ feather, match = PLATE_MATCH, keys, operator, frame, children }) => {
  const current = useCurrentFrame();
  const cam = cameraAt(frame ?? current, { keys, match, operator });
  return (
    <Stage view={cam.view} rollDeg={cam.rollDeg} lens={cam.lens} feather={feather} match={match}>
      {children}
    </Stage>
  );
};
