import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, Effect } from "postprocessing";
import { z } from "zod";
import { BAND_COLOR, magnificationBand, minBlurPx } from "../config/plate";
import { LIGHTS, keyIrradianceAt } from "../config/lights";
import { ZONES } from "../config/placement";
import { PLATE_MATCH, VIEW_FIT, type PlateView } from "../plate/PlateFollow";
import { Stage } from "../stage";
import { LightRig } from "../light/Rig";
import { ProbeEnvironment } from "../light/ProbeEnvironment";
import { ShadowCatcher } from "../plate/ShadowCatcher";
import { ObjectDefocusEffect } from "../camera/ObjectDefocus";
import { isBlurDrawn, matchFocalMm, objectsNeedDefocus, plateBlurPx, type Lens } from "../camera/focus";
import { SCENES, sceneDepthRange } from "./benchScenes";
import { PlaceholderPile } from "./PlaceholderPile";
import { loadFonts, stacks } from "../lib/fonts";

void loadFonts();

const PRESETS: Record<string, PlateView | null> = {
  free: null,
  "M1.25 whole plate": VIEW_FIT,
  "M2.46 end of S01": { M: 2.46, cx: 480, cy: 520 },
  "M4.49 pile view (S02)": { M: 4.49, cx: 418, cy: 545 },
  "M6.51 hero backdrop (R3)": { M: 6.51, cx: 418, cy: 545 },
};
const PRESET_NAMES = ["free", "M1.25 whole plate", "M2.46 end of S01", "M4.49 pile view (S02)", "M6.51 hero backdrop (R3)"] as const;
const SCENE_NAMES = ["S02 pile", "S05 lifted glossy book", "S10 riffle", "S11 open book", "S23 riser"] as const;
const SCENE_ID = { "S02 pile": "S02", "S05 lifted glossy book": "S05", "S10 riffle": "S10", "S11 open book": "S11", "S23 riser": "S23" } as const;

/** Sliders in the Studio's right-hand panel. */
export const devLightingSchema = z.object({
  preset: z.enum(PRESET_NAMES),
  M: z.number().min(1).max(8).step(0.01),
  cx: z.number().min(0).max(1536).step(1),
  cy: z.number().min(0).max(864).step(1),
  scene: z.enum(SCENE_NAMES),
  // the lights
  key: z.boolean(),
  rim: z.boolean(),
  kicker: z.boolean(),
  fill: z.boolean(),
  probe: z.boolean(),
  // shadows
  shadows: z.boolean(),
  catcher: z.boolean(),
  contact: z.boolean(),
  // the lens
  plateDefocus: z.boolean(),
  objectDefocus: z.boolean(),
  focusCm: z.number().min(40).max(900).step(0.5),
  fNumber: z.number().min(1).max(16).step(0.1),
  // the views
  falseColour: z.boolean(),
  showPanel: z.boolean(),
});
export type DevLightingProps = z.infer<typeof devLightingSchema>;
export const defaultDevLightingProps: DevLightingProps = {
  preset: "M4.49 pile view (S02)",
  M: 4.49,
  cx: 418,
  cy: 545,
  scene: "S02 pile",
  key: true,
  rim: true,
  kicker: true,
  fill: true,
  // off by default so the first look does not need `npm run probe`; turn it on to see the glossy cover reflect the room
  probe: false,
  shadows: true,
  catcher: true,
  contact: true,
  plateDefocus: true,
  objectDefocus: false,
  focusCm: PLATE_MATCH.camDistCm + ZONES.L.anchor.Zd,
  fNumber: 2.8,
  falseColour: false,
  showPanel: true,
};

/** The exposure view: luminance in stops from middle grey, as bands (black, blue, teal, green, yellow, orange; red = clipped). */
class FalseColourEffect extends Effect {
  constructor() {
    super(
      "FalseColourEffect",
      /* glsl */ `
      void mainImage(const in vec4 c, const in vec2 uv, out vec4 o) {
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        float s = log2(max(l, 1e-5) / 0.18);
        vec3 col;
        if (l >= 0.95) col = vec3(1.0, 0.0, 0.0);
        else if (s > 1.5) col = vec3(1.0, 0.6, 0.0);
        else if (s > 0.0) col = vec3(0.9, 0.9, 0.2);
        else if (s > -1.5) col = vec3(0.3, 0.8, 0.3);
        else if (s > -3.0) col = vec3(0.1, 0.5, 0.7);
        else if (s > -5.0) col = vec3(0.1, 0.15, 0.6);
        else col = vec3(0.05, 0.0, 0.15);
        o = vec4(col, c.a);
      }`,
      { blendFunction: BlendFunction.NORMAL },
    );
  }
}

/** The post chain of the sheet: the object blur and the false-colour view, in one composer (only mounted when one of them is on). */
const Post: React.FC<{ objectDefocus: boolean; falseColour: boolean; lens: Lens; M: number }> = ({ objectDefocus, falseColour, lens, M }) => {
  const dof = useMemo(() => new ObjectDefocusEffect(), []);
  const fc = useMemo(() => new FalseColourEffect(), []);
  useLayoutEffect(() => {
    dof.setLens(lens, M);
  }, [dof, lens.focusCm, lens.focalMm, lens.fNumber, M]);
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      {objectDefocus ? <primitive object={dof} dispose={null} /> : <></>}
      {falseColour ? <primitive object={fc} dispose={null} /> : <></>}
    </EffectComposer>
  );
};

/**
 * THE LIGHTING LAB (Patch 04): the placeholder pile under the rig, with a toggle for every light, the shadows, the probe, the two
 * kinds of blur and a false-colour exposure view. Use it to tune `src/config/lights.ts` by looking.
 */
export const DevLighting: React.FC<DevLightingProps> = (pr) => {
  const frame = useCurrentFrame();
  const view = PRESETS[pr.preset] ?? { M: pr.M, cx: pr.cx, cy: pr.cy };
  const scene = SCENES[SCENE_ID[pr.scene]];
  const lens: Lens = { focusCm: pr.focusCm, focalMm: matchFocalMm(PLATE_MATCH), fNumber: pr.fNumber };
  const range = sceneDepthRange(scene);
  const objNeed = pr.objectDefocus && objectsNeedDefocus(lens, view.M, range.near, range.far);
  const blur = plateBlurPx(view.M, lens, PLATE_MATCH);
  const band = magnificationBand(view.M);
  const key = keyIrradianceAt(ZONES.L.anchor.X, 2, ZONES.L.anchor.Zd);
  const text: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage view={view} lens={pr.plateDefocus ? lens : undefined}>
        <LightRig frame={frame} on={{ key: pr.key, rim: pr.rim, kicker: pr.kicker, fill: pr.fill, probe: pr.probe }} shadows={pr.shadows} />
        {pr.probe ? <ProbeEnvironment /> : null}
        {pr.catcher ? <ShadowCatcher /> : null}
        <PlaceholderPile boxes={scene.boxes} contact={pr.contact} shadows={pr.shadows} />
        {objNeed || pr.falseColour ? <Post objectDefocus={objNeed} falseColour={pr.falseColour} lens={lens} M={view.M} /> : null}
      </Stage>
      {pr.showPanel ? (
        <div style={{ position: "absolute", left: 36, top: 30, ...text, fontSize: 22, lineHeight: 1.45 }}>
          <div>
            LIGHTING · {pr.scene} · M {view.M.toFixed(2)} · <span style={{ color: BAND_COLOR[band] }}>{band}</span>
          </div>
          <div style={{ fontSize: 18, opacity: 0.85 }}>
            plate blur {isBlurDrawn(pr.plateDefocus ? blur : 0) ? blur.toFixed(1) : "0"} px (table minimum {minBlurPx(view.M).toFixed(1)}) · objects {pr.objectDefocus ? (objNeed ? "blurred by the lens" : "within focus") : "sharp"}
          </div>
          <div style={{ fontSize: 18, opacity: 0.85 }}>
            key {pr.key ? "on" : "off"} {LIGHTS.key.color} · rim {pr.rim ? "on" : "off"} · kicker {pr.kicker ? "on" : "off"} · fill {pr.fill ? "on" : "off"} · probe {pr.probe ? "on" : "off"} · shadows {pr.shadows ? "on" : "off"}
          </div>
          <div style={{ fontSize: 18, opacity: 0.85 }}>key irradiance at the pile (unit: I / d², facing the lamp) {key.toFixed(2)} · exposure view {pr.falseColour ? "false colour" : "off"}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
