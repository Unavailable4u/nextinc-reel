import React, { useMemo } from "react";
import * as THREE from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { staticFile } from "remotion";
import { PLATE_FILE } from "../config/plate";
import { plateTransform, type PlateMatch, type PlateTransform, type PlateView, PLATE_MATCH } from "./PlateFollow";

/**
 * The photograph as a flat card inside the 3D scene, exactly as supplied: an UNLIT basic material, toneMapped = false, sRGB,
 * mipmaps and anisotropy on. No filter, no tone curve, no colour change (plate rule). Must be inside <ThreeCanvas>, which holds
 * the render until the texture has loaded. Its position is in camera space, so it goes inside <CameraSpace> (see stage.tsx).
 */
export const Plate: React.FC<{ view: PlateView; match?: PlateMatch; transform?: PlateTransform }> = ({ view, match = PLATE_MATCH, transform }) => {
  const tex = useLoader(THREE.TextureLoader, staticFile(PLATE_FILE));
  const gl = useThree((s) => s.gl);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = gl.capabilities.getMaxAnisotropy();
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
  }, [tex, gl]);
  const t = transform ?? plateTransform(view, match);
  return (
    <mesh position={t.position} name="plate">
      <planeGeometry args={[t.width, t.height]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};
