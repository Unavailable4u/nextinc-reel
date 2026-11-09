### PATCH 21 - Foley, room tone, mix

**Needs:** 20
**Parallel-safe with:** 22
**Size:** M
**Paste existing:** `docs/PATCH_NOTES.md`, `src/config/timeline.ts`, `src/shots/index.ts`
**Paste reference (read-only, from other repos):** nothing
**Attach from guide:** `docs/guide/08-audio.md` (all)
**Before you start (you do this, not the assistant):** record your foley (guide 08, section 1) into `public/audio/foley/`, or collect CC0 files; list every file in `docs/reference/asset-licences.md`.

```
PATCH 21 - Foley, room tone, mix.

GOAL: every cue on its frame, a mixed track at -16 LUFS.

CREATE / CHANGE:
- `src/config/sfx.ts` (the cue sheet from guide 08, authoritative), `src/audio/ReelAudio.tsx` (Remotion audio with per-cue gain and start frames), `scripts/prepare-audio.mjs` (ffmpeg: trim, normalise to -3 dBFS peak, convert to 48 kHz WAV), `scripts/mix-audio.mjs` (renders `out/mix.wav` from the cue sheet, two-pass loudnorm to -16 LUFS / -1.5 dBTP)
- room tone fade in/out; optional pad from bar 12 at -30 dB (D-16)

RULES THAT MATTER HERE:
- Sound leads the picture by one or two frames.
- No audio-only information.

CHECK:
- `node scripts/mix-audio.mjs` prints LUFS within +-1 and true peak at most -1.5 dB
- Listen with headphones to S10 and S14-S15
```

**Acceptance (what you look at to say yes):** The riffle is the loudest paper sound; the set-down has weight; silence at the end.
**Do not:** Add music you cannot licence.
