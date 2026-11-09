# Decision log

Format: **ID - decision.** Default. Alternatives. Cost to change after Patch 13. Status: `default` (you have not objected) or `confirmed` (you said so). Change a status by editing this file and noting the date.

| ID | Decision | Default | Alternatives | Cost to change later | Status |
|---|---|---|---|---|---|
| D-01 | Rendering technology | Remotion + React Three Fiber | Blender (see guide 15) | Very high | default |
| D-02 | Frame rate | 60 fps (beat = 30 f) | 30 fps, 120 fps for motion-blur accumulation only | Medium (timeline is in seconds/beats, frames are derived) | default |
| D-03 | Length and frame | 90 s, 1920x1080 | 60 s cut-down (guide 01, "Cut-downs"), 4K master | Low | default |
| D-04 | Photo in 16:9 | Pillarbox into the photo's dark edges, then push in | Start already cropped to a 16:9 band | Low | default |
| D-05 | Plate resolution | Original, with defocus beyond 2.5x magnification | One-time x4 upscale stored in `plates/derived/` | Low | default |
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
| D-21 | Pillarbox look (S00) | Pure black bars; the photo's outer 60 px fade to black | Bars tinted to the photo's edge colour (left 13, right 38 of 255); a narrower or wider feather | Low (two constants in `config/plate.ts`) | default (set in Patch 02) |
| D-22 | QR choice rule | QR 1: live, else repo, else case study. QR 2: next of repo, film, case study | Always case study + film; or fixed per book in `bookText.ts` | Low | default (set in Patch 01, reproduces guide 07's table) |
| D-23 | Riser label wording | The data's title (`Mini Me`, `SPHEREx Blink Comparator`) | The brand spellings of the covers (`MiniMe`, `SPHEREx`); guides 01 and 04 use these in examples | Low | **needs your answer** (the guides disagree with `content/books.md`) |
