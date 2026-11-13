// PATCH 13D: the shot strip's choices (which frame each cell shows, what its label says, where it sits), and the scrub check: the right
// shot is active at every frame of the film and on both sides of every boundary. Drawing needs a browser and is not tested here (the check
// for that is the Studio: `DevShotStrip` and the scrub of `ReelFilm`).
import fs from "node:fs";
import path from "node:path";
import { BAR, CUT_FRAMES, HEIGHT, SHOTS, TOTAL, WIDTH, shotAt, timecode } from "../src/config/timeline";
import { SHOT_REGISTRY, activeShot } from "../src/shots";
import { DEFAULT_COLUMNS, MAX_COLUMNS, MAX_OFFSET, MIN_CELL_W, MIN_COLUMNS, cellFrame, cellLabel, labelHeight, stripCells, stripLayout } from "../src/dev/shotStrip";
import { eq, test, throws, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
/** the source without its comments, so a rule about code is not tripped by a sentence in a comment */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const idOf = (n: number): string => `S${String(n).padStart(2, "0")}`;

// ---------- the cells ----------

test("shot strip: 26 cells, S00 to S25 in order, each the first frame of its shot by default", () => {
  const cells = stripCells();
  eq(cells.length, 26);
  cells.forEach((c, i) => {
    eq(c.index, i, `cell ${i} index`);
    eq(c.id, idOf(i), `cell ${i} id`);
    eq(c.frame, SHOTS[i].from, `${c.id} frame`);
    eq(c.into, 0, `${c.id} into the shot`);
    eq(c.from, SHOTS[i].from, `${c.id} from`);
    eq(c.to, SHOTS[i].to, `${c.id} to`);
    eq(c.name, SHOTS[i].name, `${c.id} name`);
    eq(c.regime, SHOTS[i].regime, `${c.id} regime`);
    eq(c.bars, (SHOTS[i].to - SHOTS[i].from + 1) / BAR, `${c.id} bars`);
  });
  eq(cells[0].frame, 0);
  eq(cells[25].frame, 5280);
  eq(stripCells(0).map((c) => c.frame).join(","), SHOTS.map((s) => s.from).join(","), "offset 0 is the shot starts of the table");
});

test("shot strip: a cell is the registry's shot, and for every offset its frame is inside its shot and the film agrees which shot it is", () => {
  eq(MAX_OFFSET, 479, "the longest shot (S23, S24) is 480 frames");
  for (let off = 0; off <= MAX_OFFSET; off++) {
    const cells = stripCells(off);
    cells.forEach((c, i) => {
      eq(c.frame, Math.min(SHOT_REGISTRY[i].from + off, SHOT_REGISTRY[i].to), `${c.id} at offset ${off}`);
      truthy(c.frame >= c.from && c.frame <= c.to, `${c.id} frame ${c.frame} is inside ${c.from}-${c.to}`);
      eq(shotAt(c.frame).id, c.id, `${c.id} at offset ${off}: the timeline's shot`);
      eq(activeShot(c.frame).id, c.id, `${c.id} at offset ${off}: the registry's shot`);
      eq(c.into, c.frame - c.from, `${c.id} into`);
    });
  }
  // the last frame of every shot, and a shorter shot cut at its own end
  eq(stripCells(MAX_OFFSET).map((c) => c.frame).join(","), SHOTS.map((s) => s.to).join(","), "offset 479 is the last frame of every shot");
  eq(stripCells(1000).length, 26, "a big offset still gives 26 cells (cut at each shot's last frame)");
});

test("shot strip: a cell is a pure function of its frame (the same call twice gives the same cells)", () => {
  eq(JSON.stringify(stripCells(30)), JSON.stringify(stripCells(30)));
  eq(JSON.stringify(stripCells(30, [...SHOT_REGISTRY].reverse().reverse())), JSON.stringify(stripCells(30)));
  truthy(JSON.stringify(stripCells(0)) !== JSON.stringify(stripCells(30)), "another offset, other frames");
});

test("shot strip: an offset that is not a whole number of 0 or more is refused, and the message says what was wrong", () => {
  throws(() => cellFrame(SHOTS[3], -1), "whole number of frames, 0 or more (got -1)");
  throws(() => cellFrame(SHOTS[3], 1.5), "(got 1.5)");
  throws(() => cellFrame(SHOTS[3], Number.NaN), "(got NaN)");
  throws(() => stripCells(-30), "(got -30)");
  eq(cellFrame({ from: 840, to: 959 }, 0), 840);
  eq(cellFrame({ from: 840, to: 959 }, 500), 959, "cut at the shot's last frame");
});

// ---------- the labels ----------

test("shot strip: every label says the shot id and the frame; hud adds the time, the regime, the length and the name", () => {
  for (const c of stripCells(0)) {
    const plain = cellLabel(c, false);
    eq(plain.title, `${c.id} · f${String(c.frame).padStart(4, "0")}`, `${c.id} title`);
    eq(plain.detail, null, `${c.id} no detail without hud`);
    eq(plain.name, null, `${c.id} no name without hud`);
    const hud = cellLabel(c, true);
    eq(hud.title, plain.title, `${c.id} the title does not change with hud`);
    eq(hud.name, c.name, `${c.id} name`);
    truthy(hud.detail !== null && hud.detail.includes(timecode(c.frame)) && hud.detail.includes(c.regime), `${c.id} detail "${hud.detail}"`);
  }
  eq(cellLabel(stripCells(0)[5], false).title, "S05 · f1080");
  eq(cellLabel(stripCells(0)[3], true).detail, "0:14.00 · R2 · 1 bar", "S03 is one bar");
  eq(cellLabel(stripCells(0)[0], true).detail, "0:00.00 · R1 · 2 bars");
  eq(cellLabel(stripCells(30)[5], false).title, "S05 · f1110 (+30)", "how far into the shot, when it is not the first frame");
  eq(cellLabel(stripCells(30)[3], false).title, "S03 · f0870 (+30)");
});

// ---------- the layout ----------

test("shot strip: for 1 to 13 columns (with and without hud) the grid, its labels and the title fit the page, in reading order, with no cell on another", () => {
  for (const hud of [false, true]) {
    for (let cols = 1; cols <= MAX_COLUMNS; cols++) {
      const L = stripLayout({ columns: cols, count: 26, labelH: labelHeight(hud) });
      truthy(L.columns >= cols, `${cols} columns asked, ${L.columns} used: never fewer`);
      if (cols >= MIN_COLUMNS) eq(L.columns, cols, `${cols} columns is what the Studio offers, so it is what is drawn`);
      truthy(L.cellW >= MIN_CELL_W, `${cols} columns, hud ${hud}: cells are ${L.cellW} px wide, not under ${MIN_CELL_W}`);
      eq(L.rows, Math.ceil(26 / L.columns), `${cols} columns: rows`);
      eq(L.cells.length, 26);
      truthy(Math.abs(L.cellH - (L.cellW * 9) / 16) < 1, `${cols} columns: ${L.cellW} x ${L.cellH} is 16:9 within a pixel`);
      L.cells.forEach((p, i) => {
        truthy(p.left >= 0 && p.left + L.cellW <= WIDTH, `${cols} columns, cell ${i}: inside the page across (${p.left}..${p.left + L.cellW})`);
        truthy(p.top >= 0 && p.top + L.cellH + L.labelH <= HEIGHT, `${cols} columns, hud ${hud}, cell ${i}: inside the page down (${p.top + L.cellH + L.labelH} of ${HEIGHT})`);
        if (i > 0) {
          const q = L.cells[i - 1];
          truthy(p.top > q.top || (p.top === q.top && p.left >= q.left + L.cellW), `${cols} columns: cell ${i} follows cell ${i - 1} in reading order`);
        }
      });
      // no two cells (with their labels) overlap
      for (let i = 0; i < 26; i++) {
        for (let j = i + 1; j < 26; j++) {
          const a = L.cells[i];
          const b = L.cells[j];
          const apart = a.left + L.cellW <= b.left || b.left + L.cellW <= a.left || a.top + L.cellH + L.labelH <= b.top || b.top + L.cellH + L.labelH <= a.top;
          truthy(apart, `${cols} columns: cells ${i} and ${j} overlap`);
        }
      }
    }
  }
});

test("shot strip: the default is 4 rows of 7 with cells big enough to judge a composition, and the title has room above the grid", () => {
  eq(DEFAULT_COLUMNS, 7);
  const L = stripLayout({ columns: DEFAULT_COLUMNS, count: 26, labelH: labelHeight(true) });
  eq(L.rows, 4);
  truthy(L.cellW >= 240, `cells are ${L.cellW} px wide`);
  truthy(L.cells[0].top >= 70, "room for the two title lines above the first row");
  eq(L.cells[0].left > 0 && L.cells[6].left + L.cellW < WIDTH, true, "centred across the page, inside the margins");
  eq(L.cells[7].left, L.cells[0].left, "the second row starts under the first");
});

test("shot strip: too few columns to fit 26 cells on the page are raised to the fewest that do, never lowered", () => {
  eq(MIN_COLUMNS, 4, "the Studio's smallest, the fewest that fit with hud on");
  for (const hud of [false, true]) {
    const h = labelHeight(hud);
    eq(stripLayout({ columns: 1, count: 26, labelH: h }).columns >= 2, true, "one column is raised");
    eq(stripLayout({ columns: 1, count: 26, labelH: h }).columns, stripLayout({ columns: stripLayout({ columns: 1, count: 26, labelH: h }).columns, count: 26, labelH: h }).columns, "and what it is raised to is itself a fit");
  }
  eq(stripLayout({ columns: 3, count: 26, labelH: labelHeight(true) }).columns, 4, "three columns with hud: raised to four");
  eq(stripLayout({ columns: 4, count: 26, labelH: labelHeight(true) }).columns, 4, "four with hud fits as it is");
  eq(stripLayout({ columns: MAX_COLUMNS, count: 26 }).columns, MAX_COLUMNS, "more columns than the minimum are left alone");
  eq(stripLayout({ columns: 20, count: 26 }).columns, 20, "even when the cells are narrow: more columns would only make them narrower");
});

test("shot strip: columns are cut to the cell count, and a layout without cells or columns is refused", () => {
  eq(stripLayout({ columns: 99, count: 3 }).columns, 3);
  eq(stripLayout({ columns: 99, count: 3 }).rows, 1);
  throws(() => stripLayout({ columns: 0, count: 26 }), "columns must be a whole number of 1 or more (got 0)");
  throws(() => stripLayout({ columns: 2.5, count: 26 }), "(got 2.5)");
  throws(() => stripLayout({ columns: 7, count: 0 }), "at least one cell");
  eq(labelHeight(true) > labelHeight(false), true, "hud makes the label taller");
});

// ---------- the scrub check ----------

test("scrub: the film is the shots of the table, and the readout (shotAt) and the overlay layer (activeShot) name the same shot on every frame", () => {
  let last = -1;
  let changes = 0;
  const changedAt: number[] = [];
  for (let f = 0; f < TOTAL; f++) {
    const a = shotAt(f);
    const b = activeShot(f);
    eq(b.id, a.id, `frame ${f}: the overlay layer and the readout agree`);
    truthy(f >= b.from && f <= b.to, `frame ${f} is inside ${b.id} (${b.from}-${b.to})`);
    const n = Number(b.id.slice(1));
    truthy(n >= last, `frame ${f}: the shot went back from S${last} to ${b.id}`);
    if (n !== last) {
      if (last >= 0) {
        changes++;
        changedAt.push(f);
        eq(n, last + 1, `frame ${f}: a shot was skipped`);
      }
      last = n;
    }
  }
  eq(last, 25, "the film ends in S25");
  eq(changes, 25, "25 cuts in 26 shots");
  eq(changedAt.join(","), CUT_FRAMES.join(","), "the shot changes on exactly the frames of the table's cuts, and nowhere else");
});

test("scrub: on both sides of every boundary (239/240, 479/480, ... 5279/5280) the right shot is active", () => {
  eq(CUT_FRAMES.length, 25);
  eq(CUT_FRAMES[0], 240, "the first cut");
  eq(CUT_FRAMES[1], 480);
  eq(CUT_FRAMES[24], 5280, "the last cut");
  CUT_FRAMES.forEach((cut, i) => {
    eq(cut % BAR, 0, `the cut at ${cut} is on a bar line`);
    eq(activeShot(cut - 1).id, idOf(i), `frame ${cut - 1}: the last frame of ${idOf(i)}`);
    eq(shotAt(cut - 1).id, idOf(i), `frame ${cut - 1} (readout)`);
    eq(activeShot(cut).id, idOf(i + 1), `frame ${cut}: the first frame of ${idOf(i + 1)}`);
    eq(shotAt(cut).id, idOf(i + 1), `frame ${cut} (readout)`);
    eq(SHOT_REGISTRY[i].to, cut - 1, `${idOf(i)} ends on the frame before the cut`);
    eq(SHOT_REGISTRY[i + 1].from, cut, `${idOf(i + 1)} starts on the cut`);
  });
  eq(activeShot(0).id, "S00");
  eq(activeShot(TOTAL - 1).id, "S25");
});

// ---------- the rules of the patch, as the source says them ----------

test("shot strip: DevShotStrip is registered after the film and every other dev composition, so ReelFilm stays the default", () => {
  const root = read("src/Root.tsx");
  const ids = [...root.matchAll(/<(?:Composition|Still)\s+id="([A-Za-z]+)"/g)].map((m) => m[1]);
  eq(ids[0], "ReelFilm", "the film is first");
  truthy(ids.includes("DevShotStrip"), "DevShotStrip is registered");
  eq(ids[ids.length - 1], "DevShotStrip", "and it is the last, after the film and the other dev sheets");
  eq(ids.filter((i) => i === "DevShotStrip").length, 1, "once");
  truthy(root.includes("schema={devShotStripSchema}") && root.includes("defaultProps={defaultDevShotStripProps}"), "with its schema and its defaults");
});

test("shot strip: one WebGL canvas for all 26 cells, drawn by the film's own camera rig and set, every cell a pure function of its frame", () => {
  const src = code("src/dev/DevShotStrip.tsx");
  eq((src.match(/<CameraRig\b/g) ?? []).length, 1, "one camera rig, so one canvas");
  eq(/<Stage\b|<ThreeCanvas\b/.test(src), false, "no canvas of its own besides the rig's");
  truthy(src.includes("<FilmSet") && src.includes("<OverlayLayer") && src.includes("FILM_CAMERA_KEYFRAMES"), "the film's set, overlay layer and camera keys");
  truthy(/<Freeze frame=\{c\.frame\}>/.test(src), "the overlay is drawn at the cell's frame");
  for (const bad of ["Math.random", "Date.now", "localStorage", "sessionStorage"]) eq(src.includes(bad), false, `DevShotStrip uses ${bad}`);
  const film = read("src/ReelFilm.tsx");
  truthy(/export const FilmSet\b/.test(film) && /export const OverlayLayer\b/.test(film), "ReelFilm exports the two layers the strip reuses");
  eq(/\bS[0-2]\d\b/.test(code("src/ReelFilm.tsx")), false, "ReelFilm still names no shot");
  eq(/\bS[0-2]\d\b/.test(code("src/dev/shotStrip.ts")) || /\bS[0-2]\d\b/.test(src), false, "and the strip names none either: it asks the registry");
});

test("shot strip: the schema has the props the patch names (offset, hud, columns) and the offset reaches the last frame of the longest shot", () => {
  const src = read("src/dev/DevShotStrip.tsx");
  truthy(/offset: z\.number\(\)\.int\(\)\.min\(0\)\.max\(MAX_OFFSET\)/.test(src), "offset 0 to MAX_OFFSET");
  truthy(/columns: z\.number\(\)\.int\(\)\.min\(MIN_COLUMNS\)\.max\(MAX_COLUMNS\)/.test(src), "columns MIN_COLUMNS to MAX_COLUMNS");
  truthy(/hud: z\.boolean\(\)/.test(src), "hud");
  truthy(/defaultDevShotStripProps: DevShotStripProps = \{ offset: 0, columns: DEFAULT_COLUMNS, hud: true/.test(src), "the default is the first frame of every shot");
  eq(MAX_COLUMNS, 13);
});
