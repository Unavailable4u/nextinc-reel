// SSIM, shared by the scripts (moved out of scripts/verify-plate.mjs in Patch 13C, unchanged: `npm run plate:verify` gives the same
// numbers as before). Luma, 11 x 11 gaussian window, sigma 1.5, the standard constants. Pure Node, no dependencies.
//   ssim(a, b, w, h)        two luma planes
//   ssimRgb(a, b, w, h)     two 8-bit RGB images (3 bytes a pixel, as sharp's `.removeAlpha().raw()` gives them): the SSIM of their luma

function gaussKernel() {
  const k = [];
  let s = 0;
  for (let i = -5; i <= 5; i++) { const v = Math.exp(-(i * i) / (2 * 1.5 * 1.5)); k.push(v); s += v; }
  return k.map((v) => v / s);
}
const K = gaussKernel();
function blur(src, w, h) {
  const tmpB = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -5; i <= 5; i++) a += K[i + 5] * src[y * w + Math.min(w - 1, Math.max(0, x + i))];
    tmpB[y * w + x] = a;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0;
    for (let i = -5; i <= 5; i++) a += K[i + 5] * tmpB[Math.min(h - 1, Math.max(0, y + i)) * w + x];
    out[y * w + x] = a;
  }
  return out;
}
/** The mean SSIM of two luma planes (Float32Array or any array of numbers 0-255), `w` x `h`. The 5 px border, where the window is cut, is left out. */
export function ssim(a, b, w, h) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const mu1 = blur(a, w, h), mu2 = blur(b, w, h);
  const aa = new Float32Array(w * h), bb = new Float32Array(w * h), ab = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { aa[i] = a[i] * a[i]; bb[i] = b[i] * b[i]; ab[i] = a[i] * b[i]; }
  const s11 = blur(aa, w, h), s22 = blur(bb, w, h), s12 = blur(ab, w, h);
  let sum = 0, n = 0;
  for (let y = 5; y < h - 5; y++) for (let x = 5; x < w - 5; x++) {
    const i = y * w + x;
    const v1 = s11[i] - mu1[i] * mu1[i], v2 = s22[i] - mu2[i] * mu2[i], cv = s12[i] - mu1[i] * mu2[i];
    sum += ((2 * mu1[i] * mu2[i] + C1) * (2 * cv + C2)) / ((mu1[i] ** 2 + mu2[i] ** 2 + C1) * (v1 + v2 + C2));
    n++;
  }
  return sum / n;
}
/** the luma of an sRGB pixel, 0-255 (the weights the plate test has always used) */
export const lumaOf = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The SSIM of two 8-bit RGB images of the same size (3 bytes a pixel, no alpha). */
export function ssimRgb(a, b, w, h) {
  if (a.length !== w * h * 3 || b.length !== w * h * 3) throw new Error(`ssimRgb: expected ${w * h * 3} bytes for ${w}x${h}, got ${a.length} and ${b.length}`);
  const A = new Float32Array(w * h);
  const B = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    A[i] = lumaOf(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
    B[i] = lumaOf(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
  }
  return ssim(A, B, w, h);
}
