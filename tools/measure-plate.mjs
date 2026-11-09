// Measures the plate and prints the numbers that src/config/plate.ts is built on (edge colours, luminance, bright regions).
//   npm run plate:measure
// Read-only: it never writes the photo.  Rec. 709 luma weights on sRGB values, as in docs/reference/desk-plate-analysis.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(ROOT, "public/plates/original/desk-plate.jpg");
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const px = (x, y) => {
  const i = (y * W + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function rect(x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0, mx = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = px(x, y);
      r += p[0]; g += p[1]; b += p[2]; n++;
      mx = Math.max(mx, luma(p));
    }
  const mean = [r / n, g / n, b / n].map((v) => Math.round(v * 10) / 10);
  return { mean, luma: Math.round(luma(mean) * 10) / 10, max: Math.round(mx), n };
}

console.log(`file ${path.relative(ROOT, file)}  ${W} x ${H}  ${fs.statSync(file).size} bytes`);
console.log("\nEdge strips (the pillarbox takes its colour from these):");
for (const m of [30, 40, 60]) {
  console.log(`  left  ${String(m).padStart(2)} px  `, JSON.stringify(rect(0, 0, m, H)));
  console.log(`  right ${String(m).padStart(2)} px  `, JSON.stringify(rect(W - m, 0, W, H)));
}
console.log("\nNamed regions (photo px) used by `npm run plate:verify` for the strict pixel test:");
const REGIONS = JSON.parse(fs.readFileSync(path.join(ROOT, "src/config/plateRegions.json"), "utf8"));
for (const [name, r] of Object.entries(REGIONS.regions)) {
  const m = rect(r.x0, r.y0, r.x1, r.y1);
  console.log(`  ${name.padEnd(14)} x ${String(r.x0).padStart(3)}-${String(r.x1).padStart(3)}  y ${String(r.y0).padStart(3)}-${String(r.y1).padStart(3)}  mean luma ${String(m.luma).padStart(6)}  max ${String(m.max).padStart(3)}   ${r.what}`);
}
