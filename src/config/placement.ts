// Where things may stand on the desk (Patch 03). Numbers live in placementZones.json; this file types them and adds the two checks
// every later patch needs: does a footprint fit a zone, and does a point lie in one. Units: cm, desk coordinates (see plateCamera.ts).

import zonesJson from "./placementZones.json";

export interface Zone {
  name: string;
  for: string;
  x0: number;
  x1: number;
  zd0: number;
  zd1: number;
  anchor: { X: number; Zd: number };
}
export interface PhotoBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Exclusion {
  id: string;
  what: string;
  /** where it is in the plate, photo px */
  photoBox: PhotoBox;
  /** where it stands on the desk plane, cm; null for the chair, which stands in front of the desk */
  desk: { x0: number; x1: number; zd0: number; zd1: number } | null;
  heightCm?: number;
  clearancePx?: number;
}

export type ZoneId = "L" | "R";
export const ZONES = zonesJson.zones as Record<ZoneId, Zone>;
export const EXCLUSIONS = zonesJson.exclusions as Exclusion[];
export const DESK_MARGIN_CM: number = zonesJson.deskMarginCm;
/** footprints of the things that go in the zones, cm */
export const FOOTPRINTS = zonesJson.footprintsCm as { book: { w: number; d: number }; riser: { w: number; d: number } };

/** The four corners (desk coordinates) of a w x d footprint centred on (X, Zd) and turned by yawDeg about its centre. */
export function footprintCorners(X: number, Zd: number, w: number, d: number, yawDeg = 0): { X: number; Zd: number }[] {
  const a = (yawDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([u, v]) => ({ X: X + u * c - v * s, Zd: Zd + u * s + v * c }));
}

/** True when every corner of the footprint lies inside the zone. */
export function footprintInZone(zone: Zone, X: number, Zd: number, w: number, d: number, yawDeg = 0): boolean {
  return footprintCorners(X, Zd, w, d, yawDeg).every((q) => q.X >= zone.x0 && q.X <= zone.x1 && q.Zd >= zone.zd0 && q.Zd <= zone.zd1);
}

/** Smallest gap in cm between two desk-plane rectangles; 0 when they touch or overlap. */
export function rectGapCm(a: { x0: number; x1: number; zd0: number; zd1: number }, b: { x0: number; x1: number; zd0: number; zd1: number }): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
  const dz = Math.max(a.zd0 - b.zd1, b.zd0 - a.zd1, 0);
  return Math.hypot(dx, dz);
}
