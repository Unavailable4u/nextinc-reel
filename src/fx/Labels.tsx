import React from "react";
import { useCurrentFrame } from "remotion";
import { LABELS, labelText } from "../config/labels";
import { labelsAt, type LabelFrame } from "./labelLayout";
import { HEIGHT, WIDTH } from "../config/timeline";
import { stacks } from "../lib/fonts";

const One: React.FC<{ l: LabelFrame }> = ({ l }) => {
  const t = labelText(l.id);
  const left = l.side === "left";
  const x1 = l.dot.x + (l.leaderEnd.x - l.dot.x) * l.leaderDraw;
  const w = l.book.x1 - l.book.x0;
  const band = w * LABELS.sweepWidth;
  // the sweep: a soft band that runs across the cover from the spine side to the fore-edge, clipped to the cover that shows
  const centre = -band / 2 + l.sweep * (w + band);
  return (
    <>
      {l.sweepAlpha > 0.001 ? (
        <div style={{ position: "absolute", left: l.book.x0, top: l.book.y0, width: w, height: l.book.y1 - l.book.y0, overflow: "hidden", opacity: l.fade }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              height: "100%",
              left: centre - band / 2,
              width: band,
              background: `linear-gradient(100deg, rgba(${LABELS.sweepColour},0), rgba(${LABELS.sweepColour},${l.sweepAlpha.toFixed(4)}) 50%, rgba(${LABELS.sweepColour},0))`,
            }}
          />
        </div>
      ) : null}
      <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", left: 0, top: 0, opacity: l.fade }}>
        {l.leaderDraw > 0 ? <line x1={l.dot.x} y1={l.dot.y} x2={x1} y2={l.dot.y} stroke={LABELS.chip} strokeWidth={LABELS.leaderPx} strokeOpacity={0.92} /> : null}
        {l.dotScale > 0 ? <circle cx={l.dot.x} cy={l.dot.y} r={(LABELS.dotPx / 2) * l.dotScale} fill={LABELS.chip} /> : null}
      </svg>
      {l.chipAlpha > 0 ? (
        <div
          style={{
            position: "absolute",
            top: l.dot.y,
            transform: "translateY(-50%)",
            ...(left ? { right: WIDTH - l.leaderEnd.x } : { left: l.leaderEnd.x }),
            padding: `${LABELS.padY}px ${LABELS.padX}px`,
            background: `rgba(245,240,230,${LABELS.chipAlpha})`,
            color: LABELS.ink,
            borderRadius: 3,
            opacity: l.chipAlpha * l.fade,
            whiteSpace: "nowrap",
            textAlign: left ? "right" : "left",
          }}
        >
          <div style={{ fontFamily: stacks.serif, fontStyle: "italic", fontSize: LABELS.titlePx, lineHeight: 1.15 }}>
            <span style={{ marginRight: "0.6em" }}>{t.volume}</span>
            {t.name}
          </div>
          <div style={{ fontFamily: stacks.mono, fontSize: LABELS.subPx, lineHeight: 1.2 }}>{t.sub}</div>
        </div>
      ) : null}
    </>
  );
};

/**
 * THE RISER LABELS (Patch 19, the overlay of S23): one label per book, in the site's order, from frame 4380 (`config/labels.ts` has every number and
 * the words come from `getRiserLabel`). A pure function of the frame: nothing here keeps a clock or a state.
 */
export const Labels: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, pointerEvents: "none" }}>
      {labelsAt(frame).map((l) => (
        <One key={l.id} l={l} />
      ))}
    </div>
  );
};
