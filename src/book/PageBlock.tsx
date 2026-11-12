import React, { useEffect, useMemo } from "react";
import type * as THREE from "three";
import type { BookSpec } from "../config/books";
import { blockSlabGeometry } from "./geometry";

export type PageBlockProps = {
  spec: BookSpec;
  /** the slab's lower and upper face, y in the book's closed frame */
  yLo: number;
  yHi: number;
  /** how much of the bow each face takes (0 to 1); the face that meets the other stack, or the free face, takes 1 */
  bowLo: number;
  bowHi: number;
  /** the bow's depth in cm (`bowAmplitude` of the split, so both stacks use the same value) */
  bowAmp?: number;
  /** the six materials of a slab, in the order of its faces (`BookMaterials.slab`) */
  material: THREE.Material[];
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/**
 * One stack of the page block: a slab with a rounded back, a slight bow and an uneven fore-edge (guide 03 section 6). The geometry is
 * seeded by the book, so the same book always gives the same vertices. Its faces take the paper and edge materials of `bookMaterials` (the
 * fore-edge's fine lines, the yellowing and the head's dye); Patch 10 puts the sheets on the top.
 */
export const PageBlock: React.FC<PageBlockProps> = ({ spec, yLo, yHi, bowLo, bowHi, bowAmp, material, castShadow = true, receiveShadow = true }) => {
  const geo = useMemo(() => blockSlabGeometry(spec, { yLo, yHi, bowLo, bowHi, bowAmp }), [spec, yLo, yHi, bowLo, bowHi, bowAmp]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} material={material} castShadow={castShadow} receiveShadow={receiveShadow} />
  );
};
