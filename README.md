# Dots — for musical idiots

A browser game for learning to read sheet music. Notes slide in from the right; name each one before it reaches the orange line.

Play it at **https://juhyxx.github.io/dots/**.

No server and no build step. Open `index.html` in a browser, or serve the folder with any static server. The music font ([Bravura](https://github.com/steinbergmedia/bravura), SIL Open Font License) is bundled in `fonts/`, so clefs and accidentals render the same everywhere, including offline.

## Instruments

| Instrument | Staff | Answer with |
|---|---|---|
| Piano | Grand staff (treble + bass, always shown). Lessons start with treble (G) clef, then move to bass (F) clef | On-screen keyboard |
| Guitar | Treble clef, written an octave above sounding pitch | 6-string fretboard, frets 0–12 |
| Bass guitar | Bass clef, written an octave above sounding pitch | 4-string fretboard, frets 0–12 |

Every instrument also accepts:
- **Computer keyboard:** letters `C D E F G A` plus `B` or `H`, depending on the note-name setting. Typed letters never check the octave.
- **MIDI keyboard:** uses Web MIDI (Chrome or Edge). Connect it from the MIDI chip or in Settings. For guitar and bass, MIDI input is read as sounding pitch. On the start and results screens, any MIDI key works like Enter, and it doesn't make a sound there.

## Practice

Each instrument has a **Practice** card at the top of its level list. It's free play: there's no score and no clock. Every note you play (on screen or on MIDI) appears on the staff right away with its name, and black keys are shown as sharps. Notes played together (within 150 ms, e.g. a chord on MIDI) are written as one chord and named: an interval for two notes ("major 3rd"), or a chord symbol for three or more: triads, sixths and sevenths (C, Am7, G/B), extended chords (9, 11, 13, add9, 6/9) and altered ones (7♭9, 7♯9, 7♯11, 7♭13, 13♭9…). Typical voicings that leave out the 5th, 9th or 11th are recognised too. Typing a letter shows that note on the staff and lights it up on the instrument.

## Levels

Guitar and bass have 10 levels each and start with the open strings. Piano has 19 levels and covers all 88 keys (A0–C8): first the treble clef, then the bass clef, each followed by its ledger-line notes, then both staves together. The last lessons cover the extremes: up to five ledger lines (C1 and C7), and beyond that 8va / 8vb, which is how printed music writes the top and bottom octaves. You unlock the next one by passing the current one. Notes move faster as the levels go up, and they also speed up a little within a level as you get answers right.

- **Classic:** get N right; you have 3 lives, and a wrong answer or a missed note costs one.
- **Sprint:** get N right within 60 s; each mistake costs 3 s.
- **Survival:** like Classic, but the speed keeps rising.

You earn stars for accuracy (95 % or better = ★★★, 80 % or better = ★★). If you miss a note, it lights up on the instrument. Notes you get wrong come back more often, and the level screen lists your "trouble notes".

Every screen has its own address: `#/piano` is the level list, `#/piano/3` is level 3 and `#/piano/practice` is practice. So the browser's Back button works and you can bookmark a level. The address of a locked level opens the level list instead.

## Settings

Note names (B or H), labels on the instrument, theme, whether the octave must match, sound, sound for MIDI input, and unlock all levels. Settings and progress are saved in `localStorage`.

The theme follows the system's light or dark setting until you pick one. Use the sun/moon button in the top bar to switch between daylight and night, or choose "Match the system" in Settings to go back to following the system. The staff stays on light paper in both themes.

With "octave must match" on, playing the right letter in the wrong octave shows **OK, but wrong octave**. It still counts toward the goal and costs no life, but scores half points, doesn't grow your streak, and lights up the correct key or fret.

## Code

```
index.html          screens + settings dialog
css/style.css
js/music.js         note math, B/H naming
js/levels.js        instruments + 30 level definitions
js/game.js          engine (spawn, move, judge, score)
js/staff.js         canvas staff renderer
js/instruments.js   clickable piano + fretboard
js/audio.js         Web Audio synth
js/midi.js          Web MIDI input
js/store.js         localStorage
js/app.js           screens, input routing, HUD
```

## Deployment

Every push to `master` deploys to GitHub Pages via `.github/workflows/pages.yml`. The workflow copies `index.html`, `css/`, `js/` and `fonts/` as they are, with no build step, and force-pushes them to the `gh-pages` branch, which Pages serves. You can also run it by hand from the Actions tab.
