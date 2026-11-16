import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { GLYPH, WORDMARK, cardText, wordmarkAt, wordmarkLayout } from "../config/wordmark";
import { HEIGHT, WIDTH } from "../config/timeline";
import { stacks } from "../lib/fonts";

const SCRIM_ID = "reel-wordmark-scrim";

/**
 * THE WORDMARK AND THE TAGLINE (Patch 20, the overlay of S24; S25 draws it again, finished, under the fade): the crimson italic x is stroked on from the site's own path, then the letters of the
 * name rise into place in CMU Serif Bold, then the tagline and the address arrive. Every number is `config/wordmark.ts` and every word is the data's (`getCompany()`); this file only draws
 * what `wordmarkAt(frame)` says. One full-frame SVG: a soft warm-black scrim behind the card (so the card stands on a soft, dark ground and is readable over any part of the picture), the letters
 * as text at their measured places, the x as a path (`pathLength` 1, so the dash offset is the share of the contour not yet drawn), the tagline and the address. Plain opacity and
 * transform, no filter, no blend mode, no clock: the same frame always gives the same picture.
 */
export const Wordmark: React.FC = () => {
  const frame = useCurrentFrame();
  const layout = useMemo(() => wordmarkLayout(), []);
  const words = useMemo(() => cardText(), []);
  const f = wordmarkAt(frame, layout);
  // nothing to draw before the stroke starts: no element at all, so the shots before it are untouched
  if (f.scrimAlpha <= 0 && f.draw <= 0) return null;
  const W = WORDMARK;
  const rise = (p: number, px: number): number => (1 - p) * W.riseEm * px;
  const strokeUnits = W.strokePx / layout.scale;
  const serif = { fontFamily: stacks.serif } as const;
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <radialGradient id={SCRIM_ID} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={`rgb(${W.scrimRgb})`} stopOpacity={1} />
          <stop offset="0.55" stopColor={`rgb(${W.scrimRgb})`} stopOpacity={0.62} />
          <stop offset="1" stopColor={`rgb(${W.scrimRgb})`} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={W.centreX} cy={W.baselineY + 60} rx={820} ry={270} fill={`url(#${SCRIM_ID})`} opacity={f.scrimAlpha} />
      {layout.letters.map((l, i) => (
        <text
          key={l.index}
          x={l.x}
          y={W.baselineY + rise(f.letters[i], W.sizePx)}
          fill={W.paper}
          opacity={f.letters[i]}
          style={{ ...serif, fontWeight: 700, fontSize: W.sizePx }}
        >
          {l.ch}
        </text>
      ))}
      <g transform={`translate(${layout.xOrigin} ${W.baselineY}) scale(${layout.scale} ${-layout.scale})`}>
        <path
          d={GLYPH.d}
          pathLength={1}
          fill={W.x}
          fillOpacity={f.fill}
          stroke={W.x}
          strokeWidth={strokeUnits}
          strokeLinejoin="round"
          strokeDasharray="1 1"
          strokeDashoffset={1 - f.draw}
          strokeOpacity={f.strokeOpacity}
        />
      </g>
      <text
        x={W.centreX}
        y={W.taglineY + rise(f.tagline, W.taglinePx)}
        textAnchor="middle"
        fill={W.tagline_ink}
        opacity={f.tagline}
        style={{ ...serif, fontWeight: 400, fontSize: W.taglinePx, letterSpacing: "0.01em" }}
      >
        {words.tagline}
      </text>
      <text
        x={W.centreX}
        y={W.addressY + rise(f.address, W.addressPx)}
        textAnchor="middle"
        fill={W.address_ink}
        opacity={f.address}
        style={{ fontFamily: stacks.mono, fontSize: W.addressPx, letterSpacing: "0.08em" }}
      >
        {words.address}
      </text>
    </svg>
  );
};
