import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { BookSpec } from "../config/books";
import { ribbonGeometry } from "./geometry";

export type RibbonProps = {
  spec: BookSpec;
  /** the surface the ribbon lies on: the top of the right stack, y */
  yTop: number;
  /** the tail's sideways swing, -1 to 1 */
  swing?: number;
  /** how far the tail droops, 0 to 1 */
  sag?: number;
  castShadow?: boolean;
};

/**
 * The ribbon marker: a flat strip 0.6 cm wide that lies in the gutter of the right stack and leaves past the tail edge as a
 * 3 cm tail with a seeded kink. `swing` and `sag` are the inputs for the ribbon's secondary motion. Drawn double sided.
 */
export const Ribbon: React.FC<RibbonProps> = ({ spec, yTop, swing = 0, sag = 0.25, castShadow = true }) => {
  const geo = useMemo(() => ribbonGeometry(spec, { yTop, swing, sag }), [spec, yTop, swing, sag]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} castShadow={castShadow}>
      <meshStandardMaterial color={spec.colors.ribbon} roughness={0.55} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
};
