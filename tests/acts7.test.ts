// PATCH 19: the shots S22-S23 (the pull back and truck to the right, the chair wipe that hides the set swap, the riser and its four labels): the camera 3960-4799
// against the audit, the wipe's cover frame by frame (no frame shows the swap), the labels (their words are the snapshot's, they never cover a book, one every two beats),
// the cues, the files. The pictures and the 60 fps look are for a person (see the notes of Patch 19).
import fs from "node:fs";
import path from "node:path";
import { BEAT, SHOTS } from "../src/config/timeline";
import { HERO_STATES, limitFor, stateOf } from "../src/config/camera";
import { BOOK_IDS } from "../src/config/books";
import { CHAIR_WIPE, WIPE_BAND_WIDTH, chairAlpha, chairBandAt, chairColour, chairCover, chairSeams } from "../src/config/chairWipe";
import { LABELS, LABEL_PLACE, CHIP_HEIGHT, chipWidthBound, labelFrame, labelText, type Rect } from "../src/config/labels";
import { bookPlateRects, labelsAt } from "../src/fx/labelLayout";
import { LEDGER, booksAt, getBookLocation } from "../src/config/ledger";
import { auditMotion } from "../src/camera/audit";
import { authoredAt, cameraAt } from "../src/camera/path";
import { clampView, PLATE_MATCH, photoToScreen } from "../src/plate/PlateFollow";
import { projectDesk } from "../src/plate/plateCamera";
import { riserBooksAt } from "../src/scene/Riser";
import { getBook, getRiserLabel } from "../src/data/select";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, activeShot, shotById } from "../src/shots";
import { eq, near, test, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const meets = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// ---------- the camera ----------

test("patch 19: S22 and S23 are on the table's frames, own their keys (on beats, no roll, no tilt, R2/4 then R4), and the film's camera ends on 4800", () => {
  eq(`${SHOTS[22].from}-${SHOTS[23].to}`, "3960-4799");
  eq(JSON.stringify(shotById("S22").camera.map((k) => k.frame)), JSON.stringify([4020, 4110, 4170, 4230, 4320]));
  eq(JSON.stringify(shotById("S23").camera.map((k) => k.frame)), JSON.stringify([4380, 4800]));
  for (const id of ["S22", "S23"]) for (const k of shotById(id).camera) {
    eq(k.frame % BEAT, 0, `${id} key ${k.frame} is on a beat`);
    eq(k.rollDeg, 0, `${id} key ${k.frame}: no roll`);
    eq(k.tiltDeg, 0, `${id} key ${k.frame}: no tilt`);
    truthy(k.regime === (k.frame >= 4380 ? "R4" : "R2/4"), `${id} key ${k.frame} regime ${k.regime}`);
  }
  eq(FILM_CAMERA_KEYFRAMES[FILM_CAMERA_KEYFRAMES.length - 1].frame, 4800, "the closing key is the first frame of S24");
  // S21's closing key on 3960 starts S22: the pull back is an ease in, in R2/4
  const k3960 = FILM_CAMERA_KEYFRAMES.find((k) => k.frame === 3960)!;
  eq(k3960.regime, "R2/4");
  eq(k3960.ease, "signatureIn");
  eq(authoredAt(3980).regime, "R2/4");
  eq(authoredAt(4500).regime, "R4");
});

test("patch 19: the views: the pile at 3960, the table's M 2.46 under the wipe, M 3.76 settled beside the riser, 5.9 percent more by 4800 at f/4", () => {
  near(authoredAt(3960).state.M, 4.63, 1e-9, "the table's start M");
  near(authoredAt(4170).state.M, 2.46, 1e-9, "the table's pull back");
  near(authoredAt(4380).state.M, 3.76, 1e-9, "the table's settle");
  near(authoredAt(4800).state.M, 3.98, 1e-9, "the table's end of the push");
  const push = authoredAt(4800).state.M / authoredAt(4380).state.M - 1;
  truthy(push > 0.055 && push < 0.065, `the push is the table's 6 percent: ${push}`);
  near(authoredAt(4170).state.focusCm, 90, 1e-9, "the table's focus 90 at the wide view");
  near(authoredAt(4380).state.focusCm, 50, 1e-9, "and 50 settled");
  near(authoredAt(4380).state.aperture, 2.8, 1e-9, "f/2.8 in S22");
  near(authoredAt(4800).state.aperture, 4, 1e-9, "f/4 in S23");
  eq(JSON.stringify(stateOf(shotById("S22").camera[2])), JSON.stringify(HERO_STATES.turn), "the wide view is HERO_STATES.turn");
  eq(JSON.stringify(stateOf(shotById("S23").camera[0])), JSON.stringify(HERO_STATES.riserIn));
  // the pull back is the only fall of M in S22 and the settle the only rise: M never turns round anywhere else
  let min = 99;
  let at = 0;
  for (let f = 3960; f <= 4800; f++) {
    const M = authoredAt(f).state.M;
    if (M < min) {
      min = M;
      at = f;
    }
  }
  eq(at, 4170, "the widest frame is the rest under the wipe");
  for (let f = 3961; f <= 4170; f++) truthy(authoredAt(f).state.M <= authoredAt(f - 1).state.M + 1e-12, `M only falls to 4170 (frame ${f})`);
  for (let f = 4172; f <= 4800; f++) truthy(authoredAt(f).state.M >= authoredAt(f - 1).state.M - 1e-12, `M only rises from 4171 (frame ${f})`);
});

test("patch 19: the audit is clean for frames 3960-4799 with no exception (EDGE included), sideways under 40 cm/s, M under 1.5 x a second, and the whole film has only the opening hold", () => {
  const r = auditMotion({ from: 3960, to: 4799, exceptions: [] });
  eq(r.findings.length, 0, JSON.stringify(r.findings));
  const lim = limitFor("R2/4");
  truthy(r.stats.peakLateralCmPerSec <= lim.lateralCmPerSec, `sideways ${r.stats.peakLateralCmPerSec} cm/s`);
  truthy(r.stats.peakMRatePerSec <= 1.5, `M rate ${r.stats.peakMRatePerSec}`);
  truthy(r.stats.peakPopFraction < 0.02, "no pop");
  truthy(r.stats.maxM <= limit4(), "M inside the budget of the regime");
  const all = auditMotion();
  eq(all.range.join("-"), "0-4799");
  eq(all.unexplained, 0, JSON.stringify(all.findings.filter((f) => !f.known)));
  eq(all.counts.STILL, 1, "only the documented opening hold");
  eq(all.counts.EDGE + all.counts.FAST + all.counts.DEEP + all.counts.POP + all.counts.LATE, 0);
});
const limit4 = (): number => limitFor("R2/4").maxM;

test("patch 19: the window never leaves the 40 px margin on any frame of S22-S23, the operator included", () => {
  for (let f = 3960; f < 4800; f++) {
    const c = cameraAt(f);
    truthy(!clampView(c.view, c.rollDeg).clamped, `frame ${f} is clamped by the margin rule`);
    eq(c.rollDeg, 0);
  }
});

test("patch 19: the window passes the chair: it is left of it before the wipe, level with its middle under it, and the riser is in the frame with room for the right-hand label by 4440", () => {
  const CHAIR = { x0: 740, x1: 872 };
  truthy(cameraAt(3960).view.cx < CHAIR.x0 - 200, "the pile view is far left of the chair");
  const wide = cameraAt(4170, { operator: false }).view;
  truthy(wide.cx > 600 && wide.cx < CHAIR.x1, `under the wipe the window is on the left of the chair's middle: ${wide.cx}`);
  const settled = cameraAt(4380, { operator: false }).view;
  truthy(settled.cx > CHAIR.x1 + 40, "settled, the window's middle is right of the chair");
  const rects = bookPlateRects();
  const rightEdge = photoToScreen(cameraAt(4440).view, rects["spherex-blink"].x1, 0).x;
  truthy(rightEdge + LABELS.leaderLen + chipWidthBound("spherex-blink") <= 1920 - LABELS.margin, `Vol. II's chip fits at 4440 (its book's right edge is on ${rightEdge})`);
});

// ---------- the wipe ----------

test("patch 19: the wipe covers every column of the frame from 4134 to 4206, and so the swap (4140-4199) and the arrival of the three books (4200) are never on screen", () => {
  for (let f = CHAIR_WIPE.coverFrom; f <= CHAIR_WIPE.coverTo; f++) truthy(chairCover(f, 1) >= 0.999999, `frame ${f} is covered: ${chairCover(f, 1)}`);
  const swap = LEDGER.find((r) => r.from === 4140)!;
  eq(`${swap.from}-${swap.to}`, "4140-4199", "the ledger's swap row");
  truthy(CHAIR_WIPE.coverFrom <= 4140 - 6 && CHAIR_WIPE.coverTo >= 4200 + 6, "6 frames of margin on each of the two changes");
  // the stills of the spec: every 10 frames from 4120 to 4220
  const table: string[] = [];
  for (let f = 4120; f <= 4220; f += 10) table.push(`${f}:${chairCover(f, 1).toFixed(3)}`);
  eq(table.slice(2, 9).every((t) => t.endsWith(":1.000")), true, `4140-4200 are covered: ${table.join(" ")}`);
  // the books really do change on those two frames
  eq(riserBooksAt(4139).length, 0);
  eq(riserBooksAt(4140).length, 1, "Immersive alone from 4140");
  eq(riserBooksAt(4199).length, 1);
  eq(riserBooksAt(4200).length, 4, "all four from 4200");
  eq(booksAt(4139).pile.length, 1);
  eq(booksAt(4140).swap.length, 3);
});

test("patch 19: the wipe is a soft band, on the picture only from 4050 to 4290, never a hard edge, a pure function of the frame, and the speed at its middle is slow", () => {
  eq(chairBandAt(4049), null);
  eq(chairBandAt(4291), null);
  truthy(chairBandAt(4050) !== null && chairBandAt(4290) !== null);
  eq(chairAlpha(4049, 960), 0);
  near(chairAlpha(4050, 1920), 0, 1e-9, "nothing on the picture on the first frame");
  near(chairAlpha(4290, 0), 0, 1e-9, "nothing on the picture on the last");
  // no column changes by more than a fifth from one frame to the next, except during the swing at the two ends (the soft edge crosses the frame in 36 frames or more)
  let worst = 0;
  for (let f = 4051; f <= 4290; f++) for (let x = 0; x <= 1920; x += 40) worst = Math.max(worst, Math.abs(chairAlpha(f, x) - chairAlpha(f - 1, x)));
  truthy(worst < 0.2, `no column jumps: ${worst}`);
  // along the frame the alpha is a smooth curve: no step between columns 4 px apart
  for (const f of [4080, 4100, 4120, 4230, 4250]) for (let x = 4; x <= 1920; x += 4) truthy(Math.abs(chairAlpha(f, x) - chairAlpha(f, x - 4)) < 0.03, `frame ${f} column ${x}`);
  eq(JSON.stringify(chairAlpha(4100, 700)), JSON.stringify(chairAlpha(4100, 700)));
  const a = chairBandAt(4165)!;
  const b = chairBandAt(4166)!;
  truthy(a.xL - b.xL < 7, `the band drifts at under 7 px a frame at its middle: ${a.xL - b.xL}`);
  near(WIPE_BAND_WIDTH, 3060, 1, "the band's width");
  truthy(chairSeams(4170).length > 0 && chairSeams(4170).every((s) => s.opacity > 0.4), "the seams show while the frame is covered");
});

test("patch 19: the three books that leave and the riser that arrives are covered or off the frame on every frame the wipe is leaving", () => {
  // the desk's left part, where the pile and the two books beside it were (X -48 to 8, Zd 3 to 34, 8 cm high): in the frame only while the wipe still covers it
  const pts: { x: number; y: number }[] = [];
  for (const X of [-48, 8]) for (const Zd of [3, 34]) for (const Y of [0, 8]) pts.push(projectDesk(PLATE_MATCH, X, Y, Zd));
  const x0 = Math.min(...pts.map((p) => p.x));
  const x1 = Math.max(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y));
  const y1 = Math.max(...pts.map((p) => p.y));
  for (let f = 4140; f <= 4800; f++) {
    const v = cameraAt(f).view;
    const a = photoToScreen(v, x0, y0);
    const b = photoToScreen(v, x1, y1);
    for (let x = Math.max(0, Math.floor(a.x)); x <= Math.min(1920, Math.ceil(b.x)); x += 4) {
      truthy(f >= 4291 ? false : chairAlpha(f, x) >= 0.999, `frame ${f}: the empty place of the pile shows at column ${x}`);
    }
  }
  // before 4134 the pile is still there (the ledger) and the wipe may be partial; the riser is not drawn before 4140
  eq(getBookLocation("mini-me", 4139), "beside");
  eq(riserBooksAt(4133).length, 0);
});

test("patch 19: the leather is dark and brown-black, with a warmer brown where the edge is thin", () => {
  const lum = (c: number[]): number => (c[0] + c[1] + c[2]) / 3;
  const body = chairColour(4170, 960);
  truthy(lum(body) < 40 && body[0] >= body[2], `the body is a dark brown-black: ${body}`);
  const edge = chairColour(4100, 100);
  truthy(chairAlpha(4100, 100) < 0.5, "a thin part of the edge");
  truthy(edge[0] - edge[2] > body[0] - body[2], `the thin edge is browner than the body: ${edge} against ${body}`);
});

// ---------- the labels ----------

test("patch 19: the words of the labels are the snapshot's (title, year and status, `Vol.` and the numeral), in the site's order, and nothing is typed in the component", () => {
  BOOK_IDS.forEach((id, i) => {
    const b = getBook(id);
    const t = labelText(id);
    eq(t.name, b.title);
    eq(t.sub, `${b.year} - ${b.status.replace(/-/g, " ")}`);
    eq(t.volume, `Vol. ${["I", "II", "III", "IV"][i]}`);
    eq(JSON.stringify(t), JSON.stringify({ volume: `Vol. ${getRiserLabel(id).volumeNumeral}`, name: getRiserLabel(id).title, sub: `${getRiserLabel(id).year} - ${getRiserLabel(id).statusText}` }));
  });
  eq(labelText("mini-me").sub.endsWith("coming soon"), true, "Mini Me stays coming soon");
  const src = read("src/fx/Labels.tsx") + read("src/config/labels.ts") + read("src/fx/labelLayout.ts");
  for (const id of BOOK_IDS) for (const w of [getBook(id).title, getBook(id).status, String(getBook(id).year)]) eq(src.includes(`"${w}"`), false, `"${w}" is not typed in the label sources`);
  truthy(read("src/fx/Labels.tsx").includes("labelText("), "the component reads the words from labelText");
});

test("patch 19: one label per book from 4380, two beats apart, in the site's order; nothing before 4380; all four by 4560 and they stay to the fade", () => {
  eq(JSON.stringify(BOOK_IDS.map(labelFrame)), JSON.stringify([4380, 4440, 4500, 4560]));
  for (const id of BOOK_IDS) eq(labelFrame(id) % BEAT, 0, `${id} on a beat`);
  const shown = (f: number): number => labelsAt(f).filter((l) => l.chipAlpha > 0.5 && l.fade > 0.99).length;
  eq(shown(4379), 0);
  eq(labelsAt(4379).every((l) => l.dotScale === 0 && l.leaderDraw === 0 && l.chipAlpha === 0), true, "nothing drawn before 4380");
  eq(shown(4430), 1);
  eq(shown(4490), 2);
  eq(shown(4550), 3);
  eq(shown(4620), 4);
  eq(shown(4739), 4);
  // inside a label: the dot first, then the leader, then the chip (each at least 6 frames)
  const at = (f: number) => labelsAt(f)[0];
  truthy(at(4384).dotScale > 0 && at(4384).chipAlpha === 0, "the dot comes first");
  truthy(at(4400).leaderDraw > 0.5 && at(4400).chipAlpha < 0.5);
  near(at(4430).chipAlpha, 1, 1e-9);
  near(at(4430).leaderDraw, 1, 1e-9);
  truthy(LABELS.dotFrames >= 6 && LABELS.leaderTo - LABELS.leaderFrom >= 6 && LABELS.chipTo - LABELS.chipFrom >= 6, "nothing under 6 frames");
  // the fade: the labels are gone by the end of S23
  truthy(labelsAt(4799).every((l) => l.fade < 0.01), "faded out on the last frame");
  truthy(labelsAt(4739).every((l) => l.fade === 1), "and not before 4740");
});

test("patch 19: a label never covers a book: on every frame of S23 no chip meets any of the four covers, no leader crosses another book, and every chip is 40 px inside the frame", () => {
  let worst = 1e9;
  for (let f = 4320; f < 4800; f++) {
    const ls = labelsAt(f);
    for (const l of ls) {
      for (const o of ls) {
        truthy(!meets(l.chip, o.book), `frame ${f}: the chip of ${l.id} meets the cover of ${o.id}`);
        if (o.id !== l.id) {
          const seg: Rect = { x0: Math.min(l.dot.x, l.leaderEnd.x), x1: Math.max(l.dot.x, l.leaderEnd.x), y0: l.dot.y - 0.5, y1: l.dot.y + 0.5 };
          truthy(!meets(seg, o.book), `frame ${f}: the leader of ${l.id} crosses ${o.id}`);
        }
      }
      truthy(l.dot.x > l.book.x0 && l.dot.x < l.book.x1 && l.dot.y > l.book.y0 && l.dot.y < l.book.y1, `frame ${f}: the dot of ${l.id} is on its book`);
      // a chip is only on screen from its own frame; before that the camera is still settling and its place may be off the frame
      if (f >= labelFrame(l.id)) worst = Math.min(worst, l.chip.x0, 1920 - l.chip.x1, l.chip.y0, 1080 - l.chip.y1);
      eq(l.side, LABEL_PLACE[l.id].side);
    }
  }
  truthy(worst >= LABELS.margin, `the nearest a chip comes to the frame's edge is ${worst} px`);
  truthy(CHIP_HEIGHT > LABELS.titlePx + LABELS.subPx);
});

test("patch 19: the real widths of the label text (measured in the CMU fonts) are inside the bound the layout uses, and the sizes are the spec's", () => {
  // measured with the font files: the longest first line, `Vol. II  SPHEREx Blink Comparator`, is 427.8 px at 26 px; the mono line is 0.525 em a character
  const measured: Record<string, number> = { "mini-me": 183.5, "spherex-blink": 427.8, minilocker: 235.4, "next-inc-immersive": 337.5 };
  for (const id of BOOK_IDS) truthy(chipWidthBound(id) >= measured[id] + 2 * LABELS.padX, `${id}: bound ${chipWidthBound(id)} against ${measured[id]}`);
  eq(LABELS.leaderPx, 0.75);
  eq(LABELS.dotPx, 5);
  eq(LABELS.titlePx, 26);
  eq(LABELS.subPx, 18);
  eq(LABELS.chip, "#F5F0E6");
  eq(LABELS.chipAlpha, 0.88);
});

test("patch 19: the highlight sweep passes once over each book as its label arrives, inside the cover that shows, and is gone before the next label", () => {
  for (const id of BOOK_IDS) {
    const t0 = labelFrame(id);
    const at = (f: number) => labelsAt(f).find((l) => l.id === id)!;
    eq(at(t0 - 1).sweepAlpha, 0, "nothing before the label");
    eq(at(t0 + 1).sweep > 0 && at(t0 + 1).sweepAlpha > 0, true, "it starts with the label");
    truthy(at(t0 + LABELS.sweepFrames / 2).sweepAlpha > LABELS.sweepAlpha * 0.99, "strongest in the middle");
    eq(at(t0 + LABELS.sweepFrames).sweepAlpha, 0, "gone");
    eq(at(t0 + LABELS.sweepFrames + 50).sweepAlpha, 0, "and does not come back");
  }
  truthy(LABELS.sweepFrames < 2 * LABELS.gap, "the sweep of one book is over before the next label's has gone far");
  truthy(LABELS.sweepAlpha <= 0.25, "soft");
  const r = bookPlateRects();
  truthy(r["mini-me"].y1 - r["mini-me"].y0 > 80 && r.minilocker.y1 - r.minilocker.y0 < 30, "the lower books show whole, the upper books only their strip");
});

// ---------- the cues and the files ----------

test("patch 19: the cues: chair-pass on 4140 and a label-tick on each label's frame (guide 08's sheet), in order, on beats", () => {
  eq(shotById("S22").cues.map((c) => `${c.frame}:${c.name}`).join(","), "4140:chair-pass");
  eq(shotById("S23").cues.map((c) => `${c.frame}:${c.name}`).join(","), "4380:label-tick,4440:label-tick,4500:label-tick,4560:label-tick");
  for (const c of FILM_CUES.filter((c) => c.frame >= 3960 && c.frame < 4800)) eq(c.frame % BEAT, 0, `${c.name} on ${c.frame}`);
  const audio = read("docs/guide/08-audio.md");
  truthy(audio.includes("4380, 4440, 4500, 4560"), "the audio guide's frames");
  truthy(audio.includes("4140-4200"), "and the chair's");
});

test("patch 19: S22 and S23 have an overlay each, the registry draws it only inside the shot, and the files keep the determinism rules", () => {
  truthy(shotById("S22").overlay !== undefined && shotById("S23").overlay !== undefined);
  for (const f of [3960, 4100, 4319]) eq(activeShot(f).overlay, shotById("S22").overlay);
  for (const f of [4320, 4500, 4799]) eq(activeShot(f).overlay, shotById("S23").overlay);
  eq(activeShot(4800).overlay, undefined, "the labels are not drawn in S24");
  for (const rel of ["src/fx/ChairWipe.tsx", "src/fx/Labels.tsx", "src/fx/labelLayout.ts", "src/config/chairWipe.ts", "src/config/labels.ts", "src/shots/S22.tsx", "src/shots/S23.tsx"]) {
    const src = read(rel);
    for (const bad of ["Math.random", "Date.now", "setTimeout", "setInterval", "requestAnimationFrame", "useFrame", "transition", "backdrop-filter", "animation:", "mix-blend-mode"]) eq(src.includes(bad), false, `${rel} has no ${bad}`);
  }
  eq(read("src/shots/S22.tsx").includes("defineShot(\"S22\""), true);
  eq(read("src/shots/S23.tsx").includes("defineShot(\"S23\""), true);
});

test("patch 19: the ledger is untouched: the swap rows are the guide's, and the riser stands from the swap to the end", () => {
  eq(JSON.stringify(LEDGER.slice(-3).map((r) => `${r.from}-${r.to}`)), JSON.stringify(["3840-4139", "4140-4199", "4200-5399"]));
  for (let f = 4200; f < 4800; f += 40) eq(riserBooksAt(f).length, 4, `four books at ${f}`);
});
