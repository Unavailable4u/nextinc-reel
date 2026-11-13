import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender } from "remotion";
import { z } from "zod";
import { BOOKS, BOOK_IDS } from "../config/books";
import { PAGE, PAGE_H, PAGE_W } from "../config/pages";
import { contrastRatio } from "../lib/color";
import { pagesOf, spreadCount, typesUsedBy } from "../config/pageSpecs";
import { HEIGHT, WIDTH } from "../config/timeline";
import { loadFonts, stacks } from "../lib/fonts";
import { bookPageBytes, loadBookPages, wordsOf, type BookPages, type PaintedPage } from "../paint/pages";

void loadFonts();

const VIEWS = ["spread", "sheet", "types", "page"] as const;

/** Sliders in the Studio's right-hand panel. */
export const devPagesSchema = z.object({
  /** spread: the two pages that face each other at `spread`; sheet: every page of the book; types: one of every page type the book uses; page: one page, as tall as the picture (`npm run qr:check` looks at these) */
  view: z.enum(VIEWS),
  id: z.enum(BOOK_IDS),
  /** the spread: 0 is the endpaper and the half-title (S06 for Mini Me) */
  spread: z.number().int().min(0).max(8),
  /** the page view: the index of the page */
  page: z.number().int().min(0).max(16),
  /** only the strings the viewer must read are marked: green passes the 8-word and 7 to 1 rules, red fails one */
  readableOnly: z.boolean(),
  /** the margins (cyan), the QR boxes (yellow) and the middle fold (white) drawn over the pages */
  overlay: z.boolean(),
  panel: z.boolean(),
});
export type DevPagesProps = z.infer<typeof devPagesSchema>;
export const defaultDevPagesProps: DevPagesProps = { view: "spread", id: "mini-me", spread: 3, page: 0, readableOnly: false, overlay: true, panel: true };

const mono: React.CSSProperties = { fontFamily: stacks.mono, color: "#F1EADB", textShadow: "0 1px 5px #000, 0 0 2px #000" };

/** The pages of one book, painted in the browser; the render waits (`delayRender`) until they are ready. */
function useBookPages(id: DevPagesProps["id"]): BookPages | null {
  const [book, setBook] = useState<BookPages | null>(null);
  const handle = useRef<number | null>(null);
  if (handle.current === null && book === null) handle.current = delayRender(`Painting the pages of ${id}`);
  useEffect(() => {
    let alive = true;
    loadBookPages(id).then(
      (b) => {
        if (alive) setBook(b);
        if (handle.current !== null) {
          continueRender(handle.current);
          handle.current = null;
        }
      },
      (e: unknown) => cancelRender(e),
    );
    return () => {
      alive = false;
    };
  }, [id]);
  return book;
}

/** One painted page, scaled to `height` px, with the margins and the QR boxes over it when asked. */
const PageView: React.FC<{ page: PaintedPage; height: number; overlay: boolean; readableOnly?: boolean }> = ({ page, height, overlay, readableOnly }) => {
  const k = height / PAGE_H;
  const w = Math.round(PAGE_W * k);
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, w, height);
    g.drawImage(page.canvas, 0, 0, w, height);
    if (readableOnly) {
      // the strings a viewer must read: a box round each, green when it passes the rules of guide 07 section 6, red when it does not
      for (const t of page.plan.ops) {
        if (t.kind !== "text" || t.role !== "read" || t.mirror) continue;
        const ok = wordsOf(t.text) <= PAGE.maxReadableWords && contrastRatio(t.fill, t.bg ?? page.plan.paper) >= PAGE.minContrast && t.alpha === 1;
        g.strokeStyle = ok ? "#3be07a" : "#ff3b3b";
        g.lineWidth = 1.5;
        g.strokeRect((t.x - 4) * k, (t.y - t.size) * k, (t.width + 8) * k, (t.size * 1.25) * k);
      }
    }
    if (!overlay) return;
    const a = page.plan.area;
    g.lineWidth = 1.5;
    g.strokeStyle = "#35e0ff";
    g.strokeRect(a.x * k, a.y * k, a.w * k, a.h * k);
    g.strokeStyle = "#ffe14a";
    for (const q of page.plan.qr) g.strokeRect(q.quiet.x * k, q.quiet.y * k, q.quiet.w * k, q.quiet.h * k);
  }, [page, w, height, overlay, readableOnly, k]);
  return <canvas ref={ref} width={w} height={height} style={{ display: "block", outline: "1px solid #000" }} />;
};

/**
 * THE PAGE LAB (Patch 09). `spread`: the two pages that face each other, as painted, with the margins (cyan) and the codes' light squares
 * (yellow); `sheet`: every page of the book. Notes the painters wrote (a missing picture, text that did not fit, a code under 3.4 cm) are
 * printed in red. Tune `src/config/pages.ts` by looking here.
 */
export const DevPages: React.FC<DevPagesProps> = (p) => {
  const book = useBookPages(p.id);
  if (!book) return null;
  const top = p.panel ? 130 : 30;
  const room = HEIGHT - top - 30;
  let body: React.ReactNode;
  if (p.view === "page") {
    // one page, nothing else (no label), so a script can find it: its top-left corner is (30, 30) when the panel is off
    const pg = book.pages[Math.min(p.page, book.pages.length - 1)];
    return (
      <AbsoluteFill style={{ background: "#2a2622" }}>
        <div style={{ position: "absolute", left: 30, top: 30 }}>
          <PageView page={pg} height={HEIGHT - 60} overlay={false} />
        </div>
      </AbsoluteFill>
    );
  }
  if (p.view === "spread") {
    const left = Math.min(p.spread, spreadCount(p.id) - 1) * 2;
    const pair = [book.pages[left], book.pages[left + 1]].filter((x): x is PaintedPage => !!x);
    body = (
      <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
        {pair.map((pg) => (
          <div key={pg.plan.index}>
            <PageView page={pg} height={room - 30} overlay={p.overlay} readableOnly={p.readableOnly} />
            <div style={{ fontSize: 17 }}>
              {pg.plan.index} · {pg.plan.type} · {pg.plan.side}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (p.view === "types") {
    // one of every page type the book uses (the first page of each)
    const shown = typesUsedBy(p.id).map((t) => book.pages.find((pg) => pg.plan.type === t)!);
    const perRow = Math.ceil(shown.length / 2);
    const h = Math.min((room - 60) / 2, ((WIDTH - 60) / perRow) * (PAGE_H / PAGE_W));
    body = (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: WIDTH - 60 }}>
        {shown.map((pg) => (
          <div key={pg.plan.index}>
            <PageView page={pg} height={h} overlay={p.overlay} readableOnly={p.readableOnly} />
            <div style={{ fontSize: 14 }}>
              {pg.plan.type} · page {pg.plan.index}
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    const n = book.pages.length;
    const rows = n > 7 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const h = Math.min((room - 30 * rows) / rows, ((WIDTH - 60) / perRow) * (PAGE_H / PAGE_W));
    body = (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: WIDTH - 60 }}>
        {book.pages.map((pg) => (
          <div key={pg.plan.index}>
            <PageView page={pg} height={h} overlay={p.overlay} readableOnly={p.readableOnly} />
            <div style={{ fontSize: 14 }}>
              {pg.plan.index} · {pg.plan.type}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const notes = book.pages.flatMap((pg) => pg.plan.notes.map((n) => `page ${pg.plan.index} (${pg.plan.type}): ${n}`));
  return (
    <AbsoluteFill style={{ background: "#2a2622", ...mono }}>
      {p.panel ? (
        <div style={{ position: "absolute", left: 40, top: 18, fontSize: 20, lineHeight: 1.45 }}>
          <div style={{ fontSize: 30 }}>
            PAGES · {p.id} · {p.view === "spread" ? `spread ${p.spread}` : p.view === "types" ? "one of every type" : `${pagesOf(p.id).length} pages`}
          </div>
          <div style={{ fontSize: 16, opacity: 0.85 }}>
            as painted, no lights · cyan: text area (inner {PAGE.margins.inner}, outer {PAGE.margins.outer}, top {PAGE.margins.top}, bottom {PAGE.margins.bottom} cm) · yellow: a code's light square · green and red (readable only): a read string that passes or breaks the 8-word and 7 to 1 rules · {Math.round(bookPageBytes(p.id) / 1048576)} MB of textures on the GPU (budget {Math.round(PAGE.textureBudgetBytes / 1048576)} MB) · {BOOKS[p.id].colors.paper}
          </div>
          {notes.map((n, i) => (
            <div key={i} style={{ color: "#ff8a7a", fontSize: 16 }}>
              note: {n}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 30, top }}>{body}</div>
    </AbsoluteFill>
  );
};
