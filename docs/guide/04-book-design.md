# 04 - Book design

Four books, one per project, in the site's order: **Vol. I Mini Me, Vol. II SPHEREx Blink Comparator, Vol. III MiniLocker, Vol. IV Next Inc. Immersive.** The volume numbers are a design device (small, on the spine and the label); they are not a claim about order of creation.

## 1. The physical object (all four)

| Part | Value | Notes |
|---|---|---|
| Trim size | **15.2 x 22.9 cm** (6 x 9 in) | portrait trade hardcover, aspect 0.664 |
| Board thickness | 0.30 cm | the cover boards |
| Square (board overhang) | 0.30 cm top, bottom and fore-edge | the boards stick out past the page block |
| Spine thickness | Mini Me **2.4 cm**, SPHEREx **1.8 cm**, MiniLocker **2.0 cm**, Immersive **1.6 cm** | different thicknesses are the first thing that makes the pile believable |
| Spine shape | gently rounded (back rounded, hinge groove 0.5 cm from the spine edge) | |
| Page block | slab with fore-edge texture, plus **up to 12 real animated sheets** at any time | the rest is texture |
| Implied page count | 160-256 | for the viewer, a thick book; never stated on screen |
| Head and tail band | cloth, two colours | thin, 1.2 cm wide at the top and bottom of the spine inside |
| Ribbon marker | crimson `#C0102C`, 0.6 cm wide, 3 cm tail | marks the "middle" page the riffle lands on |
| Weight (for the motion) | Mini Me 560 g, SPHEREx 440 g, MiniLocker 490 g, Immersive 400 g | sets spring stiffness and sway (heavier: slower, smaller sway) |

The numbers live in `src/config/books.ts`. Nothing about a book is hard-coded in `Book.tsx`.

## 2. Shared grammar (the family look)

- **Typeface:** CMU Serif for everything (the site's face), CMU Typewriter Text only for addresses and the status line.
- **Publisher's mark:** the crimson italic **x** (from `nextinc/scripts/brand/glyph-x.json`), small, at the foot of every spine and on every title page. It is the only thing that is the same on all four spines. It is not a new logo; it is the site's mark.
- **Authors:** `Arib Labib`, `Shuaib Islam`, `Shaikh Muhammad` (site order, from `team.js`, names only, no roles: D-14) at the foot of every front cover, in small caps.
- **Not on the books:** no NASA, Vultr or other third-party logos; no prices; no "award" claims; no invented numbers.

## 3. The four covers

Colours below come from your own cover images (sampled) and from the site's palette tokens (`assets/js/art.js`). Treat the hex values as the starting point and sample the real ones again in Patch 08.

### Vol. I - MiniMe (the hero book)

| Element | Design |
|---|---|
| Cloth | near-black, slightly cool (`#0D0D0D` as in the Mini Me cover art), matte, faint weave |
| Logo (top, centred, about 3.4 cm wide) | the Mini Me mark, **rose-red foil** (`#FF2351`), foil-stamped (metal, debossed). Source: `nextinc/assets/img/brand/mini-me-logo.png` (512 x 512 raster). **Patch 08 vectorises it** (trace the shape into an SVG path, keep the file in `public/brand/`) because foil masks need clean edges. |
| Title | `MiniMe` in CMU Serif Bold, 40 pt, warm off-white foil `#E9E2D4`, centred at 40% height |
| Tag line | `Describe a task. Get a team.` in italic, small, from your cover art (it is already public on your cover) |
| Authors | foot, small caps, off-white at 70% |
| Spine | title top-to-bottom, logo at the head, crimson x at the foot |
| Back cover | the tag line again, a single line of the data `summary`, a small QR to the case-study page (**not** `minime.app`; see guide 07, "Open conflict") |
| Edge treatment | a thin rose-red **stained top edge** (only the top edge of the page block, a nice detail visible in S03) |

### Vol. II - SPHEREx Blink Comparator

| Element | Design |
|---|---|
| Cloth | the site's `indigo` token `#24307A`, matte |
| Motif | the site's `orbits` motif (from `art.js`) as fine **gold foil rings**, off-centre, bleeding off the cover |
| Title | `SPHEREx` in Bold + `Blink Comparator` in Italic, gold `#E8B04A` |
| Line | `NASA Space Apps 2026` as plain small text (true per the project data). **Text only. No NASA logo.** |
| Spine / back | as the grammar; back has the line "Nothing in it claims a detection." only if the data still contains it |

### Vol. III - MiniLocker (the second book)

| Element | Design |
|---|---|
| Cloth | parchment/kraft linen, `#DABD9B` to `#CEAF8B`, with a stronger weave than the others (visible fibres) |
| Rings (cover art) | the five concentric arcs of the Blast Radius dial that your cover image shows, in blue foil. Use the exact arc geometry in `minilocker-film/src/ui/RadiusDial.tsx` (`arcPath`, `RADII`), never redrawn by eye |
| Mark (small) | the MiniLocker Mark (dashed outer ring, two rings, crimson centre dot) from `minilocker-film/docs/bible/appendix-A.md`, **exact SVG, never redrawn**, about 1.6 cm, on the title page and at the head of the spine |
| Title | `Mini` in ink + `Locker` in crimson `#C0102C`, CMU Serif Bold |
| Line | `Blast Radius Zero` in italic small caps (the challenge name already used in the earlier film) |
| Spine / back | as the grammar; the back has the one-line `summary` and a QR to the repo |

### Vol. IV - Next Inc. Immersive

| Element | Design |
|---|---|
| Cloth | the site's `crimson` token `#C0102C`, but darkened 35% with a near-black blind-stamped (no ink, only a deboss) particle globe (a ring of dots) |
| Title | `Next Inc.` Roman + `Immersive` Italic, off-white `#F5F0E6` |
| Line | `A showcase build` (true: the data says "a showcase build ... not our production site") |
| Spine / back | as the grammar; the back says, in plain words, **"A showcase build of our website. Not our production site."** (from the data) |

## 4. Interior page types (the catalogue Patch 09 builds)

Page size 15.2 x 22.9 cm painted at **2048 x 3072** (134.7 px/cm). Margins: inner 2.0 cm, outer 1.6 cm, top 1.8 cm, bottom 2.2 cm. A 1 pt = 4.75 px. Type scale (chosen for a video, bigger than a real book's):

| Style | Size | Use |
|---|---|---|
| Display | 40 pt Bold | title page title |
| Heading | 26 pt Bold | spread headings |
| Caption | 14 pt Italic | figure and screenshot captions, at most 8 words |
| Body | 11 pt Roman | abstract paragraph, the "texture" text |
| Mono | 13 pt Typewriter | web addresses |

| Code | Page | Content (all from data) |
|---|---|---|
| P-END | Endpaper | a repeated pattern generated from the project's `motif` and `palette` (rings, orbits, nodes, waves), matte |
| P-HALF | Half-title | the title only, small, centred |
| P-BLANK | Blank | (back of the half-title) faint paper grain, a ghost of the facing page's ink |
| P-TITLE | Title page | `title`, subtitle (the data `summary`, trimmed to one line), the three authors, `Next Inc.`, the year; the crimson x |
| P-COLO | Colophon | status (`coming soon` / `completed` / `prototype`), year, category, up to four tags, and the site's affiliation line; one honest limit sentence when the project's data states one (for example MiniLocker's "credential broker only exercised against a recorded upstream") |
| P-ABST | Abstract | the small-caps lead-in `Abstract.` then the data `abstract`, trimmed at a sentence to about 55 words. Drop cap, 11 pt, justified |
| P-FIG | Figure | the project's cover image or best screenshot, a caption in the site's style: `Fig. 1.` bold + the caption text |
| P-GAL | Gallery page | 1-3 screenshots as **mounted prints**: white border, hairline, small corner mounts, a slight rotation of 0.4-0.8 degrees each, each with a caption |
| P-FILM | Film page | the film's poster in a frame, a play mark (a circle with a triangle, 4 cm), the duration (`1:03`), a one-line title, the tag `Interactive edition` and a tiny "video" corner label. **It never plays.** |
| P-LINK | Links page | up to two QR codes (3.4 cm square on paper, so large on screen), each with a label, and the web address in mono under it |
| P-BACK | Back cover | tag line or summary, a small QR, the publisher's x |

QR code rules (so they scan from the video): modules dark `#16120E` on a **light** quiet zone (at least 4 modules wide), error correction level **M**, no logo in the centre, printed at least 3.4 cm square, flat (no page bend) during the hold, and no blur. Patch 09's `npm run qr:check` decodes them from rendered stills.

## 5. Which pages appear in which shot (Mini Me)

| Shot | Left page | Right page |
|---|---|---|
| S06 (open) | P-END (inside front board) | P-HALF |
| S07 | P-BLANK | P-TITLE |
| S08 | P-ABST | P-FIG |
| S10-S11 | P-GAL (screenshots 1-2) | P-GAL (screenshot 3, plus a caption block) |
| S12 | P-GAL or text continuation | P-FILM |
| S13 | P-COLO (a short "Read on the web" column) | P-LINK |
| S14 | the book closes; back cover glimpse P-BACK |

**MiniLocker (Vol. III)** uses a shorter sequence: P-END + P-HALF are skipped (the book opens straight to P-TITLE with P-COLO on the left), then P-GAL, P-FILM + P-LINK on one spread.

## 6. Text and truth

The page text is **always real data**: even the "texture" body text on a page the viewer will not read is taken from the project's `abstract`, `brief`, `approach` and `outcome` fields, cut at sentence boundaries. No lorem ipsum, no invented sentences. Rules and the "Do not publish" list: guide 07.

## 7. The riser and its labels

A small **two-tier walnut riser**, 36 cm wide, 24 cm deep: the lower tier holds Vol. I and Vol. II, the upper (6 cm higher, set 8 cm back) holds Vol. III and Vol. IV. Each book stands, cover to the camera, leaning 4 degrees back, on a thin brass lip. Dimensions and offsets live in `config/books.ts`.

Labels (S23), one per book, on the beat:

```
  [leader line]---*     Vol. I   MiniMe
                         2026 - coming soon
```

The first line CMU Serif Italic 26 px; the second line mono 18 px; both read from the data (`title`, `year`, `status`). The status words are the data's words. Mini Me stays **coming soon**.
