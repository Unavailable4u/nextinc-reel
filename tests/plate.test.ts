// The plate: the file, its checksum, its size, and what the size means for the opening view.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { EDGE_MARGIN, INTEGRITY_REGIONS, M_FIT_HEIGHT, M_FIT_WIDTH, PILLARBOX, PLATE_FILE, PLATE_H, PLATE_SHA256, PLATE_W, DESK_M_RATIO } from "../src/config/plate";
import { VIEW_FIT, clampView } from "../src/plate/PlateFollow";
import { eq, near, truthy, test } from "./harness";

const ROOT = process.cwd();
const sha = (f: string): string => crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, f))).digest("hex");
const checksumFile = (f: string): string => fs.readFileSync(path.join(ROOT, f), "utf8").trim().split(/\s+/)[0];

test("plate: the PNG header size equals the config", () => {
  const b = fs.readFileSync(path.join(ROOT, "public", PLATE_FILE));
  eq(b.subarray(1, 4).toString("latin1"), "PNG", "signature");
  eq(b.readUInt32BE(16), PLATE_W, "width");
  eq(b.readUInt32BE(20), PLATE_H, "height");
});
test("plate: the file, the config and docs/reference/.plate.sha256 agree", () => {
  eq(sha(`public/${PLATE_FILE}`), PLATE_SHA256, "file vs config");
  eq(checksumFile("docs/reference/.plate.sha256"), PLATE_SHA256, "checksum file vs config");
});
test("plate: the superseded first photo is kept byte for byte", () => {
  eq(sha("public/plates/superseded/desk-plate-v1.jpg"), checksumFile("docs/reference/.plate-v1.sha256"), "v1 checksum");
});
test("plate: it is 16:9, so both fit magnifications are 1.25 and there is no feather", () => {
  near(PLATE_W / PLATE_H, 16 / 9, 1e-9, "aspect");
  near(M_FIT_HEIGHT, 1.25, 1e-9, "fit height");
  near(M_FIT_WIDTH, 1.25, 1e-9, "fit width");
  eq(PILLARBOX.feather, 0, "feather");
});
test("plate: the opening view shows no bars and is not clamped", () => {
  const c = clampView(VIEW_FIT);
  eq(c.pillarbox, false, "pillarbox");
  eq(c.clamped, false, "clamped");
});
test("plate: the margin rule only applies from M = 1.319 up; below that the view is just centred", () => {
  const threshold = 1920 / (PLATE_W - 2 * EDGE_MARGIN);
  near(threshold, 1.3187, 1e-3, "threshold");
  const centred = clampView({ M: 1.3, cx: PLATE_W / 2, cy: PLATE_H / 2 });
  eq(centred.clamped, false, "M 1.3 at the centre is left alone");
  near(clampView({ M: 1.3, cx: 200, cy: 100 }).view.cx, PLATE_W / 2, 1e-9, "M 1.3 is centred, not clamped to a margin");
  const at2 = clampView({ M: 2, cx: 10, cy: 10 });
  truthy(at2.clamped, "M 2 near the corner must be moved");
  near(at2.view.cx, EDGE_MARGIN + 1920 / 2 / 2, 1e-9, "cx");
  near(at2.view.cy, EDGE_MARGIN + 1080 / 2 / 2, 1e-9, "cy");
});
test("plate: every integrity region lies inside the plate and is non-empty", () => {
  const names = Object.keys(INTEGRITY_REGIONS);
  eq(names.length, 11, "region count");
  for (const n of names) {
    const r = INTEGRITY_REGIONS[n];
    truthy(r.x0 >= 0 && r.y0 >= 0 && r.x1 <= PLATE_W && r.y1 <= PLATE_H && r.x1 > r.x0 && r.y1 > r.y0, `region ${n}`);
  }
});
test("plate: the old-M to new-M ratio is the desk width ratio", () => {
  near(DESK_M_RATIO, 0.7233, 1e-4, "ratio");
  near(6.2 * DESK_M_RATIO, 4.485, 0.01, "pile view");
  near(5.5 * DESK_M_RATIO, 3.978, 0.01, "riser view");
});
