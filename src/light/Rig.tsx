import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { LIGHTS, deskToWorld, keyShimmer, lampWorld, type LightName } from "../config/lights";
import { PLATE_MATCH, type PlateMatch } from "../plate/PlateFollow";

/** A thin area light that faces a point (an area light has no target, so it is aimed once, when it mounts). */
const AimedRectLight: React.FC<{ color: string; intensity: number; width: number; height: number; position: [number, number, number]; aim: [number, number, number] }> = ({ color, intensity, width, height, position, aim }) => {
  const ref = useRef<THREE.RectAreaLight>(null);
  useLayoutEffect(() => {
    ref.current?.lookAt(aim[0], aim[1], aim[2]);
  }, [aim[0], aim[1], aim[2]]);
  return <rectAreaLight ref={ref} color={color} intensity={intensity} width={width} height={height} position={position} />;
};

export type LightRigProps = {
  /** the frame, for the lamp's shimmer (a pure function of it) */
  frame?: number;
  /** which lights are on; all are on by default */
  on?: Partial<Record<LightName, boolean>>;
  /** the lamp casts a soft shadow (default on) */
  shadows?: boolean;
  match?: PlateMatch;
};

/**
 * THE LIGHTS (guide 03 section 2), all motivated by something in the plate and all read from `config/lights.ts`:
 *   key    the desk lamp, a warm point light at the bulb (its place follows the match), inverse-square, soft shadow
 *   rim    the amber LED strip behind the desk, a thin area light facing the pile
 *   kicker the under-desk LED, a low warm point in front of the pile
 *   fill   a cool hemisphere light, about 8% of the key
 * The environment probe (glossy and foil materials) is a separate component: <ProbeEnvironment />.
 * Children of <Stage>; world space (cm). Tone mapping stays off (the Stage sets that).
 */
export const LightRig: React.FC<LightRigProps> = ({ frame = 0, on = {}, shadows = true, match = PLATE_MATCH }) => {
  useMemo(() => RectAreaLightUniformsLib.init(), []);
  const lit = (n: LightName): boolean => on[n] ?? true;
  const k = LIGHTS.key;
  const lamp = lampWorld(match);
  const r = LIGHTS.rim;
  const kick = LIGHTS.kicker;
  return (
    <>
      {lit("key") ? (
        <pointLight
          color={k.color}
          intensity={k.intensityCd * keyShimmer(frame)}
          decay={k.decay}
          distance={0}
          position={lamp}
          castShadow={shadows}
          shadow-mapSize-width={k.shadow.mapSize}
          shadow-mapSize-height={k.shadow.mapSize}
          shadow-radius={k.shadow.radius}
          shadow-bias={k.shadow.bias}
          shadow-normalBias={k.shadow.normalBias}
          shadow-camera-near={k.shadow.near}
          shadow-camera-far={k.shadow.far}
        />
      ) : null}
      {lit("rim") ? (
        <AimedRectLight
          color={r.color}
          intensity={r.intensityNits}
          width={r.widthCm}
          height={r.heightCm}
          position={deskToWorld(r.at.X, r.at.Y, r.at.Zd)}
          aim={deskToWorld(r.aim.X, r.aim.Y, r.aim.Zd)}
        />
      ) : null}
      {lit("kicker") ? <pointLight color={kick.color} intensity={kick.intensityCd} decay={kick.decay} distance={0} position={deskToWorld(kick.at.X, kick.at.Y, kick.at.Zd)} /> : null}
      {lit("fill") ? <hemisphereLight color={LIGHTS.fill.color} groundColor={LIGHTS.fill.color} intensity={LIGHTS.fill.intensity} /> : null}
    </>
  );
};
