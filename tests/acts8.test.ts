// PATCH 20: the shots S24-S25 (the room dims, the wordmark is stroked on and the letters rise, the tagline and the address, the hold, the fade to black) and gate G3's number checks: the
// camera 4800-5399 against the audit, the dim's curve and the lights it drives, the wordmark's words (the data's), layout and timing, the card clear of the books and readable on the real
// photograph, the fade, the cues, the files. The pictures and the 60 fps look (gate G3 is a person playing the film) are for a person (see the notes of Patch 20).
import fs from "node:fs";
import path from "node:path";
import { BEAT, SHOTS, TOTAL } from "../src/config/timeline";
import { HERO_STATES, limitFor, stateOf } from "../src/config/camera";
import { CRIMSON } from "../src/config/covers";
import { DIM, bookStops, dimAt, dimProgress, dimRgb, keyColourAt } from "../src/config/dim";
import { CARD_COMPLETE, END, GLYPH, WORDMARK, X_ADVANCE, advanceOf, cardText, fadeAlpha, wordmarkAt, wordmarkLayout, wordmarkParts, xInkBox } from "../src/config/wordmark";
import { LIGHTS } from "../src/config/lights";
import { auditMotion } from "../src/camera/audit";
import { authoredAt, cameraAt } from "../src/camera/path";
import { bookPlateRects } from "../src/fx/labelLayout";
import { photoToScreen } from "../src/plate/PlateFollow";
import { getCompany } from "../src/data/select";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, activeShot, shotById } from "../src/shots";
import { eq, near, test, throws, truthy } from "./harness";

const root = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(root, rel), "utf8");
/** the source without its comments, so a rule about the code does not trip over a sentence that explains it */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---------- the camera ----------

test("patch 20: S24 and S25 are on the table's frames and own their keys (on beats, no roll, no tilt, R4); the film's camera ends on 5400, the frame after the film", () => {
  eq(`${SHOTS[24].from}-${SHOTS[25].to}`, "4800-5399");
  eq(JSON.stringify(shotById("S24").camera.map((k) => k.frame)), JSON.stringify([5280]));
  eq(JSON.stringify(shotById("S25").camera.map((k) => k.frame)), JSON.stringify([5400]));
  for (const id of ["S24", "S25"]) for (const k of shotById(id).camera) {
    eq(k.frame % BEAT, 0, `${id} key ${k.frame} is on a beat`);
    eq(k.rollDeg, 0, `${id} key ${k.frame}: no roll`);
    eq(k.tiltDeg, 0, `${id} key ${k.frame}: no tilt`);
    eq(k.regime, "R4", `${id} key ${k.frame}`);
  }
  eq(FILM_CAMERA_KEYFRAMES[FILM_CAMERA_KEYFRAMES.length - 1].frame, TOTAL);
  eq(JSON.stringify(stateOf(shotById("S24").camera[0])), JSON.stringify(HERO_STATES.mark));
  eq(JSON.stringify(stateOf(shotById("S25").camera[0])), JSON.stringify(HERO_STATES.end));
});

test("patch 20: the views: the table's 3 percent push to M 4.09 at f/2.8 on 5280 (focus 50), then the same line on, the lens still, M never above the R4 budget", () => {
  near(authoredAt(4800).state.M, 3.98, 1e-9, "S24 starts from the end of S23's push");
  near(authoredAt(5280).state.M, 4.09, 1e-9, "the table's end of the push");
  const push = authoredAt(5280).state.M / authoredAt(4800).state.M - 1;
  truthy(push > 0.025 && push < 0.035, `the push is the table's 3 percent: ${push}`);
  near(authoredAt(4800).state.aperture, 4, 1e-9, "f/4 at the start");
  near(authoredAt(5280).state.aperture, 2.8, 1e-9, "f/2.8 at 5280 (the table)");
  near(authoredAt(5400).state.aperture, 2.8, 1e-9, "the lens does not change in S25");
  near(authoredAt(5400).state.focusCm, 50, 1e-9, "focus 50 throughout");
  const end = authoredAt(5400).state.M;
  truthy(end > 4.09 && end / 4.09 < 1.01, `S25 drifts less than 1 percent (the table's "micro-drift"): ${end}`);
  truthy(end <= limitFor("R4").maxM, "R4 budget");
  // M only rises over S24-S25, and the aperture only falls
  for (let f = 4801; f <= 5399; f++) {
    truthy(authoredAt(f).state.M >= authoredAt(f - 1).state.M - 1e-12, `M only rises (frame ${f})`);
    truthy(authoredAt(f).state.aperture <= authoredAt(f - 1).state.aperture + 1e-12, `the iris only opens (frame ${f})`);
  }
});

test("patch 20: S24 and S25 are one straight move: no corner in the speed of the picture where S24 ends (5280), and the books are never off the 40 px margin", () => {
  const speed = (f: number): number => {
    const a = authoredAt(f).state;
    const b = authoredAt(f + 1).state;
    return Math.hypot(b.panX - a.panX, b.panY - a.panY) + Math.abs(1 / b.M - 1 / a.M) * 1000;
  };
  near(speed(5270), speed(5290), 1e-9, "the same speed before and after 5280");
  near(speed(4900), speed(5000), 1e-9, "a straight line from 4800 on");
  for (let f = 4800; f < TOTAL; f += 20) {
    const c = cameraAt(f);
    truthy(c.view.cx - 960 / c.view.M >= 40 && c.view.cx + 960 / c.view.M <= 1536 - 40, `the window is inside the plate's margin at ${f}`);
  }
});

test("patch 20: the audit is clean for frames 4800-5399 with no exception (STILL included), and the whole film has only the documented opening hold", () => {
  const r = auditMotion({ from: 4800, to: 5399, exceptions: [] });
  eq(r.findings.length, 0, JSON.stringify(r.findings));
  const all = auditMotion();
  eq(all.range.join("-"), "0-5399");
  eq(all.unexplained, 0, JSON.stringify(all.findings));
  eq(all.counts.STILL, 1);
  eq(all.counts.FAST + all.counts.DEEP + all.counts.EDGE + all.counts.POP + all.counts.LATE, 0);
});

// ---------- the dim ----------

test("patch 20: the dim is nothing before 4800 (every gain exactly 1, the alpha exactly 0, the lamp's own colour) and -1.5 stops from 4920 on", () => {
  for (const f of [0, 1000, 3960, 4799, 4800]) {
    const d = dimAt(f);
    eq(d.progress, 0, `progress at ${f}`);
    eq(d.stops, 0);
    eq(d.exposure, 1);
    eq(d.overlayAlpha, 0, `alpha at ${f}`);
    eq(d.keyGain, 1);
    eq(d.stripGain, 1);
    eq(keyColourAt(f, LIGHTS.key.color), LIGHTS.key.color, `the lamp's colour at ${f}`);
  }
  eq(DIM.from, 4800);
  eq(DIM.frames, 120, "2 s");
  for (const f of [4920, 5000, 5280, 5399]) {
    const d = dimAt(f);
    near(d.stops, -1.5, 1e-12, `${f}: -1.5 stops`);
    near(d.exposure, Math.pow(2, -1.5), 1e-12);
    near(d.keyGain, DIM.key.endGain, 1e-12);
    near(d.stripGain, DIM.strips.endGain, 1e-12);
    eq(keyColourAt(f, LIGHTS.key.color).toLowerCase(), DIM.key.warmColour.toLowerCase(), `the lamp ends at its warm colour (${f})`);
  }
});

test("patch 20: the dim is a smooth curve: it only goes one way, has no corner at either end, and the layer's alpha is the exposure in encoded values", () => {
  let prev = dimProgress(4800);
  let prevStep = 0;
  for (let f = 4801; f <= 4920; f++) {
    const p = dimProgress(f);
    truthy(p >= prev, `progress only rises (${f})`);
    prevStep = p - prev;
    prev = p;
  }
  truthy(dimProgress(4801) < 1e-3, "a slow start (no corner)");
  truthy(prevStep < 1e-3, "a slow finish (no corner)");
  for (let f = 4801; f <= 4920; f++) {
    truthy(dimAt(f).overlayAlpha >= dimAt(f - 1).overlayAlpha, `the layer only darkens (${f})`);
    truthy(dimAt(f).keyGain <= dimAt(f - 1).keyGain && dimAt(f).stripGain >= dimAt(f - 1).stripGain, `the lamp falls and the strips rise (${f})`);
  }
  const end = dimAt(4920);
  near(end.overlayAlpha, 1 - Math.pow(Math.pow(2, -1.5), 1 / 2.2), 1e-12);
  truthy(end.overlayAlpha > 0.35 && end.overlayAlpha < 0.4, `about 0.377: ${end.overlayAlpha}`);
  // a light grey (encoded 200) through the layer comes out near the light 2^-1.5 of it. Not exactly: the layer's black is a warm black (never pure black, guide 03), which lifts the darks a little
  // (about 0.1 stop here, more on a darker grey), so the tolerance is 0.04 in light, a tenth of a stop
  const [r, g, b] = dimRgb().split(",").map(Number);
  truthy(r < 16 && g < 16 && b < 16 && r + g + b > 0, "a warm black, not pure black");
  const lin = (v: number): number => Math.pow(v / 255, 2.2);
  const out = (1 - end.overlayAlpha) * 200 + end.overlayAlpha * r;
  near(lin(out) / lin(200), Math.pow(2, -1.5), 0.04, "the picture is 1.5 stops down");
});

test("patch 20: the lamp warms as it falls, the strips rise, and a book ends a little brighter than the room (softly lit by the strips, an assumed share of light)", () => {
  const mid = keyColourAt(4860, LIGHTS.key.color);
  truthy(mid !== LIGHTS.key.color && mid !== DIM.key.warmColour, `a colour between the two: ${mid}`);
  const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const base = hex(LIGHTS.key.color);
  const warm = hex(DIM.key.warmColour);
  truthy(warm[2] < base[2] && warm[0] >= base[0] - 16, "warmer: the blue falls and the red stays");
  truthy(DIM.strips.endGain > 1 && DIM.key.endGain < 1);
  // while the dim runs the lamp falls faster than the strips rise, so a book dips under the room by a tenth of a stop or so before the strips win it back: never by more than a quarter stop
  for (let f = 4800; f <= 5399; f += 10) truthy(bookStops(f) >= dimAt(f).stops - 0.25, `a book is never a quarter stop darker than the room (${f})`);
  truthy(bookStops(4920) > dimAt(4920).stops && bookStops(5399) > dimAt(5399).stops, "and it ends brighter than the room");
  const b = bookStops(5000);
  truthy(b > -1.5 && b < -1.0, `a book ends about 1.4 stops down against the room's 1.5: ${b}`);
  throws(() => keyColourAt(5000, "red"), "not a #rrggbb");
});

// ---------- the wordmark: the words, the x, the layout, the timing ----------

test("patch 20: the words are the data's (rule 6): the name round the x, the tagline and the address, none typed in the files", () => {
  const c = getCompany();
  const p = wordmarkParts();
  eq(`${p.before}x${p.after}`.toLowerCase(), c.name.toLowerCase(), "the wordmark is the name with its x taken out");
  eq(cardText().tagline, c.tagline);
  eq(cardText().address, c.address);
  eq(cardText().address, "wearenext.tech", "the storyboard's address");
  for (const rel of ["src/fx/Wordmark.tsx", "src/fx/FadeOut.tsx", "src/fx/Dim.tsx", "src/config/wordmark.ts", "src/config/dim.ts", "src/shots/S24.tsx", "src/shots/S25.tsx"]) {
    const src = code(rel);
    for (const fact of [c.name, c.tagline, c.address, "wearenext", "Where research", "Next Inc"]) eq(src.includes(fact), false, `${rel} types "${fact}"`);
  }
  throws(() => wordmarkParts("Acme Inc."), "has no x");
  throws(() => advanceOf("é"), "no advance width");
});

test("patch 20: the x is the site's own path (never redrawn), the letters are placed by measured advances, and the whole card is centred and inside the frame", () => {
  const glyph = JSON.parse(read("public/site/brand/glyph-x.json")) as { d: string; bounds: number[]; unitsPerEm: number };
  eq(GLYPH.d, glyph.d, "the path is glyph-x.json's, character for character");
  eq(JSON.stringify(GLYPH.bounds), JSON.stringify(glyph.bounds));
  eq(X_ADVANCE, 560);
  // the numbers HarfBuzz and the font files gave: N 900, e 527, t 447, space 383, I 436, n 638, c 511, full stop 319
  for (const [ch, a] of [["N", 900], ["e", 527], ["t", 447], [" ", 383], ["I", 436], ["n", 638], ["c", 511], [".", 319]] as const) eq(advanceOf(ch), a, `advance of "${ch}"`);
  const L = wordmarkLayout();
  const { before, after } = wordmarkParts();
  eq(L.letters.map((l) => l.ch).join(""), `${before}${after}`.replace(/ /g, ""), "every letter but the x and the space is drawn");
  truthy(L.letters.every((l, i) => i === 0 || l.x > L.letters[i - 1].x), "left to right");
  near((L.left + L.right) / 2, WORDMARK.centreX, 1e-9, "centred");
  truthy(L.left > 200 && L.right < 1920 - 200, `inside the frame with room: ${L.left}-${L.right}`);
  truthy(L.xOrigin > L.letters[before.length - 1].x && L.xOrigin < L.letters[before.length].x, "the x sits between the letters before it and after it");
  // the italic x's ink (to 603 units on a 560 advance) stays clear of the next letter's ink by the room `afterXEm` leaves
  const next = L.letters[before.length];
  const gap = next.x + (21 * L.scale) - (L.xOrigin + GLYPH.bounds[2] * L.scale);
  truthy(gap > 0, `the t does not touch the x: ${gap.toFixed(2)} px`);
  // the x is as tall as the lower-case letters round it (x-height of CMU Serif Bold, about 0.45 em): the italic x's top is 456 units
  const ink = xInkBox(L);
  near(ink.y0, WORDMARK.baselineY - 456 * L.scale, 1e-9);
  truthy(ink.y1 > WORDMARK.baselineY, "the x dips 11 units below the baseline, as the font's x does");
});

test("patch 20: the timing: nothing before 4860, the x stroked on 4860-4920 and filled by 4950, the letters risen by 5012, the tagline and the address in by 5145, all on beats and in order", () => {
  const L = wordmarkLayout();
  const none = wordmarkAt(4859, L);
  eq(none.draw + none.fill + none.scrimAlpha + none.tagline + none.address, 0, "nothing at 4859");
  truthy(none.letters.every((v) => v === 0));
  eq(WORDMARK.stroke.from, 4860);
  eq(WORDMARK.stroke.from % BEAT + WORDMARK.fill.from % BEAT + WORDMARK.letters.from % BEAT + WORDMARK.tagline.from % BEAT + WORDMARK.address.from % BEAT, 0, "every start is on a beat");
  const a = wordmarkAt(4890, L);
  truthy(a.draw > 0.2 && a.draw < 0.8 && a.fill === 0 && a.strokeOpacity === 1, "mid-stroke: part of the contour, no fill, the stroke fully there");
  truthy(a.letters.every((v) => v === 0), "the letters wait for the x (rule of the storyboard: the x first, then the letters)");
  const b = wordmarkAt(4920, L);
  near(b.draw, 1, 1e-12, "the contour is complete when the fill starts");
  eq(b.fill, 0);
  const c = wordmarkAt(4950, L);
  eq(c.fill, 1);
  eq(c.strokeOpacity, 0, "the stroke is gone when the fill is complete, so the x is the glyph exactly");
  truthy(c.letters.every((v) => v === 0), "the first letter starts on 4950");
  const lastStart = Math.max(...L.letters.map((l) => l.startFrame));
  eq(lastStart + WORDMARK.letters.frames, 5012 + 0, "the last letter is in place on 5012");
  const d = wordmarkAt(5012, L);
  truthy(d.letters.every((v) => v === 1), "every letter is in place");
  const mid = wordmarkAt(4980, L).letters;
  truthy(mid.every((v, i) => i === 0 || v <= mid[i - 1] + 1e-12), "the letters rise left to right: each is no further on than the one before it");
  truthy(mid[0] > 0 && mid[mid.length - 1] < 1, "at 4980 the first letters are well on and the last is still rising");
  truthy(wordmarkAt(5040, L).tagline === 0 && wordmarkAt(5100, L).address === 0 && wordmarkAt(5040, L).letters.every((v) => v === 1), "the tagline starts when the letters are in place, the address after it");
  eq(CARD_COMPLETE, 5145);
  const e = wordmarkAt(CARD_COMPLETE, L);
  eq(e.tagline + e.address + e.fill + e.draw + e.letters.reduce((s, v) => s + v, 0), 4 + L.letters.length - 0, "everything is in");
  for (let f = 4860; f < 5145; f++) {
    const p = wordmarkAt(f, L);
    const q = wordmarkAt(f + 1, L);
    truthy(q.draw >= p.draw && q.fill >= p.fill && q.tagline >= p.tagline && q.address >= p.address && q.scrimAlpha >= p.scrimAlpha, `nothing goes backwards (${f})`);
  }
  eq(JSON.stringify(wordmarkAt(5200, L)), JSON.stringify(wordmarkAt(5200, wordmarkLayout())), "a pure function of the frame");
});

// ---------- the card on the picture ----------

test("patch 20: the card never meets a book: the wordmark's top is clear of the riser's bottom edge on every frame from 4860", () => {
  const L = wordmarkLayout();
  const capTop = WORDMARK.baselineY - 0.68 * WORDMARK.sizePx;
  let worst = 0;
  for (let f = 4800; f < TOTAL; f += 10) {
    const cam = cameraAt(f);
    for (const r of Object.values(bookPlateRects())) {
      const bottom = photoToScreen(cam.view, r.x0, r.y1, cam.rollDeg).y;
      worst = Math.max(worst, bottom);
    }
  }
  truthy(worst + 40 < capTop, `the lowest book edge on screen is y ${worst.toFixed(0)}, the capitals start at y ${capTop.toFixed(0)}`);
  // the card's text rows sit inside the frame with a margin
  truthy(WORDMARK.addressY + 0.3 * WORDMARK.addressPx < 1080 - 60, "the address is clear of the bottom edge");
  truthy(WORDMARK.baselineY < WORDMARK.taglineY && WORDMARK.taglineY < WORDMARK.addressY, "wordmark, tagline, address, top to bottom");
  truthy(L.left >= 40, "40 px margin");
});

test("patch 20: the card is readable on the real photograph: dimmed, the brightest 5 percent of the plate under it still gives the letters 7:1 and the x 3:1; the covers' crimson would not", async () => {
  // sharp is loaded by name at run time: esbuild bundles the tests and cannot bundle sharp's native loader
  const sharpName = "sharp";
  const sharp = ((await import(sharpName)) as { default: typeof import("sharp")["default"] }).default;
  const { data, info } = await sharp(path.join(root, "public/plates/original/desk-plate.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lin = (v: number): number => Math.pow(v / 255, 2.2);
  const lum = (r: number, g: number, b: number): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const hexLum = (c: string): number => lum(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16));
  const contrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const [dr, dg, db] = dimRgb().split(",").map(Number);
  const L = wordmarkLayout();
  const ink = xInkBox(L);
  const rows = [
    { name: "the wordmark", x0: L.left, x1: L.right, y0: WORDMARK.baselineY - 0.68 * WORDMARK.sizePx, y1: WORDMARK.baselineY, want: 7, ink: hexLum(WORDMARK.paper) },
    { name: "the x", x0: ink.x0, x1: ink.x1, y0: ink.y0, y1: ink.y1, want: 3, ink: hexLum(WORDMARK.x) },
    { name: "the tagline", x0: 640, x1: 1280, y0: WORDMARK.taglineY - 28, y1: WORDMARK.taglineY + 8, want: 7, ink: hexLum(WORDMARK.tagline_ink) },
    { name: "the address", x0: 780, x1: 1140, y0: WORDMARK.addressY - 20, y1: WORDMARK.addressY + 6, want: 4.5, ink: hexLum(WORDMARK.address_ink) },
  ];
  // the camera at the frame the card is complete and at the end: the window of the plate under each box
  for (const f of [CARD_COMPLETE, 5280, 5399]) {
    const cam = authoredAt(f).state;
    const d = dimAt(f);
    for (const r of rows) {
      const lums: number[] = [];
      for (let sy = r.y0; sy <= r.y1; sy += 3) {
        for (let sx = r.x0; sx <= r.x1; sx += 3) {
          const px = Math.min(info.width - 1, Math.max(0, Math.round(cam.panX + (sx - 960) / cam.M)));
          const py = Math.min(info.height - 1, Math.max(0, Math.round(cam.panY + (sy - 540) / cam.M)));
          const i = (py * info.width + px) * info.channels;
          const through = [data[i], data[i + 1], data[i + 2]].map((v, k) => (1 - d.overlayAlpha) * v + d.overlayAlpha * [dr, dg, db][k]);
          lums.push(lum(through[0], through[1], through[2]));
        }
      }
      lums.sort((a, b) => a - b);
      const bright = lums[Math.floor(lums.length * 0.95)];
      const cr = contrast(r.ink, bright);
      truthy(cr >= r.want, `${r.name} at ${f}: ${cr.toFixed(2)}:1 against the 95th percentile of the dimmed plate (want ${r.want}:1; the scrim is not counted)`);
    }
  }
  // the covers' light-ground crimson against a dim ground of 2 percent luminance is under 3:1: that is why the card uses the site's dark-scheme crimson
  truthy(contrast(hexLum(CRIMSON), 0.02) < 3, `the covers' crimson would be ${contrast(hexLum(CRIMSON), 0.02).toFixed(2)}:1 on a 2 percent ground`);
  truthy(contrast(hexLum(WORDMARK.x), 0.02) >= 4, "the card's x on the same ground");
});

// ---------- the end: hold and fade ----------

test("patch 20: S25 holds 1.5 s with the card complete and fades to black over the last 0.5 s, the last frame black", () => {
  eq(END.fadeFrom, 5370);
  eq(END.fadeTo, 5399);
  eq(SHOTS[25].from + 90, END.fadeFrom, "the hold is 90 frames, 1.5 s");
  eq(TOTAL - END.fadeFrom, 30, "the fade is 30 frames, 0.5 s");
  for (const f of [0, 4800, 5280, 5369]) eq(fadeAlpha(f), 0, `no fade at ${f}`);
  eq(fadeAlpha(5399), 1, "the last frame is black");
  eq(fadeAlpha(7000), 1);
  for (let f = 5370; f <= 5399; f++) truthy(fadeAlpha(f) >= fadeAlpha(f - 1), `the fade only darkens (${f})`);
  truthy(fadeAlpha(5371) < 0.01 && 1 - fadeAlpha(5398) < 0.01, "no corner at either end");
  // the card is finished for the whole hold (it is in from 5145)
  for (const f of [5280, 5330, 5369]) {
    const w = wordmarkAt(f);
    eq(w.tagline + w.address + w.fill, 3, `card complete at ${f}`);
  }
});

// ---------- the shots, the cues, the files ----------

test("patch 20: S24 and S25 have an overlay each, the registry draws it only inside the shot, and the files keep the determinism rules", () => {
  truthy(shotById("S24").overlay !== undefined && shotById("S25").overlay !== undefined);
  truthy(shotById("S24").overlay !== shotById("S23").overlay, "the labels are gone");
  for (const f of [4800, 5000, 5279]) eq(activeShot(f).overlay, shotById("S24").overlay);
  for (const f of [5280, 5369, 5399]) eq(activeShot(f).overlay, shotById("S25").overlay);
  for (const rel of ["src/fx/Dim.tsx", "src/fx/Wordmark.tsx", "src/fx/FadeOut.tsx", "src/config/dim.ts", "src/config/wordmark.ts", "src/shots/S24.tsx", "src/shots/S25.tsx", "src/light/Rig.tsx"]) {
    const src = code(rel);
    for (const bad of ["Math.random", "Date.now", "performance.now", "setTimeout", "setInterval", "requestAnimationFrame", "useFrame", "transition", "backdrop-filter", "animation:", "mix-blend-mode", "filter:", "localStorage"]) {
      eq(src.includes(bad), false, `${rel} has no ${bad}`);
    }
  }
  eq(read("src/shots/S24.tsx").includes('defineShot("S24"'), true);
  eq(read("src/shots/S25.tsx").includes('defineShot("S25"'), true);
});

test("patch 20: the cues follow the audio cue sheet: the lamp's swell on 4800, the wordmark's tone on 4860, the room tone's fade over the last second from 5340", () => {
  const cues = FILM_CUES.filter((c) => c.frame >= 4800);
  eq(JSON.stringify(cues), JSON.stringify([
    { frame: 4800, name: "lamp-swell" },
    { frame: 4860, name: "wordmark-tone" },
    { frame: 5340, name: "room-tone-fade" },
  ]));
  for (const c of cues) eq(c.frame % BEAT, 0, `${c.name} on a beat`);
  eq(TOTAL - 5340, 60, "the last second");
});

test("patch 20: the film's layers: the dim sits between the canvas and the overlay (so the wordmark is not dimmed) and has its own switch; the light rig drives the lamp and the strips from the dim", () => {
  const film = code("src/ReelFilm.tsx");
  truthy(film.indexOf("<Dim on={dim} />") > 0 && film.indexOf("<Dim on={dim} />") < film.indexOf("<OverlayLayer"), "Dim is drawn before (under) the overlay");
  truthy(film.indexOf("<OverlayLayer") < film.indexOf("<Grain"), "grain stays above the overlay");
  eq(/\bS[0-2]\d\b/.test(film), false, "ReelFilm.tsx names no shot");
  const rig = code("src/light/Rig.tsx");
  for (const piece of ["dimAt(frame)", "keyColourAt(frame, k.color)", "dim.keyGain", "dim.stripGain"]) truthy(rig.includes(piece), `Rig.tsx has ${piece}`);
  // plate:verify renders frame 0, where the dim draws nothing, with its own explicit switches (the test in film.test.ts holds the string): the plate stays untouched
  eq(dimAt(0).overlayAlpha, 0);
});
