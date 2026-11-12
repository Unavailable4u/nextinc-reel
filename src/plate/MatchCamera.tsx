import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { plateCameraRig, type PlateMatch, type PlateView } from "./PlateFollow";
import type { MatchCameraRig } from "./plateCamera";

/** Sets a three.js perspective camera from a rig: fov, aspect, pose and the window of the sensor that fills the frame. */
export function applyRig(camera: THREE.PerspectiveCamera, rig: MatchCameraRig): void {
  (camera as THREE.PerspectiveCamera & { manual?: boolean }).manual = true; // R3F must not reset the aspect to the canvas's
  camera.fov = rig.fovDeg;
  camera.aspect = rig.aspect;
  camera.position.set(...rig.position);
  camera.rotation.set(rig.rotationX, 0, rig.rotationZ);
  const v = rig.viewOffset;
  camera.setViewOffset(v.fullW, v.fullH, v.x, v.y, v.w, v.h);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

/**
 * Puts the scene camera on the match and cuts the view's window out of its sensor. It runs in a layout effect on every render, so it
 * is in place before Remotion advances the renderer for the frame. A pure function of the props: nothing here reads a clock.
 * `rollDeg` (Patch 05) rolls the camera about its optical axis; the plate card does not roll with it, so the plate and everything
 * standing on the desk roll together.
 */
export const MatchCamera: React.FC<{ view: PlateView; match: PlateMatch; rollDeg?: number }> = ({ view, match, rollDeg = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const rig = plateCameraRig(view, match, rollDeg);
  useLayoutEffect(() => {
    applyRig(camera, rig);
    invalidate();
  });
  return null;
};

/** A group that carries the camera's pose: whatever is inside is written in camera space (the camera at the origin looking down -Z). The plate card lives here. */
export const CameraSpace: React.FC<{ match: PlateMatch; children?: React.ReactNode }> = ({ match, children }) => {
  const rig = plateCameraRig({ M: 1, cx: 0, cy: 0 }, match);
  return (
    <group position={rig.position} rotation={[rig.rotationX, 0, 0]}>
      {children}
    </group>
  );
};
