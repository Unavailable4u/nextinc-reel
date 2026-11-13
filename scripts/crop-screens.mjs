// Crops the raw screenshots in public/screens/ to the app content only (guide 07, "Screenshot preparation rule") and saves each crop
// as a NEW file next to the original, which is never touched.   npm run screens   (add -- --check to compare only)
//
// What the rule removes from a full-screen capture: the browser's tab strip and address bar (the address of the app, other tabs, the
// assistant button) and the operating system's task bar down the right edge. The numbers below were measured on the captures
// themselves (the row where the page starts, the column where the task bar starts), one set for the 1920 x 1080 captures and one for
// the 1536 x 864 one. A still of the showcase build has a 2 px browser line at its top and a scrollbar down its right edge.
//
// A crop that shows something the books must not claim is cropped further: the Immersive hero is cut below its badge row ("trusted by
// hundreds", "award winning": guide 04, "Not on the books"), the globe still keeps only the globe.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCREENS = path.join(ROOT, "public", "screens");
const CHECK = process.argv.includes("--check");

/** the browser's chrome ends at `top`; the app ends at `width` (then the task bar) */
const CAPTURE_1080 = { left: 0, top: 109, width: 1857, height: 971 };
const CAPTURE_864 = { left: 0, top: 88, width: 1487, height: 776 };

/** `from` and `to` are relative to public/screens/. `webp` is for photographic stills (a flat app screen is a smaller PNG). */
const CROPS = [
  { from: "mini-me/image copy 2.png", to: "mini-me/01-chat.png", box: CAPTURE_1080 },
  { from: "mini-me/image copy 3.png", to: "mini-me/02-notebooks.png", box: CAPTURE_1080 },
  { from: "mini-me/image copy 5.png", to: "mini-me/03-research.png", box: CAPTURE_1080 },
  { from: "mini-me/image copy 8.png", to: "mini-me/04-plan-architecture.png", box: CAPTURE_1080 },
  { from: "mini-me/image copy 9.png", to: "mini-me/05-plan-blueprint.png", box: CAPTURE_1080 },
  { from: "mini-me/image copy 10.png", to: "mini-me/06-build.png", box: CAPTURE_864 },
  { from: "next-inc-immersive/image2.png", to: "next-inc-immersive/01-hero.webp", box: { left: 0, top: 2, width: 1820, height: 925 }, webp: true },
  { from: "next-inc-immersive/image3.png", to: "next-inc-immersive/02-globe.webp", box: { left: 800, top: 2, width: 1041, height: 925 }, webp: true },
  { from: "next-inc-immersive/image1.png", to: "next-inc-immersive/03-intro.webp", box: { left: 0, top: 232, width: 1822, height: 688 }, webp: true },
];

let bad = 0;
for (const c of CROPS) {
  const src = path.join(SCREENS, c.from);
  const dst = path.join(SCREENS, c.to);
  if (!fs.existsSync(src)) {
    console.log(`  missing  ${c.from}`);
    bad++;
    continue;
  }
  let img = sharp(src).extract(c.box);
  img = c.webp ? img.webp({ quality: 90, effort: 6 }) : img.png({ compressionLevel: 9, effort: 10 });
  const bytes = await img.toBuffer();
  const kb = Math.round(bytes.length / 1024);
  if (CHECK) {
    const same = fs.existsSync(dst) && Buffer.compare(fs.readFileSync(dst), bytes) === 0;
    console.log(`  ${same ? "ok      " : "DIFFERS "} ${c.to} (${kb} KB)`);
    if (!same) bad++;
    continue;
  }
  fs.writeFileSync(dst, bytes);
  console.log(`  wrote    ${c.to}  ${c.box.width} x ${c.box.height}  ${kb} KB${kb > 400 ? "  (over the 400 KB budget of guide 07)" : ""}`);
}
process.exit(bad ? 1 : 0);
