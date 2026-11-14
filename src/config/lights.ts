// THE LIGHTS AS DATA (Patch 04). Every number the rig uses is here; `src/light/Rig.tsx` only reads it.
//
// UNITS (three.js r170 is physically based): 1 world unit = 1 cm. A point light's intensity is in candela, an area light's in nits
// (cd per m2), a hemisphere light's in irradiance. A diffuse surface of albedo a lit by a point light of intensity I at distance d
// (cm), facing it, comes out at a / pi * I / d^2. The numbers below are STARTING values, set by that arithmetic for an albedo-0.35
// cover and then to be tuned by looking at `DevLighting`; each light has a comment saying what it should do on screen.
import { PLATE_MATCH } from "../plate/PlateFollow";
import { lampBulb, type MatchParams } from "../plate/plateCamera";

export type Vec3 = [number, number, number];

export const LIGHTS = {
  /** The desk lamp: the motivated key. Warm, a point source at the bulb, inverse-square falloff. Soft shadow from a fixed-size map. */
  key: {
    color: "#F0CEA0",
    /** candela. About 0.2 linear on a lamp-facing cover at the pile (57 cm away). */
    intensityCd: 3500,
    decay: 2,
    shadow: {
      /** fixed on purpose: a changing size changes the shadow's pixels (determinism). A point light draws six faces of this size. */
      mapSize: 1024,
      /** PCF blur in shadow-map texels; at 56 cm from the lamp and 1024 texels this is a penumbra of about 0.9 cm (guide 03 asks for 1 to 2 cm: raise it, or lower the map, by looking) */
      radius: 8,
      near: 5,
      far: 400,
      bias: -0.0004,
      normalBias: 0.04,
    },
    /** a mains-lamp shimmer, a pure function of the frame: +-0.4% at about 0.9 Hz and 2.3 Hz */
    shimmer: { amount: 0.004, hz1: 0.9, hz2: 2.3, phase1: 0.7, phase2: 2.1 },
  },
  /** The amber LED strip behind the desk: a thin area light along the back, lighting the pile's top and back edges. */
  rim: {
    color: "#EBAF7B",
    /** nits */
    intensityNits: 6,
    widthCm: 90,
    heightCm: 3,
    /** centre of the strip: X, height above the desk, Zd (towards the wall) */
    at: { X: 20, Y: 20, Zd: 60 } as { X: number; Y: number; Zd: number },
    /** the point it faces: the middle of the pile */
    aim: { X: 0, Y: 3, Zd: 16 } as { X: number; Y: number; Zd: number },
  },
  /** The under-desk LED kicker: a low warm point in front of the pile that lifts the front faces and fills the shadow side a little. */
  kicker: {
    color: "#E39A5E",
    intensityCd: 60,
    decay: 2,
    at: { X: 25, Y: 0.5, Zd: -12 } as { X: number; Y: number; Zd: number },
  },
  /** The cool fill. `#28292E` is already a dark colour, so the intensity is large: about 8% of the key's irradiance at the pile. */
  fill: { color: "#28292E", intensity: 4 },
  /** The environment probe (src/light/PlateProbe.ts) for the glossy and foil materials. */
  probe: {
    intensity: 0.35,
    lampSpotNits: 12,
    lampSpotRadiusPx: 2.2,
    /**
     * THE SWEEP STRIP (Patch 15, guide 03 section 4: "do the specular sweep in S05 by moving the book, not the light"). A cover that faces the
     * camera reflects what is behind the camera, and the lamp and the amber strips are in front of it, so the foil of a held cover would stay
     * black. The camera's side of the probe therefore has one tall soft window, out of frame behind the camera: a vertical band `sigmaPx` wide
     * (a gaussian) at column `colPx` of the 128 px face, full from the top down to row `rowsFull`, fading out over `rowsFade` more rows.
     * The column is where the reflection of the held cover at yaw 0 and pitch 80 lands (the camera is 35 cm right of the book, so the
     * reflection leaves 4 degrees to the left of straight back: x/z = 0.071, mirrored by three.js for cube maps), so the foil lights up when the
     * hero orbit passes yaw 0 on frame 1260 (`config/heroMotion.ts`) and is dark at the ends of the orbit. `nits` is the window's brightness
     * before the 0.35 of `intensity`: tune it by looking at the foil at frames 1230-1290.
     */
    sweep: { nits: 10, colPx: 68.5, sigmaPx: 5, rowsFull: 60, rowsFade: 20, color: [1, 0.95, 0.85] as readonly [number, number, number] },
  },
  /** The warm blur under the desk shadow: a decal along the front edge of each book. */
  reflection: { color: "#C98A57", opacity: 0.07, depthCm: 1.2 },
  /** The shadow catcher: warm black, never pure black (guide 03). */
  catcher: { color: "#1B0F08", opacity: 0.62 },
  /** The baked contact patch under a resting book: two layers, a tight dark line and a wider soft one. */
  contact: { color: "#1B0F08", tightCm: 0.25, tightOpacity: 0.55, wideCm: 1.3, wideOpacity: 0.28 },
} as const;

export type LightName = "key" | "rim" | "kicker" | "fill" | "probe";

/** Desk coordinates (X, Y, Zd) to world (X, Y, -Zd). */
export const deskToWorld = (X: number, Y: number, Zd: number): Vec3 => [X, Y, -Zd];

/** The lamp bulb in world coordinates for a match (it follows the match: the lab recomputes it). */
export function lampWorld(match: MatchParams = PLATE_MATCH): Vec3 {
  const b = lampBulb(match);
  return deskToWorld(b.X, b.Y, b.Zd);
}

/** The key's intensity multiplier at a frame: 1 +- shimmer.amount. Deterministic (no randomness). */
export function keyShimmer(frame: number, fps = 60): number {
  const s = LIGHTS.key.shimmer;
  const t = frame / fps;
  return 1 + s.amount * 0.6 * Math.sin(2 * Math.PI * s.hz1 * t + s.phase1) + s.amount * 0.4 * Math.sin(2 * Math.PI * s.hz2 * t + s.phase2);
}

/** Irradiance of the key at a desk point facing the lamp, in the units of the fill (for the ratio test): I / d^2. */
export function keyIrradianceAt(X: number, Y: number, Zd: number, match: MatchParams = PLATE_MATCH): number {
  const l = lampWorld(match);
  const dx = X - l[0];
  const dy = Y - l[1];
  const dz = -Zd - l[2];
  return LIGHTS.key.intensityCd / (dx * dx + dy * dy + dz * dz);
}
