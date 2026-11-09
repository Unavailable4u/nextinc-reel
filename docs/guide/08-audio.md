# 08 - Audio

A realistic silent object becomes realistic when it makes the right small sounds. **Record your own foley** if you can: it is the cheapest realism in the project, and it has no licensing problem.

## 1. Record your own (30 minutes, a phone, a quiet room)

Use a hardcover book you own. Phone 5-10 cm from the book, recording in a wardrobe or under a duvet to kill echo. Record 3-5 takes of each:

| File (`public/audio/foley/`) | What to do |
|---|---|
| `book-lift-01..03.wav` | lift one book from a stack of three |
| `book-set-01..03.wav` | place a book on a wooden table, gently, then slightly firmer |
| `cover-open-01..02.wav` | open the front board slowly |
| `cover-close-01..02.wav` | close it, letting it land |
| `page-turn-01..08.wav` | turn single pages: slow, medium, quick |
| `riffle-01..03.wav` | thumb the page block, 1.5 s |
| `cloth-rustle-01..03.wav` | slide your sleeve on a cover |
| `paper-settle-01..02.wav` | a page falling and settling |
| `roomtone.wav` | 60 s of the room, doors closed |

Save 48 kHz, 24-bit WAV (or 16-bit if the phone cannot). Trim silence at both ends and normalise each to -3 dBFS peak. List them in `docs/reference/asset-licences.md` ("own recording, date").

If you use library sounds instead, use CC0 or properly licensed ones and list the licence for every file.

## 2. The cue sheet (frames at 60 fps; the authoritative copy is `src/config/sfx.ts`)

| Frame | Cue | Level (dB, relative to full scale after the mix) |
|---|---|---|
| 0-60 | room tone fades in | -42 |
| 960 | pile compress, then `book-lift` | -24 |
| 1000 | cloth rustle (operator) | -34 |
| 1440 | `cover-open` | -22 |
| 1560 | `page-turn` | -26 |
| 1680 | `page-turn` | -26 |
| 1920-2030 | `riffle` (the loudest paper sound) | -20 |
| 2040 | `paper-settle` | -32 |
| 2280 | `page-turn` | -26 |
| 2520 | `page-turn` | -26 |
| 2820 | `cover-close` | -22 |
| 2940 | `book-set` | -22 |
| 3000 | `book-lift` | -24 |
| 3360 | `cover-open` | -22 |
| 3480-3535 | `riffle` (short) | -22 |
| 3540 | `paper-settle` | -32 |
| 3870 | `cover-close` | -22 |
| 3900 | `book-set` | -22 |
| 4140-4200 | cloth rustle (the chair passes), low sweep | -30 |
| 4380, 4440, 4500, 4560 | soft label ticks (one per book) | -34 |
| 4800-5000 | the lamp's warmth falls: a low swell | -30 |
| 4860 | wordmark: one soft, round tone | -26 |
| 5280-5399 | everything fades to silence over the last 1 s | |

The frame in the table is the **visual event** (a beat). The sound file starts one or two frames earlier (sound leads picture slightly, never trails it).

## 3. Music (decision D-16: open)

Option A (default): **no melodic music.** Room tone and foley, plus a very light **ambient bed** (a held warm pad, 120 BPM pulse implied only by the foley) from bar 12 to the end at -30 dB. Option B: a licensed track at 120 BPM, kept under -22 dB, with the licence kept in the repo. Never a track you cannot show the licence for.

## 4. Mix and delivery

- Mix at 48 kHz. Master loudness **-16 LUFS integrated, true peak -1.5 dBTP** (the same targets as `minilocker-film`'s two-pass `loudnorm`). A quiet film is fine; the cue levels above sit well under that, so the normalisation raises the whole mix.
- Stereo: foley centred with a little width; room tone wide; the riffle sweeps slightly left to right.
- Silence is allowed and good. Do not add sounds to fill space.
- The site player may play with sound off: nothing essential is audio-only.

## 5. Accessibility

Publish a text description of the film (guide 10, "Text alternative") with the page's embed. There is no speech, so no captions file is needed; the text description covers the visual events and the names of the four books.
