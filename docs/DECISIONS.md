# Decision log

Format: **ID - decision.** Default. Alternatives. Cost to change after Patch 13. Status: `default` (you have not objected) or `confirmed` (you said so). Change a status by editing this file and noting the date.

| ID | Decision | Default | Alternatives | Cost to change later | Status |
|---|---|---|---|---|---|
| D-01 | Rendering technology | Remotion + React Three Fiber | Blender (see guide 15) | Very high | default |
| D-02 | Frame rate | 60 fps (beat = 30 f) | 30 fps, 120 fps for motion-blur accumulation only | Medium (timeline is in seconds/beats, frames are derived) | default |
| D-03 | Length and frame | 90 s, 1920x1080 | 60 s cut-down (guide 01, "Cut-downs"), 4K master | Low | default |
| D-04 | Photo in 16:9 | **Obsolete (Patch 02a).** The new plate is 1536 x 864, exactly 16:9, so it fills the frame: no pillarbox | (was: pillarbox into the photo's dark edges, then push in) | n/a | superseded by D-24 |
| D-05 | Plate resolution | The 1536 x 864 plate as supplied, with defocus beyond 2.6x magnification. It is 2.09x wider than the first photo, so the same desk framing needs 0.7233 x the old M | One-time x2 upscale stored in `plates/derived/` | Low | default (updated in Patch 02a) |
| D-06 | Hands | No hands (operator model) | Rigged hands as an optional late patch (high risk of looking wrong) | High | default |
| D-07 | Right-side display | Right end of the same desk, two-tier riser | A second small table placed at the right | Medium | default |
| D-08 | Mini Me title on the book | `MiniMe` | `Mini Me` (the site's data spelling) | Low (one field in `content/books.md`) | default |
| D-09 | Second book | MiniLocker | SPHEREx Blink Comparator | Medium | default |
| D-10 | Ending | Room dims, wordmark draws in, tagline, fade | Logo stamped in foil on the riser's front edge | Low | default |
| D-11 | Hosting | YouTube unlisted + local poster | Self-hosted MP4/WebM (about 70 MB at 60 fps) | Low | default |
| D-12 | Tempo | 120 BPM | Any; changes frame numbers of the cuts | Medium | default |
| D-13 | Hands-free pick-up look | Book rises with weight and sway, as if lifted by the viewer | n/a | n/a | default |
| D-14 | Authors on covers | Three names in site order, no roles | Add roles (the site's own data is inconsistent about Arib Labib's role, so names only is safer) | Low | default |
| D-15 | Motion blur | Decide in Patch 22 by benchmark | 240 fps accumulate; Remotion motion-blur package; none | Low | open |
| D-16 | Soundtrack | Foley + room tone + very light ambient bed | No music; licensed track | Low | open |
| D-17 | `minime.app` on the Mini Me book | Not shown (the site's briefs say no product URL exists) | Show it once you confirm it is real and public, after adding it to `projects.js` | Low | **needs your answer** |
| D-18 | MiniLocker cloth | Parchment with blue rings (as in your cover image) | The site's `forest` palette green | Low | default |
| D-19 | Volume numbers | Vol. I-IV in site order, on spines and labels | Omit | Low | default |
| D-20 | Mini Me film thumbnail (S12) | Cropped from the laptop/app part of the film poster, left text column excluded (the poster shows "Try MiniMe" and `minime.app`, same issue as D-17) | A real app screenshot you supply; the YouTube thumbnail if it is clean | Low | **needs your answer** (found while building Patch 01) |
| D-21 | Pillarbox look (S00) | **Obsolete (Patch 02a).** The plate fills the frame, so there are no bars and `PILLARBOX.feather` is 0. The `Pillarbox` component stays in the code for any view that shows less than the whole plate | n/a | n/a | superseded by D-24 |
| D-22 | QR choice rule | QR 1: live, else repo, else case study. QR 2: next of repo, film, case study | Always case study + film; or fixed per book in `bookText.ts` | Low | default (set in Patch 01, reproduces guide 07's table) |
| D-23 | Riser label wording | The data's title (`Mini Me`, `SPHEREx Blink Comparator`) | The brand spellings of the covers (`MiniMe`, `SPHEREx`); guides 01 and 04 use these in examples | Low | **needs your answer** (the guides disagree with `content/books.md`) |
| D-24 | The plate (Patch 02a) | `public/plates/original/desk-plate.png`, 1536 x 864 (SHA-256 `3aa7af92...44af0`). It is a re-render of the room, not an extension of the first photo: the desk is 1.38x larger and the perspective differs. The first photo is kept unchanged as `plates/superseded/desk-plate-v1.jpg` (`82aa3d3c...04b41`) | Keep the first photo as the plate | Very high after Patch 03 | default (set in Patch 02a) |
| D-25 | Horizon of the match camera | The desk's own edges, y = 396, because the books sit on the desk. Patch 03's lab lets the horizon slide between y = 380 and y = 470 and you choose by eye | The room's ceiling and baseboard lines, y about 464 | Medium (re-run the match lab) | **needs your answer** (the two sets of lines disagree) |
| D-26 | The new right-hand bookshelf | Our books stay on the desk; the riser sits at the desk's right end, never on the shelves. S23's frame is defocused at its right edge where the lit shelf enters | A darker vignette on S23, or a window shifted left by up to 60 px | Low | default (set in Patch 02a) |
| D-27 | Rights of the plate | Confirm the source and licence of the new image before publishing. The shelf holds a helmet that closely resembles a licensed film character | Retouching is not allowed (the plate is read-only), so the alternative is a different image | High | **needs your answer** |
| D-28 | Square (1:1) social cut | Possible: plate x 216 to 1080 (864 px, M = 1.25) holds almost the whole desk, and both anchors (x 418 and 971) fall inside | Vertical 9:16 is still not supported by the plate | Low | default (set in Patch 02a) |
