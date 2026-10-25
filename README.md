# Dots — for musical idiots

A browser game for learning to read sheet music. Notes slide in from the right; name each one before it reaches the orange line. A metronome game trains your timing too.

The game speaks English, Czech, German, Spanish, French, Italian, Brazilian Portuguese and Simplified Chinese.

Play it at **https://juhyxx.github.io/dots/**.

You can install it as an app (Add to Home Screen on phones, the install button in Chrome's or Edge's address bar on desktop). After the first visit it also works offline.

No server and no build step. Open `index.html` in a browser, or serve the folder with any static server (installing, offline play and the piano samples need a server, not `file://`; without it the piano is synthesized). The music font ([Bravura](https://github.com/steinbergmedia/bravura), SIL Open Font License) is bundled in `fonts/`, so clefs and accidentals render the same everywhere, including offline.

## Instruments

| Instrument | Staff | Answer with |
|---|---|---|
| Piano | Grand staff (treble + bass, always shown). Lessons start with treble (G) clef, then move to bass (F) clef | On-screen keyboard |
| Guitar | Treble clef, written an octave above sounding pitch | 6-string fretboard, frets 0–12 |
| Bass guitar | Bass clef, written an octave above sounding pitch | 4-string fretboard, frets 0–12 |

Every instrument also accepts:
- **Computer keyboard:** letters `C D E F G A` plus `B` or `H`, depending on the note-name setting. With solfège names, `1`–`7` stand for Do–Si (letters still work). Typed keys never check the octave.
- **MIDI keyboard:** uses Web MIDI (Chrome or Edge). Connect it in Settings. For guitar and bass, MIDI input is read as sounding pitch. On the start and results screens, any MIDI key works like Enter, and it doesn't make a sound there.
- **Audio input (guitar only):** play the notes on a real guitar into a microphone or an audio interface. Turn it on with the Audio in chip on the guitar screens or in Settings; the chip's four bars light up as the input gets louder, so you can see that sound is coming in. It listens only during guitar levels and practice, and lets go of the input everywhere else. It hears one note at a time (not chords), reads it as sounding pitch like MIDI, and works like Enter on the start and results screens. Pitch comes from the YIN algorithm. A note counts once it has held steady for about 60 ms, and the same note counts again only after a new pluck or a silence. While the game's own sounds play (the wrong-answer buzz, the countdown), the audio input ignores what it hears, so speakers don't trigger answers. A very soft note in a noisy room can go unheard, and talking near the mic can register as notes.

## Practice

Each instrument has a **Practice** card at the top of its level list. It's free play: there's no score and no clock. Every note you play (on screen, on MIDI or through the audio input) appears on the staff right away with its name, and black keys are shown as sharps. Notes played together (within 150 ms, e.g. a chord on MIDI) are written as one chord and named: an interval for two notes ("major 3rd"), or a chord symbol for three or more: triads, sixths and sevenths (C, Am7, G/B), extended chords (9, 11, 13, add9, 6/9) and altered ones (7♭9, 7♯9, 7♯11, 7♭13, 13♭9…). Typical voicings that leave out the 5th, 9th or 11th are recognised too. Typing a letter shows that note on the staff and lights it up on the instrument.

## Levels

Guitar and bass have 10 levels each and start with the open strings. Piano has 39 levels and covers all 88 keys (A0–C8). It adds a few notes at a time: in the treble clef, middle C and the notes above it, then the same five notes an octave higher, then the lines, spaces and ledger notes; the bass clef goes the same way down from middle C. Each clef ends with intervals: thirds, fifths and octaves, two notes at once that you play both of, in any order (on MIDI you can play them together). Then both staves together, with seconds, fourths, sixths and a mix of all the intervals. The last lessons cover the extremes: up to five ledger lines (C1 and C7), and beyond that 8va / 8vb, which is how printed music writes the top and bottom octaves. You unlock the next one by passing the current one. Notes move faster as the levels go up, and they also speed up a little within a level as you get answers right.

- **Classic:** get N right; you have 3 lives, and a wrong answer or a missed note costs one.
- **Sprint:** get N right within 60 s; each mistake costs 3 s.
- **Survival:** like Classic, but the speed keeps rising.

You earn stars for accuracy (95 % or better = ★★★, 80 % or better = ★★). If you miss a note, it lights up on the instrument. Notes you get wrong come back more often, and the level screen lists your "trouble notes".

Every screen has its own address: `#/piano` is the level list, `#/piano/3` is level 3 and `#/piano/practice` is practice (`#/metronome/calibrate` for the metronome). So the browser's Back button works and you can bookmark a level. The address of a locked level opens the level list instead.

## Metronome

The metronome clicks in 4/4 with a one-bar count-in. Tap on every click: with any key, the Tap pad (mouse or touch) or any MIDI key. Beats slide in to a measuring line in the middle of the stage, and each tap is graded by how far it was from the beat: **Perfect** within 35 ms, **Good** within 80 ms, otherwise early or late. A meter under the line shows your last taps and your average. The results show your average offset (do you rush or drag?) and your spread (how steady you are).

There are 10 levels, from Largo (60 BPM) to Presto (160 BPM). The last two have silent bars, where the click stops and you keep the beat on your own. Accuracy counts a Perfect as 1 and a Good as ½, and extra taps count against you. You need 60 % to pass (50 % with silent bars).

Speakers, Bluetooth headphones and keyboards all add some delay. Run **Calibrate** (the first card) once with your usual setup: tap along to 16 clicks, and Dots measures how late your taps arrive and corrects every later tap by that much. Timing uses the Web Audio clock and the events' own timestamps, so it doesn't depend on the frame rate.

## Settings

Language, note names (B, H or solfège), labels on the instrument, theme, whether the octave must match, sound, sound for MIDI input, audio input for guitar, and unlock all levels. Settings and progress are saved in `localStorage`.

The language starts as the browser's own (or English). You can pick another one by its name; "Automatic" goes back to the browser's choice. Note names follow the language until you choose them yourself: C D E F G A B for English and Chinese, H instead of B for Czech and German, and solfège (Do Re Mi…) for Spanish, French, Italian and Portuguese. The name and tagline "Dots — for musical idiots" stay in English in every language.

The theme follows the system's light or dark setting until you pick one. Use the sun/moon button in the top bar to switch between daylight and night, or choose "Match the system" in Settings to go back to following the system. The staff stays on light paper in both themes.

With "octave must match" on, playing the right letter in the wrong octave shows **OK, but wrong octave**. It still counts toward the goal and costs no life, but scores half points, doesn't grow your streak, and lights up the correct key or fret.

## Code

```
index.html          screens + settings dialog
sw.js               service worker: offline play, picks up new deploys
manifest.webmanifest  app name, colours and icons for installing
icons/              app icons (PNG + SVG favicon)
css/style.css
img/*.webp          instrument photos for the home cards (800×400 + 400×200)
samples/piano/      grand piano samples, one every minor third (A0–C8)
js/i18n.js          language detection, string lookup (with plurals), data-i18n attributes
js/lang/*.js        one file per language; en.js is the source and the fallback
js/music.js         note math, B/H/solfège naming
js/levels.js        instruments + their level definitions
js/game.js          engine (spawn, move, judge, score)
js/staff.js         canvas staff renderer
js/instruments.js   clickable piano + fretboard
js/rhythm.js        metronome levels + engine (schedule clicks, judge taps)
js/beats.js         canvas renderer for the metronome
js/audio.js         Web Audio: sampled piano, synth guitar/bass, metronome click, audio clock ↔ event time
js/midi.js          Web MIDI input
js/mic.js           audio input: YIN pitch detection, one report per played note
js/store.js         localStorage
js/app.js           screens, URLs, input routing, HUD, settings
```

To add a language: copy `js/lang/en.js`, translate the strings (keep `{placeholders}` and markup), add the level names and descriptions as the other language files do, add a `<script>` tag in `index.html` and the file to `FILES` in `sw.js`, and list the language in `LANGS` and `NAMING` in `js/i18n.js`.

The card photos are 2:1 crops of the originals, saved as WebP at 800×400 and 400×200 with no metadata. `srcset` lets each screen load only the size it needs. The originals stay out of git (`.gitignore`), because they're full size and carry camera and GPS data.

## Deployment

Every push to `master` deploys to GitHub Pages via `.github/workflows/pages.yml`. The workflow copies `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `fonts/`, `icons/`, `samples/` and the `img/*.webp` photos and force-pushes them to the `gh-pages` branch, which Pages serves. You can also run it by hand from the Actions tab.

The only change on the way is the version stamp. Each deploy's version is its short commit hash. It's added to every CSS, JS, image and font URL as `?v=<hash>` (in `index.html`, `css/style.css` and `sw.js`) and becomes `VERSION` in `sw.js`. So browsers never mix a new page with old scripts from their cache:

- The service worker loads the page itself from the network first (and serves it from its cache only offline), so a new deploy shows up the next time the game is opened.
- Every new deploy changes `sw.js`, so the browser installs the new worker. It downloads that version's files into a fresh cache and deletes the old one.
- Locally, `sw.js` keeps `VERSION = 'dev'`. Then it loads everything from the network first, so your edits show up on reload; the cache is only for offline.

Before stamping, the workflow checks that `FILES` in `sw.js` lists every local file `index.html` and `css/style.css` load, and only files that exist. Otherwise the deploy fails.

## Credits

- Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0), via the Tone.js audio repository
