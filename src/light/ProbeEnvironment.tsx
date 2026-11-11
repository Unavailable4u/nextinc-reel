import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { staticFile } from "remotion";
import { LIGHTS } from "../config/lights";
import { PROBE_FILE, buildProbeCube, type Rgba8 } from "./PlateProbe";

/** The probe PNG's pixels, read through a canvas (browser only). */
function readPixels(img: HTMLImageElement): Rgba8 {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("ProbeEnvironment: no 2D canvas context");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height };
}

/**
 * The environment for the glossy and foil materials: the blurred plate on the far face of a cube (PlateProbe.ts). It sets
 * `scene.environment`, so only materials that use an environment (the standard and physical ones) are affected; the plate card and
 * the decals are unlit and ignore it. The picture is `public/plates/derived/probe-front.png`; if it is missing, run `npm run probe`.
 * Child of <Stage>.
 */
export const ProbeEnvironment: React.FC<{ intensity?: number }> = ({ intensity = LIGHTS.probe.intensity }) => {
  const img = useLoader(THREE.ImageLoader, staticFile(PROBE_FILE));
  const scene = useThree((s) => s.scene);
  const cube = useMemo(() => buildProbeCube(readPixels(img)), [img]);
  useLayoutEffect(() => {
    scene.environment = cube;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
    };
  }, [scene, cube, intensity]);
  return null;
};
