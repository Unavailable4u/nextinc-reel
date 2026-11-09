# 12 - Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Black frames in a render, fine in Studio | an asset (plate, texture, font) was not awaited | wrap the load in `delayRender`/`continueRender`; check the browser console in the render log |
| Everything flickers or books jitter | an animation driven by `useFrame` or a non-seeded random | remove `useFrame`; use `useCurrentFrame()`; seed the noise |
| WebGL error or a blank canvas when rendering | the headless browser has no real GL | set the OpenGL renderer to `angle` for both the Studio and the Node render options; on a machine with no GPU expect slow software rendering |
| `Sequence` throws inside the 3D canvas | default layout is a DOM element | `layout="none"` |
| Render runs out of memory | too many large textures alive at once | dispose page textures after each act; lower page texture size for pages never read; lower concurrency |
| Plate looks different from the photo | tone mapping or colour space applied to the plate | `NoToneMapping`, plate material `toneMapped = false`, texture sRGB; run `npm run plate:verify` |
| Plate looks soft in S00 | magnification above 1.607 with a non-Lanczos resample | use a mipmapped texture with anisotropy; check D-05 |
| Books look pasted on | no contact shadow, wrong light direction or colour | guide 03, sections 1-2 |
| Books float above the desk strip | the match camera is wrong | redo Patch 03; check the desk edges overlay at three frames |
| Text on pages shimmers | texture filtering | anisotropy 16, mipmaps, 2048 x 3072 |
| Foil looks flat yellow | no environment to reflect | build the plate probe (guide 03, section 7) |
| Page turn looks like a hinged board | curl is missing | guide 06 |
| QR does not scan from the screen | too small, blurred, curved, tinted or low contrast | guide 04, QR rules; test with `npm run qr:check`; hold longer |
| Bokeh looks like a Gaussian smear | DOF effect not using a circular kernel | enable the bokeh kernel and highlight thresholding |
| Plate edge visible during the truck | camera window left the plate | the 40 px margin rule; `npm run motion` reports EDGE |
| Chair wipe shows the swap | the occluder does not cover the frame | extend the cover (frames 4140-4199) or move the swap to its centre |
| Film length is not 90.000 s | timeline edited without updating the shot table | one place: `timeline.ts`; run `npm run motion` which checks the sum |
| `npm run sync` fails | the website repo path is wrong or a data file changed shape | check `SITE_REPO` env var; read the error: it names the file and field |
| YouTube re-encode looks soft | upload bitrate too low | upload the master (not the 1080p preview); wait for HD processing |
| Poster over 100 KB | WebP quality too high | the poster script lowers quality until it fits |
