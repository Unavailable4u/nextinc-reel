// COLOUR ARITHMETIC ON HEX STRINGS (Patch 07). Pure, no three.js, no randomness, so Node can use it and the same input always
// gives the same string. Mixing and desaturating are done on the sRGB-encoded numbers, the way a designer reads a hex colour
// ("12 percent less saturated", "90 percent of the way to the dye"); three.js converts the result to linear light itself.

export type Rgb = readonly [number, number, number];

const HEX = /^#?([0-9a-fA-F]{6})$/;

/** `#RRGGBB` (the `#` is optional) to three bytes. */
export function parseHex(hex: string): [number, number, number] {
  const m = HEX.exec(hex.trim());
  if (!m) throw new Error(`color: "${hex}" is not a #RRGGBB colour`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const byte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

/** Three numbers 0 to 255 (rounded and clamped) to `#RRGGBB`, upper case. */
export function toHex(rgb: Rgb): string {
  return "#" + rgb.map((v) => byte(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Rec. 709 luma of the encoded bytes, 0 to 255. */
export const lumaOf = (rgb: Rgb): number => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

/** `a` taken `t` of the way to `b` (0 gives `a`, 1 gives `b`). */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** `hex` with `amount` (0 to 1) of its saturation taken off: 0 is unchanged, 1 is the grey of the same luma. */
export function desaturateHex(hex: string, amount: number): string {
  const c = parseHex(hex);
  const g = lumaOf(c);
  return toHex([c[0] + (g - c[0]) * amount, c[1] + (g - c[1]) * amount, c[2] + (g - c[2]) * amount]);
}

const linear = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** WCAG relative luminance of `#RRGGBB`, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio of two colours, 1 (the same) to 21 (black on white). The order of the arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
