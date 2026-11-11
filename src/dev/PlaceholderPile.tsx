import React from "react";
import { ContactDecal } from "../plate/ShadowCatcher";
import type { PlaceholderBox } from "./benchScenes";

/** The placeholder boxes of a scene, standing on the desk (world space; children of <Stage>). A box on the desk gets the contact decal. */
export const PlaceholderPile: React.FC<{ boxes: PlaceholderBox[]; contact?: boolean; shadows?: boolean }> = ({ boxes, contact = true, shadows = true }) => (
  <>
    {boxes.map((b, i) => (
      <React.Fragment key={i}>
        <mesh position={[b.X, b.lift + b.h / 2, -b.Zd]} rotation={[0, (b.yawDeg * Math.PI) / 180, 0]} castShadow={shadows} receiveShadow={shadows}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          {b.glossy ? <meshPhysicalMaterial color={b.color} roughness={0.35} metalness={0.1} clearcoat={0.6} clearcoatRoughness={0.25} /> : <meshStandardMaterial color={b.color} roughness={0.7} metalness={0} />}
        </mesh>
        {contact && b.lift === 0 ? <ContactDecal X={b.X} Zd={b.Zd} w={b.w} d={b.d} yawDeg={b.yawDeg} /> : null}
      </React.Fragment>
    ))}
  </>
);
