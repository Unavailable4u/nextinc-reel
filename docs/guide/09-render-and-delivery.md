# 09 - Render and delivery

## 1. Frame rate: 60 fps, and what it costs

| Setting | Value |
|---|---|
| Composition | 1920 x 1080, **60 fps**, 5400 frames |
| Master | H.264 (CRF 14-16), `yuv420p`, Rec. 709 tags, `+faststart`, AAC 192 kbps |
| Optional high-quality master | PNG sequence (`out/frames/`), for re-encoding later |
| 4K | optional, 3840 x 2160. The plate is 736 px wide, so 4K only sharpens the books and text; the background will be soft anyway. Do 1080p first. |

**Cost.** Twice the frames of the earlier film's 30 fps, and each frame is a 3D render with depth of field. Planning numbers, not promises: if `npm run bench` (Patch 04) reports 2 s per frame, the film takes 5400 x 2 s = 3 h. At 4 s per frame: 6 h. A software-only renderer can be 10x slower. **Always render by shot ranges**, so a change in one shot re-renders only that shot (section 3).

**Motion blur (D-15, decided in Patch 22).** Real cameras blur moving things. Three options, in order of cost: (1) none (60 fps is already smooth); (2) a motion-blur helper from Remotion's ecosystem if it works with the 3D canvas (the patch tests it); (3) render at **240 fps for the fast shots only** (the riffle, the cover open, the lift) and average four frames down to 60 (a 180-degree shutter equivalent, `ffmpeg tmix`). Option 3 costs 4x on those shots only (about 700 frames, 12% of the film).

## 2. Render pipeline (Patch 24 builds `scripts/render.mjs`)

1. `npm run plate:verify` (the original is untouched) and `npm run sync` (snapshot is current), then `npm run audit` (truth audit).
2. `npm run motion` (zero STILL/FAST/DEEP/EDGE/POP/LATE, or recorded exceptions).
3. `npm run stills` and review the contact sheets.
4. Render **shot ranges** to `out/segments/Sxx.mp4` (lossless or CRF 12 intermediate, no audio) in parallel with a concurrency that suits your GPU (start with 2).
5. Concatenate segments with ffmpeg (they are all the same codec and parameters, so `-c copy` works), add the mixed audio, loudness-normalise (two-pass `loudnorm`), `+faststart`.
6. Verify with `ffprobe` (1920x1080, 60 fps, duration 90.000 s, the audio present, loudness within +-1 LU).
7. Write `out/reel-v<version>.mp4`, the poster, the preview loop and `out/RENDER_INFO.json` (version, git commit, site-snapshot commit, date, per-shot render times).

## 3. Rendering by range

A shot depends on: its own file, the data snapshot, config files, and shared components. A `Shot-to-files` map in `docs/ops/RUNBOOK.md` says which shots to re-render after which change (for example "a change to `Book.tsx` re-renders everything that shows a book: S03-S21, S23").

## 4. Deliverables

| File | Spec | Used for |
|---|---|---|
| `out/reel-v1.0.mp4` | 1080p60 H.264 + AAC, about 60-90 MB | the master; YouTube upload |
| `out/reel-v1.0.webm` | VP9 + Opus, CRF about 33 | optional, self-hosting |
| `out/poster.webp` | **1600 x 900, at most 100 KB**, from a chosen frame | the site (`assets/img/films/next-inc-reel.webp`) |
| `out/loop.mp4` + `loop.webm` | 3-5 s, 640 px wide, no audio, at most 500 KB | the site's hover preview (optional) |
| `out/stills/` | per-shot checks | QA |
| `out/RENDER_INFO.json` | provenance | the maintenance log |

The poster is encoded to the site's budget with `sharp` (WebP quality search until under 100 KB). The poster must be the frame itself (no text added), so it matches the film's first impression.

## 5. Encoding commands (reference)

The render script prints the exact lines; these are the shapes:

```
# master from segments + audio
ffmpeg -f concat -safe 0 -i segments.txt -i out/mix.wav -c:v copy -c:a aac -b:a 192k -movflags +faststart out/raw.mp4
# loudness: two passes, targets I=-16 TP=-1.5 LRA=11 (as in minilocker-film's README)
# 240 fps average to 60 for the fast shots
ffmpeg -framerate 240 -i seg/%05d.png -vf "tmix=frames=4:weights='1 1 1 1',select='not(mod(n\,4))'" -r 60 out.mp4
```

(The `tmix` line is a starting point; Patch 22 verifies the exact filter graph on your ffmpeg version.)

## 6. Windows notes (you used Windows before)

Node 20+, `winget install Gyan.FFmpeg` (then open a **new** terminal). Keep the repo path short and without spaces. Do not render while the machine is on battery. If the render stalls, lower concurrency; an out-of-memory browser tab is the usual cause (page textures; see the budgets in guide 02).

## 7. Viewing protocol before you publish

Watch it once muted on a laptop at 100%, once with headphones, once on a phone in a dark room, and once with a phone **scanning the QR codes off the screen**. Then upload as unlisted and watch the link while logged out.
