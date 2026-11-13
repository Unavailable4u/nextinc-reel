// THE ELEVEN PAGE PLANNERS (Patch 09, guide 04 section 4). One function per page type: data and tokens in, a `PagePlan` out. Pure: nothing here
// touches a canvas, so where everything stands, what is read, how big the codes are and what did not fit can all be tested in Node.
//
// ORDER OF OPERATIONS. The ops list is drawn in order: the grain first (over the paper), then the page's own marks. A mounted print is a
// group: shadow, paper, hairline, picture, mounts, and whatever sits on it (the film page's play mark), all turned by the same angle.
//
// WHAT A READER MUST BE ABLE TO READ (guide 07 section 6). A string of at most `PAGE.maxReadableWords` words has the role "read": its colour
// reads on the paper at `PAGE.minContrast` to 1 and it is drawn at full alpha. Longer strings (a summary, a stated limit, a paragraph) are
// "texture": real sentences of the data, set small, which the film shows but does not ask anyone to read.

import { PAGE, PAGE_BACK_TEXT, PAGE_H, PAGE_TEXT, PAGE_W, TITLE_BREAK } from "../../config/pages";
import { figureNumbers, pageAt, sideOf, type PageSpec } from "../../config/pageSpecs";
import type { BookId } from "../../config/books";
import { fnv1a } from "../../lib/hash";
import { endpaperPattern } from "../patterns";
import { QR_DARK, QR_LIGHT, QR_MIN_CODE_CM, qrBox, qrCmds, qrMatrix } from "../qr";
import { circleCmds, rectCmds, roundRectCmds } from "../svgPath";
import { balancedWrap, fitSize, layoutTitle, TITLE_FACE, wrapWords, type TitlePartIn, type TypeFace } from "../typography";
import {
  addCentred,
  addGlyphs,
  addPublisherX,
  addShape,
  addStroke,
  addText,
  baselineIn,
  BOLD,
  CRIMSON,
  emitParagraph,
  flowParagraphs,
  INK,
  ITALIC,
  layoutParagraph,
  makeCtx,
  makeFrame,
  MONO,
  readableOn,
  ROMAN,
  turned,
  X_ASPECT,
  type PageCtx,
  type ParaOpts,
} from "./common";
import type { PageData } from "./data";
import { addPrint } from "./print";
import type { PagePlan, PageQr, PageTokens, Rect, TextRole } from "./types";

const FULL: Rect = { x: 0, y: 0, w: PAGE_W, h: PAGE_H };

export const wordsOf = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** "read" when the string is short enough for the viewer to read, else "texture" (see the top of the file). */
export const roleOf = (text: string): TextRole => (wordsOf(text) <= PAGE.maxReadableWords ? "read" : "texture");

// ---------------------------------------------------------------------------------------------------------------------------
// shared pieces
// ---------------------------------------------------------------------------------------------------------------------------

interface TitleAt {
  /** the first line's baseline, or the middle of the block */
  y: number;
  anchor: "baseline" | "middle";
  size: number;
  breakLines: boolean;
}

/** The title of the book as set on the cover (D-08), centred on the page's text area. Returns the baseline of its last line. */
function addTitle(c: PageCtx, at: TitleAt): number {
  const T = PAGE.title;
  const parts: TitlePartIn[] = c.data.title.map((p) => ({ text: p.text, style: p.style }));
  const lay = layoutTitle(parts, c.measure, { size: at.size, secondSize: at.size * T.secondRatio, maxWidth: c.frame.area.w, breakAtStyleChange: at.breakLines, lineHeight: T.lineHeight });
  const top = at.anchor === "baseline" ? at.y - lay.lines[0].baseline : at.y - lay.height / 2;
  for (const line of lay.lines) {
    const x0 = c.frame.cx - line.width / 2;
    for (const run of line.runs) {
      addText(c, run.text, x0 + run.x, top + line.baseline, TITLE_FACE[run.style], run.size, { fill: run.style === "crimson" ? readableOn(CRIMSON, c.paper) : INK, role: roleOf(run.text) });
    }
  }
  return top + lay.height;
}

/** A label and a caption centred under a print: `FIG. 1` in small caps, then the caption in italics, one line (or two, balanced). Returns the bottom. */
function addCaption(c: PageCtx, label: string, caption: string, top: number): number {
  const labelPx = c.frame.pt(PAGE.type.captionPt * 0.8);
  const capPx = c.frame.pt(PAGE.type.captionPt);
  let y = top + labelPx;
  addGlyphs(c, label, c.frame.cx, y, ROMAN, labelPx, { trackingEm: 0.16, smallCaps: true, centre: true });
  y += capPx * 1.7;
  const fit = fitSize(caption, c.measure, ITALIC, c.frame.area.w, capPx, capPx * 0.72);
  if (fit.fits) {
    addCentred(c, caption, c.frame.cx, y, ITALIC, fit.size, { role: roleOf(caption) });
    return y + fit.size * 0.5;
  }
  const lines = balancedWrap(caption, c.measure, { ...ITALIC, size: capPx * 0.85 }, c.frame.area.w);
  lines.forEach((ln, i) => addCentred(c, ln, c.frame.cx, y + i * capPx * 1.3, ITALIC, capPx * 0.85, { role: roleOf(caption) }));
  return y + (lines.length - 1) * capPx * 1.3 + capPx * 0.4;
}

/** The code of `url`, `codeCm` wide (the modules; the quiet zone is added), centred on (cx, cy). Records it in the plan. */
function addQr(c: PageCtx, url: string, cx: number, cy: number, codeCm: number): PageQr {
  const m = qrMatrix(url);
  const box = qrBox(m, cx, cy, codeCm * c.frame.ppc);
  addShape(c, rectCmds(box.quiet.x, box.quiet.y, box.quiet.w, box.quiet.h), QR_LIGHT, 1, "qr-quiet");
  addShape(c, qrCmds(m, box.code.x, box.code.y, box.module), QR_DARK, 1, "qr-modules");
  const side = box.code.w / c.frame.ppc;
  if (side < QR_MIN_CODE_CM - 1e-9) c.notes.push(`the code of "${url}" is ${side.toFixed(2)} cm on the paper, under the ${QR_MIN_CODE_CM} cm of guide 04`);
  const qr: PageQr = { url, version: m.version, module: box.module, code: box.code, quiet: box.quiet };
  c.qr.push(qr);
  return qr;
}

/** The side of the light square (modules plus quiet zone) of a code of `codeCm`, px. */
function quietSide(c: PageCtx, url: string, codeCm: number): number {
  const m = qrMatrix(url);
  const code = codeCm * c.frame.ppc;
  return code + (2 * 4 * code) / m.size;
}

const bodyOpts = (c: PageCtx, extra: Partial<ParaOpts> = {}): ParaOpts => {
  const size = c.frame.pt(PAGE.type.bodyPt);
  return { width: c.frame.area.w, size, lineH: size * PAGE.bodyLineHeight, justified: true, ...extra };
};

// ---------------------------------------------------------------------------------------------------------------------------
// the planners
// ---------------------------------------------------------------------------------------------------------------------------

/** P-END: the endpaper's pattern over the whole page, on the endpaper's ground, nothing else. */
function planEnd(c: PageCtx): void {
  const pat = endpaperPattern({ slug: c.data.pattern.slug, motif: c.data.pattern.motif, palette: c.data.pattern.palette, ground: c.spec.colors.endpaper });
  c.ops.push({ kind: "pattern", spec: pat, tilePx: Math.round(c.frame.cm(PAGE.endpaper.tileCm)), rect: FULL });
}

/** P-HALF: the title only, small, centred. */
function planHalf(c: PageCtx): void {
  addTitle(c, { y: PAGE_H * PAGE.half.at, anchor: "baseline", size: c.frame.pt(PAGE.half.pt), breakLines: false });
}

/** P-BLANK: the back of a leaf. Behind the half-title's leaf, the half-title shows through, mirrored, very faint. */
function planBlank(c: PageCtx): void {
  const prev = pageAt(c.id, c.index - 1);
  if (!prev || prev.type !== "P-HALF") return;
  const size = c.frame.pt(PAGE.half.pt);
  const lay = layoutTitle(
    c.data.title.map((p) => ({ text: p.text, style: p.style })),
    c.measure,
    { size, maxWidth: c.frame.area.w },
  );
  // where the title stood on the right-hand page that is the other side of this leaf, then mirrored across the leaf
  const frontCx = makeFrame("right").cx;
  const line = lay.lines[0];
  const baseline = PAGE_H * PAGE.half.at;
  for (const run of line.runs) {
    const frontX = frontCx - line.width / 2 + run.x;
    addText(c, run.text, PAGE_W - frontX, baseline, TITLE_FACE[run.style], run.size, { fill: INK, alpha: 0.055, role: "mark", mirror: true });
  }
}

/** P-TITLE: the title large, the summary as the subtitle, the authors, and a foot with the crimson x, the company and the year. */
function planTitle(c: PageCtx): void {
  const T = PAGE.title;
  const f = c.frame;
  const bottom = addTitle(c, { y: PAGE_H * T.at, anchor: "middle", size: f.pt(PAGE.type.displayPt), breakLines: TITLE_BREAK[c.id] });

  // the subtitle: one line at the largest size that fits, else two balanced lines
  const subPx = f.pt(T.subtitle.pt);
  const sum = c.data.summary;
  const fit = fitSize(sum, c.measure, ITALIC, f.area.w, subPx, f.pt(T.subtitle.minPt));
  let y = bottom + T.subtitle.gapEm * subPx;
  const role = roleOf(sum);
  if (fit.fits) {
    addCentred(c, sum, f.cx, y, ITALIC, fit.size, { role });
  } else {
    const px = f.pt(T.subtitle.twoLinePt);
    balancedWrap(sum, c.measure, { ...ITALIC, size: px }, f.area.w).forEach((ln, i) => addCentred(c, ln, f.cx, y + i * px * T.subtitle.lineHeight, ITALIC, px, { role }));
  }

  // the authors, small caps, one under another
  const A = T.authors;
  const aPx = f.pt(A.pt);
  y = PAGE_H * A.at;
  for (const name of c.data.authors) {
    addGlyphs(c, name, f.cx, y, ROMAN, aPx, { trackingEm: A.trackingEm, smallCaps: true, centre: true }, { role: roleOf(name) });
    y += aPx * A.lineHeight;
  }

  // the foot
  const Fo = T.foot;
  const xW = f.cm(Fo.xCm);
  const xCy = PAGE_H * Fo.xAt;
  addPublisherX(c, f.cx, xCy, xW);
  const nPx = f.pt(Fo.namePt);
  const yPx = f.pt(Fo.yearPt);
  const nameY = xCy + (xW * X_ASPECT) / 2 + Fo.nameGapEm * nPx * 0.8;
  addCentred(c, c.data.company.name, f.cx, nameY, ROMAN, nPx);
  addCentred(c, String(c.data.year), f.cx, nameY + Fo.yearGapEm * yPx, ROMAN, yPx);
}

/** P-COLO: a heading, the facts as ruled rows, the stated limit (if the book states one), the affiliation, and the web column of the links spread. */
function planColophon(c: PageCtx, spec: PageSpec): void {
  const K = PAGE.colo;
  const f = c.frame;
  const a = f.area;
  const col = c.data.colophon;
  const headPx = f.pt(K.headingPt);
  addText(c, PAGE_TEXT.colophon, a.x, PAGE_H * K.top, BOLD, headPx);

  const valPx = f.pt(K.valuePt);
  const labelPx = f.pt(K.labelPt);
  const lineH = valPx * PAGE.bodyLineHeight;
  const pad = (K.rowGapEm * valPx) / 2;
  const valX = a.x + a.w * K.labelShare;
  const valW = a.x + a.w - valX;
  const rows: { label: string; value: string; face: TypeFace }[] = [
    { label: PAGE_TEXT.status, value: col.statusText, face: MONO },
    { label: PAGE_TEXT.year, value: String(col.year), face: ROMAN },
    { label: PAGE_TEXT.category, value: col.category, face: ROMAN },
    { label: PAGE_TEXT.tags, value: col.tags.join(", "), face: ROMAN },
  ];
  let y = PAGE_H * K.top + headPx * 0.9;
  for (const r of rows) {
    addStroke(c, [{ t: "M", x: a.x, y }, { t: "L", x: a.x + a.w, y }], INK, 2, K.ruleAlpha);
    const lines = wrapWords(r.value, c.measure, { ...r.face, size: valPx }, valW);
    const base = baselineIn(y + pad, lineH, valPx);
    addGlyphs(c, r.label, a.x, base, ROMAN, labelPx, { trackingEm: 0.12, smallCaps: true });
    lines.forEach((ln, i) => addText(c, ln, valX, base + i * lineH, r.face, valPx, { role: roleOf(r.value) }));
    y += 2 * pad + lines.length * lineH;
  }
  addStroke(c, [{ t: "M", x: a.x, y }, { t: "L", x: a.x + a.w, y }], INK, 2, K.ruleAlpha);

  if (col.limit) {
    const o: ParaOpts = { width: a.w, size: f.pt(K.limitPt), lineH: f.pt(K.limitPt) * PAGE.bodyLineHeight, face: ITALIC };
    emitParagraph(c, layoutParagraph(c, col.limit, o), a.x, y + f.cm(1.1), o, { role: roleOf(col.limit) });
  }

  if (spec.web) {
    const wy = PAGE_H * K.webAt;
    addText(c, PAGE_TEXT.readOnTheWeb, a.x, wy, BOLD, f.pt(K.webHeadingPt));
    const fit = fitSize(c.data.web, c.measure, MONO, a.w, f.pt(PAGE.type.monoPt), f.pt(PAGE.link.addressMinPt));
    addText(c, c.data.web, a.x, wy + f.pt(K.webHeadingPt) * 1.9, MONO, fit.size, { role: roleOf(c.data.web) });
    if (!fit.fits) c.notes.push(`the web address "${c.data.web}" is wider than the text area even at ${PAGE.link.addressMinPt} pt`);
  }

  // the affiliation closes the page
  const affPx = f.pt(K.affiliationPt);
  const aff = c.data.company.affiliation;
  const affLines = balancedWrap(aff, c.measure, { ...ITALIC, size: affPx }, a.w);
  const affLead = affPx * 1.5;
  const lastBase = a.y + a.h;
  affLines.forEach((ln, i) => addCentred(c, ln, f.cx, lastBase - (affLines.length - 1 - i) * affLead, ITALIC, affPx, { role: roleOf(aff), alpha: 1 }));
}

/** P-ABST: the lead-in and the first ~55 words of the abstract with a three-line drop cap; or, as a continuation, whole sentences filling the page. */
function planAbstract(c: PageCtx, spec: PageSpec): void {
  const K = PAGE.abst;
  const f = c.frame;
  const a = f.area;
  const o = bodyOpts(c, { dropLines: spec.continuation ? 0 : K.dropCapLines });
  if (spec.continuation) {
    const top = Math.max(a.y, PAGE_H * K.continuationTop);
    const out = flowParagraphs(c, c.data.continuation, a.x, top, a.y + a.h, o, o.lineH * K.paragraphGapLines);
    if (out.sentences === 0) c.notes.push("the continuation page has no text to set (the data has nothing after the first paragraph)");
    return;
  }
  const leadPx = f.pt(K.leadPt);
  const leadY = PAGE_H * K.leadAt;
  addGlyphs(c, PAGE_TEXT.abstract, a.x, leadY, ROMAN, leadPx, { trackingEm: K.leadTrackingEm, smallCaps: true });
  const top = leadY + K.leadGapLines * o.lineH;
  const lay = layoutParagraph(c, c.data.abstractFirst, o);
  if (top + lay.height > a.y + a.h) c.notes.push("the abstract does not fit the page");
  emitParagraph(c, lay, a.x, top, o);
}

/** P-FIG: one mounted print under the top margin, a label and a caption under it. */
function planFigure(c: PageCtx): void {
  const fig = c.data.figure;
  if (!fig) {
    c.notes.push("a figure page for a book with no figure");
    return;
  }
  const f = c.frame;
  const top = PAGE_H * PAGE.fig.top;
  const capRoom = f.cm(3);
  const pr = addPrint(c, { file: fig.file, key: `${c.id}/${fig.file}`, cx: f.cx, top, maxW: f.area.w * PAGE.print.maxWidthShare, maxH: f.area.y + f.area.h - top - capRoom });
  const n = figureNumbers(c.id)[c.index];
  addCaption(c, `${PAGE_TEXT.figure} ${n}`, fig.caption, pr.bottom + f.cm(PAGE.print.captionGapCm));
}

/** P-GAL: one to three prints, one under another, each with its label and caption; a `block` page ends with real body text of the book. */
function planGallery(c: PageCtx, spec: PageSpec): void {
  const f = c.frame;
  const a = f.area;
  const shots = (spec.shots ?? []).map((i) => {
    const s = c.data.shots[i];
    if (!s) throw new Error(`pages: ${c.id} page ${c.index} names screenshot ${i}, the book has ${c.data.shots.length}`);
    return s;
  });
  if (shots.length < 1 || shots.length > 3) throw new Error(`pages: a gallery page holds 1 to 3 screenshots, ${c.id} page ${c.index} has ${shots.length}`);
  const body = bodyOpts(c);
  const blockH = spec.block ? PAGE.gal.blockMaxLines * body.lineH + f.cm(1) : 0;
  const top0 = a.y + PAGE_H * PAGE.gal.top;
  const room = a.y + a.h - top0 - blockH;
  const gap = f.cm(PAGE.print.slotGapCm);
  const capH = f.pt(PAGE.type.captionPt) * 3.6 + f.cm(PAGE.print.captionGapCm);
  const slotH = (room - (shots.length - 1) * gap) / shots.length;
  const first = figureNumbers(c.id)[c.index];
  let y = top0;
  shots.forEach((s, k) => {
    const opt = { file: s.file, maxW: a.w * PAGE.print.maxWidthShare, maxH: slotH - capH };
    const pr = addPrint(c, { ...opt, key: `${c.id}/${s.file}`, cx: f.cx, top: y });
    const bottom = addCaption(c, `${PAGE_TEXT.figure} ${first + k}`, s.caption, pr.bottom + f.cm(PAGE.print.captionGapCm));
    y = bottom + gap;
  });
  if (spec.block) {
    const top = y - gap + f.cm(0.8);
    const limit = Math.min(a.y + a.h, top + PAGE.gal.blockMaxLines * body.lineH);
    const out = flowParagraphs(c, c.data.texture, a.x, top, limit, body, body.lineH * PAGE.abst.paragraphGapLines);
    if (out.sentences === 0) c.notes.push("the gallery page's text block has no room for a sentence");
  }
}

/** P-FILM: the film's frame (a mounted print cropped to 16:9) with a play mark, a duration chip and a "video" label, then the title and what kind of link. */
function planFilm(c: PageCtx): void {
  const film = c.data.film;
  if (!film) {
    c.notes.push("a film page for a book with no film");
    return;
  }
  const K = PAGE.film;
  const f = c.frame;
  const top = PAGE_H * K.top;
  const pr = addPrint(c, { file: film.frame, key: `${c.id}/film`, cx: f.cx, top, maxW: f.area.w * PAGE.print.maxWidthShare, maxH: f.area.h * 0.5, borderCm: K.frameBorderCm, aspect: K.frameAspect });
  const inner = pr.inner;

  // the play mark: a dark disc with a ring and a triangle
  const r = (f.cm(K.playCm)) / 2;
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  addShape(c, turned(circleCmds(cx, cy, r), pr.turn), K.playFill, K.playAlpha);
  addStroke(c, turned(circleCmds(cx, cy, r * 0.94), pr.turn), K.playRing, 3, 0.85);
  addShape(
    c,
    turned([{ t: "M", x: cx - r * 0.3, y: cy - r * 0.46 }, { t: "L", x: cx + r * 0.52, y: cy }, { t: "L", x: cx - r * 0.3, y: cy + r * 0.46 }, { t: "Z" }], pr.turn),
    K.playGlyph,
  );

  // the duration chip, bottom right of the picture
  const durPx = f.pt(K.durationPt);
  const durW = c.measure(film.duration, { ...MONO, size: durPx });
  const chipW = durW + durPx * 1.2;
  const chipH = durPx * 1.9;
  const m = f.cm(0.35);
  const chip: Rect = { x: inner.x + inner.w - m - chipW, y: inner.y + inner.h - m - chipH, w: chipW, h: chipH };
  addShape(c, turned(roundRectCmds(chip.x, chip.y, chip.w, chip.h, chipH * 0.25), pr.turn), K.chipFill, K.chipAlpha);
  addText(c, film.duration, chip.x + durPx * 0.6, baselineIn(chip.y, chipH, durPx), MONO, durPx, { fill: K.chipText, bg: K.chipFill, turn: pr.turn });

  // "video", small, in the top left corner of the picture
  const vPx = f.pt(K.videoPt);
  const vLine = addGlyphs(c, PAGE_TEXT.video, 0, 0, ROMAN, vPx, { trackingEm: K.videoTrackingEm, smallCaps: true }, { role: "mark", fill: K.chipText, turn: pr.turn });
  c.ops.pop();
  const vw = vLine.width + vPx * 1.6;
  const vh = vPx * 2.2;
  const vx = inner.x + m;
  const vy = inner.y + m;
  addShape(c, turned(roundRectCmds(vx, vy, vw, vh, vh * 0.25), pr.turn), K.chipFill, K.chipAlpha);
  addGlyphs(c, PAGE_TEXT.video, vx + vPx * 0.8, baselineIn(vy, vh, vPx), ROMAN, vPx, { trackingEm: K.videoTrackingEm, smallCaps: true }, { role: "mark", fill: K.chipText, bg: K.chipFill, turn: pr.turn });

  // the title under the frame, and the "Interactive edition" tag
  const fit = fitSize(film.title, c.measure, ROMAN, f.area.w, f.pt(K.titlePt), f.pt(K.titleMinPt));
  const ty = pr.bottom + K.titleGapEm * fit.size;
  addCentred(c, film.title, f.cx, ty, ROMAN, fit.size, { role: roleOf(film.title) });
  if (!fit.fits) c.notes.push(`the film's title "${film.title}" is wider than the text area at ${PAGE.film.titleMinPt} pt`);
  // the film never plays in the book: it says what the QR on the next page leads to
  addGlyphs(c, PAGE_TEXT.interactiveEdition, f.cx, ty + K.tagGapEm * f.pt(K.tagPt), ROMAN, f.pt(K.tagPt), { trackingEm: K.tagTrackingEm, smallCaps: true, centre: true });
}

/** P-LINK: the two codes, one above the other, each with its label above and its address in the typewriter face below. */
function planLinks(c: PageCtx): void {
  const K = PAGE.link;
  const f = c.frame;
  const a = f.area;
  const targets = c.data.qr.slice(0, 2);
  const labelPx = f.pt(K.labelPt);
  const addrPx = f.pt(K.addressPt);
  const gap = f.cm(K.blockGapCm);
  const top = PAGE_H * K.top;
  const bottom = a.y + a.h;
  const block = (codeCm: number): number => targets.map((t) => labelPx + f.cm(K.labelGapCm) + quietSide(c, t.url, codeCm) + f.cm(K.addressGapCm) + addrPx).reduce((s, h) => s + h, 0) + (targets.length - 1) * gap;
  let codeCm: number = K.codeCm;
  while (codeCm > QR_MIN_CODE_CM && top + block(codeCm) > bottom) codeCm = Math.round((codeCm - 0.1) * 100) / 100;
  if (top + block(codeCm) > bottom) c.notes.push("the two codes do not fit the page at the 3.4 cm minimum");

  let y = top;
  for (const t of targets) {
    y += labelPx;
    addGlyphs(c, t.label, f.cx, y, ROMAN, labelPx, { trackingEm: K.labelTrackingEm, smallCaps: true, centre: true });
    y += f.cm(K.labelGapCm);
    const side = quietSide(c, t.url, codeCm);
    addQr(c, t.url, f.cx, y + side / 2, codeCm);
    y += side + f.cm(K.addressGapCm) + addrPx * 0.8;
    const fit = fitSize(t.display, c.measure, MONO, a.w, addrPx, f.pt(K.addressMinPt));
    addCentred(c, t.display, f.cx, y, MONO, fit.size, { role: roleOf(t.display) });
    if (!fit.fits) c.notes.push(`the address "${t.display}" is wider than the text area at ${K.addressMinPt} pt`);
    y += addrPx * 0.2 + gap;
  }
}

/** P-BACK: the same editorial lines as the back cover, the first QR target, and the publisher's x. */
function planBack(c: PageCtx): void {
  const K = PAGE.back;
  const f = c.frame;
  const flags = PAGE_BACK_TEXT[c.id];
  const width = f.area.w * K.measureShare;
  interface Row {
    text: string;
    whole: string;
    face: TypeFace;
    px: number;
    before: number;
  }
  const rows: Row[] = [];
  const add = (text: string, face: TypeFace, px: number, before: number): void => {
    balancedWrap(text, c.measure, { ...face, size: px }, width).forEach((ln, i) => rows.push({ text: ln, whole: text, face, px, before: i === 0 ? before : 0 }));
  };
  if (flags.line && c.data.coverLine) add(c.data.coverLine, ITALIC, f.pt(K.linePt), 0);
  if (flags.summary) add(c.data.summary, ROMAN, f.pt(K.summaryPt), rows.length ? f.cm(0.9) : 0);
  if (flags.backLine && c.data.backLine) add(c.data.backLine, ITALIC, f.pt(K.linePt), rows.length ? f.cm(0.7) : 0);

  let y = PAGE_H * K.wordsAt;
  rows.forEach((r, i) => {
    if (i > 0) y += r.before;
    const lh = r.px * K.lineHeight;
    addCentred(c, r.text, f.cx, y + (lh - r.px) / 2 + 0.8 * r.px, r.face, r.px, { role: roleOf(r.whole) });
    y += lh;
  });

  const target = c.data.qr[0];
  const codeCy = PAGE_H * K.codeAt;
  const qr = addQr(c, target.url, f.cx, codeCy, K.codeCm);
  if (y + f.cm(1) > qr.quiet.y) c.notes.push("the back page's words run into the code");
  const xW = f.cm(K.xCm);
  addPublisherX(c, f.cx, PAGE_H * K.xAt, xW);
}

// ---------------------------------------------------------------------------------------------------------------------------
// the entry point
// ---------------------------------------------------------------------------------------------------------------------------

/** The plan of page `index` of a book. Pure. */
export function planPageOf(id: BookId, index: number, spec: PageSpec, data: PageData, tokens: PageTokens): PagePlan {
  const side = sideOf(index);
  const paper = spec.type === "P-END" ? tokens.spec.colors.endpaper : tokens.spec.colors.paper;
  const c = makeCtx(id, index, spec.type, side, data, tokens, paper);
  c.ops.push({ kind: "grain", seed: fnv1a(`grain/${id}/${index}`), amount: PAGE.grain.amount, tilePx: PAGE.grain.tilePx, rect: FULL });
  switch (spec.type) {
    case "P-END":
      planEnd(c);
      break;
    case "P-HALF":
      planHalf(c);
      break;
    case "P-BLANK":
      planBlank(c);
      break;
    case "P-TITLE":
      planTitle(c);
      break;
    case "P-COLO":
      planColophon(c, spec);
      break;
    case "P-ABST":
      planAbstract(c, spec);
      break;
    case "P-FIG":
      planFigure(c);
      break;
    case "P-GAL":
      planGallery(c, spec);
      break;
    case "P-FILM":
      planFilm(c);
      break;
    case "P-LINK":
      planLinks(c);
      break;
    case "P-BACK":
      planBack(c);
      break;
  }
  return { id, index, type: spec.type, side, width: PAGE_W, height: PAGE_H, ppc: c.frame.ppc, paper, area: c.frame.area, ops: c.ops, qr: c.qr, images: [...c.images], notes: [...new Set(c.notes)] };
}
