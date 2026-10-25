// Instruments and their levels.
// All pitches are WRITTEN pitch. Guitar and bass are written an octave higher than they sound
// (plain clefs, no 8 mark), so they play back an octave lower.
window.Dots = window.Dots || {};

(() => {
  const { parse, range, fromStep, fromMidi } = Dots.Music;

  Dots.INSTRUMENTS = {
    piano: {
      name: 'Piano',
      desc: 'Grand staff — treble and bass clef always shown. Answer on the keyboard.',
      clefs: 'grand',
      input: 'piano',
      timbre: 'piano',
      transpose: 0,
      practiceRange: ['A0', 'C8'], // the full 88 keys
      letterOctave: 4,
    },
    guitar: {
      name: 'Guitar',
      desc: 'Treble clef, written an octave above sounding pitch. Answer on the fretboard.',
      clefs: 'treble',
      input: 'neck',
      strings: ['E5', 'B4', 'G4', 'D4', 'A3', 'E3'],
      thick: [1.2, 1.6, 2.1, 2.6, 3.2, 3.8],
      wound: [false, false, false, true, true, true],
      timbre: 'guitar',
      transpose: -12,
      letterOctave: 4,
      mic: true, // can be played into the microphone
    },
    bass: {
      name: 'Bass guitar',
      desc: 'Bass clef, written an octave above sounding pitch. Answer on the 4-string fretboard.',
      clefs: 'bass',
      input: 'neck',
      strings: ['G3', 'D3', 'A2', 'E2'],
      thick: [2.6, 3.2, 3.8, 4.5],
      wound: [true, true, true, true],
      timbre: 'bass',
      transpose: -12,
      letterOctave: 3,
    },
  };

  const MODES = {
    classic: { lives: 3, time: null, ramp: 0.012, maxSpeed: 1.45, penalty: 0 },
    sprint: { lives: Infinity, time: 60, ramp: 0.008, maxSpeed: 1.3, penalty: 3 },
    survival: { lives: 3, time: null, ramp: 0.03, maxSpeed: 2.4, penalty: 0 },
  };

  const on = (clef, notes) => notes.map((n) => ({ ...n, clef }));
  const R = (clef, a, b) => on(clef, range(a, b));
  const P = (clef, ...names) => on(clef, names.map(parse));
  // notes written under 8va (ottava 1) or 8vb (ottava -1)
  const O = (clef, ottava, a, b) => range(a, b).map((n) => ({ ...fromMidi(n.midi, ottava), clef }));
  // intervals, two notes played together: every one of each size (2 = a second … 8 = an octave) between a and b
  const IV = (clef, sizes, a, b) =>
    sizes.flatMap((size) => {
      const out = [];
      for (let s = parse(a).step; s + size - 1 <= parse(b).step; s++) {
        const notes = [fromStep(s), fromStep(s + size - 1)].map((n) => ({ ...n, clef }));
        out.push({ id: notes.map((n) => n.id).join('+'), clef, notes });
      }
      return out;
    });
  // the same intervals on both piano staves: around the treble staff and around the bass staff
  const IV2 = (sizes) => [...IV('treble', sizes, 'C4', 'C6'), ...IV('bass', sizes, 'C2', 'C4')];

  // travel = seconds a note needs from the right edge to the hit line
  // density = roughly how many notes are on screen at once
  const L = (o) => Object.assign({ mode: 'classic', density: 3, goal: 15 }, MODES[o.mode || 'classic'], o);

  Dots.Levels = {
    piano: [
      // treble clef, a few notes at a time: middle C up, the same notes an octave higher, then the staff and its ledger notes
      L({ name: 'Middle C & Friends', desc: 'Treble clef: middle C and the two notes above it.', pool: R('treble', 'C4', 'E4'), travel: 8, density: 2 }),
      L({ name: 'Up to G', desc: 'Adding F and G: the five notes from middle C up.', pool: R('treble', 'C4', 'G4'), travel: 8, density: 2 }),
      L({ name: 'G to C', desc: 'The next four notes, from G up to the C above middle C.', pool: R('treble', 'G4', 'C5'), travel: 7.8, density: 2 }),
      L({ name: 'Middle C Octave', desc: 'The whole octave from middle C up to the next C.', pool: R('treble', 'C4', 'C5'), travel: 7.6, density: 2 }),
      L({ name: 'One Octave Up', desc: 'The five notes from middle C up, an octave higher.', pool: R('treble', 'C5', 'G5'), travel: 7.5, density: 2 }),
      L({ name: 'Above the Treble', desc: 'Ledger lines over the treble staff, up to high C.', pool: R('treble', 'F5', 'C6'), travel: 7.3, density: 2 }),
      L({ name: 'Upper Octave', desc: 'The whole octave from the C above middle C up to high C.', pool: R('treble', 'C5', 'C6'), travel: 7.2, density: 2 }),
      L({ name: 'Treble Lines', desc: 'The notes sitting on the five treble lines.', pool: P('treble', 'E4', 'G4', 'B4', 'D5', 'F5'), travel: 7, density: 2 }),
      L({ name: 'Treble Spaces', desc: 'The notes in the four treble spaces.', pool: P('treble', 'F4', 'A4', 'C5', 'E5'), travel: 7, density: 2 }),
      L({ name: 'Below the Treble', desc: 'Ledger lines under the treble staff, down to A below middle C.', pool: R('treble', 'A3', 'E4'), travel: 6.8, density: 2 }),
      L({ name: 'Treble Sprint', desc: 'The whole treble clef with its ledger lines, against the clock.', pool: R('treble', 'A3', 'C6'), mode: 'sprint', goal: 25, travel: 6.5 }),
      // intervals in the treble clef: two notes at once
      L({ name: 'Treble Thirds', desc: 'Treble clef, two notes at once a third apart: on neighbouring lines or in neighbouring spaces.', pool: IV('treble', [3], 'C4', 'C6'), travel: 7.5, density: 2, goal: 12 }),
      L({ name: 'Treble Fifths', desc: 'Treble clef, two notes a fifth apart: both on lines or both in spaces, with one line or space between them.', pool: IV('treble', [5], 'C4', 'C6'), travel: 7.3, density: 2, goal: 12 }),
      L({ name: 'Treble Octaves', desc: 'Treble clef, the same note eight steps apart: one on a line, the other in a space.', pool: IV('treble', [8], 'C4', 'C6'), travel: 7.2, density: 2, goal: 12 }),
      // bass clef the same way down: middle C down, an octave lower, then the staff and its ledger notes
      L({ name: 'Into the Bass', desc: 'Bass clef: middle C and the two notes below it.', pool: R('bass', 'A3', 'C4'), travel: 7, density: 2 }),
      L({ name: 'Down to F', desc: 'Adding G and F: the five notes from middle C down.', pool: R('bass', 'F3', 'C4'), travel: 7, density: 2 }),
      L({ name: 'F to C', desc: 'The next four notes, from F down to the C below middle C.', pool: R('bass', 'C3', 'F3'), travel: 6.8, density: 2 }),
      L({ name: 'Octave Below Middle C', desc: 'The whole octave from middle C down to the next C.', pool: R('bass', 'C3', 'C4'), travel: 6.6, density: 2 }),
      L({ name: 'One Octave Down', desc: 'The five notes from middle C down, an octave lower.', pool: R('bass', 'F2', 'C3'), travel: 6.5, density: 2 }),
      L({ name: 'Below the Bass', desc: 'Ledger lines under the bass staff, down to low C.', pool: R('bass', 'C2', 'G2'), travel: 6.4, density: 2 }),
      L({ name: 'Lower Octave', desc: 'The whole octave from the C below middle C down to low C.', pool: R('bass', 'C2', 'C3'), travel: 6.2 }),
      L({ name: 'Bass Lines', desc: 'The notes sitting on the five bass lines.', pool: P('bass', 'G2', 'B2', 'D3', 'F3', 'A3'), travel: 6.2, goal: 18 }),
      L({ name: 'Bass Spaces', desc: 'The notes in the four bass spaces.', pool: P('bass', 'A2', 'C3', 'E3', 'G3'), travel: 6, goal: 18 }),
      L({ name: 'Above the Bass', desc: 'Ledger lines over the bass staff, up to E above middle C.', pool: R('bass', 'A3', 'E4'), travel: 6, goal: 18 }),
      // intervals in the bass clef
      L({ name: 'Bass Thirds', desc: 'Bass clef, two notes at once a third apart: on neighbouring lines or in neighbouring spaces.', pool: IV('bass', [3], 'C2', 'C4'), travel: 7, density: 2, goal: 12 }),
      L({ name: 'Bass Fifths', desc: 'Bass clef, two notes a fifth apart: both on lines or both in spaces, with one line or space between them.', pool: IV('bass', [5], 'C2', 'C4'), travel: 6.8, density: 2, goal: 12 }),
      L({ name: 'Bass Octaves', desc: 'Bass clef, the same note eight steps apart: one on a line, the other in a space.', pool: IV('bass', [8], 'C2', 'C4'), travel: 6.8, density: 2, goal: 12 }),
      // both staves
      L({ name: 'Middle C Crossing', desc: 'The same notes around middle C, written on either staff.', pool: [...R('treble', 'A3', 'E4'), ...R('bass', 'A3', 'E4')], travel: 5.5, goal: 20 }),
      L({ name: 'Grand Sprint', desc: 'Both clefs mixed, against the clock.', pool: [...R('bass', 'E2', 'B3'), ...R('treble', 'C4', 'A5')], mode: 'sprint', goal: 30, travel: 5 }),
      // the other intervals, on both staves
      L({ name: 'Seconds', desc: 'Two neighbouring notes, one on a line and one in a space, on either staff.', pool: IV2([2]), travel: 6.5, density: 2, goal: 12 }),
      L({ name: 'Fourths', desc: 'Two notes a fourth apart, one on a line and one in a space, on either staff.', pool: IV2([4]), travel: 6.3, density: 2, goal: 12 }),
      L({ name: 'Sixths', desc: 'Two notes a sixth apart, one on a line and one in a space, on either staff.', pool: IV2([6]), travel: 6.2, density: 2, goal: 12 }),
      L({ name: 'Interval Mix', desc: 'Seconds, thirds, fourths, fifths, sixths and octaves mixed, on either staff.', pool: IV2([2, 3, 4, 5, 6, 8]), travel: 6, density: 2, goal: 15 }),
      L({ name: 'Ledger Land', desc: 'Only notes on ledger lines, above and below both staves.', pool: [...P('treble', 'A3', 'B3', 'C4', 'A5', 'B5', 'C6'), ...P('bass', 'C2', 'D2', 'E2', 'C4', 'D4', 'E4')], travel: 4.8, goal: 20 }),
      // the far ends of the keyboard: up to five ledger lines, then 8va / 8vb
      L({ name: 'High Treble', desc: 'Up to five ledger lines over the treble staff, as high as C7.', pool: R('treble', 'C6', 'C7'), travel: 4.8, goal: 20 }),
      L({ name: 'Deep Bass', desc: 'Down to five ledger lines under the bass staff, as low as C1.', pool: R('bass', 'C1', 'C2'), travel: 4.7, goal: 20 }),
      L({ name: 'Top Octave 8va', desc: 'Above C7, notes are written an octave lower under an 8va sign — up to the top C8.', pool: [...R('treble', 'A6', 'C7'), ...O('treble', 1, 'D7', 'C8')], travel: 4.6, goal: 20 }),
      L({ name: 'Lowest Keys 8vb', desc: 'Below C1, notes are written an octave higher under an 8vb sign — down to the bottom A0.', pool: [...O('bass', -1, 'A0', 'B0'), ...R('bass', 'C1', 'F1')], travel: 4.5, goal: 20 }),
      L({ name: 'Maestro', desc: 'All 88 keys, A0 to C8 — faster and faster. Survive!', pool: [...O('bass', -1, 'A0', 'B0'), ...R('bass', 'C1', 'B3'), ...R('treble', 'C4', 'C7'), ...O('treble', 1, 'D7', 'C8')], mode: 'survival', goal: 40, travel: 4 }),
    ],
    guitar: [
      L({ name: 'Open Strings', desc: 'The six open strings, from low E to high E.', pool: P('treble', 'E3', 'A3', 'D4', 'G4', 'B4', 'E5'), travel: 8, density: 2 }),
      L({ name: 'Top Strings', desc: 'High E and B strings, open to 3rd fret.', pool: R('treble', 'B4', 'G5'), travel: 7.5, density: 2 }),
      L({ name: 'G String', desc: 'Adding the G string.', pool: R('treble', 'G4', 'G5'), travel: 7, density: 2 }),
      L({ name: 'D String', desc: 'Adding the D string.', pool: R('treble', 'D4', 'G5'), travel: 6.5, goal: 18 }),
      L({ name: 'A String', desc: 'Below the staff: the A string.', pool: R('treble', 'A3', 'F4'), travel: 6.5, goal: 18 }),
      L({ name: 'Low E String', desc: 'Deep down on the ledger lines.', pool: R('treble', 'E3', 'C4'), travel: 6, goal: 18 }),
      L({ name: 'First Position', desc: 'Every note from open low E to the 3rd fret on top.', pool: R('treble', 'E3', 'G5'), travel: 5.5, goal: 25 }),
      L({ name: 'Position Sprint', desc: 'Up to the 5th fret, against the clock.', pool: R('treble', 'E3', 'A5'), mode: 'sprint', goal: 30, travel: 5 }),
      L({ name: 'Up the Neck', desc: 'High notes up to the 12th fret.', pool: R('treble', 'E5', 'E6'), travel: 4.8, goal: 20 }),
      L({ name: 'Shredder', desc: 'The whole neck — faster and faster. Survive!', pool: R('treble', 'E3', 'E6'), mode: 'survival', goal: 40, travel: 4 }),
    ],
    bass: [
      L({ name: 'Open Strings', desc: 'The four open strings: E, A, D and G.', pool: P('bass', 'E2', 'A2', 'D3', 'G3'), travel: 8, density: 2 }),
      L({ name: 'G & D Strings', desc: 'The two high strings, open to 4th fret.', pool: R('bass', 'D3', 'B3'), travel: 7.5, density: 2 }),
      L({ name: 'A String', desc: 'Adding the A string.', pool: R('bass', 'A2', 'F3'), travel: 7, density: 2 }),
      L({ name: 'Low E String', desc: 'Down to the ledger line below the staff.', pool: R('bass', 'E2', 'C3'), travel: 6.5, goal: 18 }),
      L({ name: 'First Position Sprint', desc: 'All four strings, against the clock.', pool: R('bass', 'E2', 'B3'), mode: 'sprint', goal: 25, travel: 6.2 }),
      L({ name: 'Fifth Fret', desc: 'Stretching up to middle C.', pool: R('bass', 'E2', 'C4'), travel: 6, goal: 20 }),
      L({ name: 'Above the Staff', desc: 'High notes on the G string.', pool: R('bass', 'G3', 'E4'), travel: 5.5, goal: 18 }),
      L({ name: 'Twelfth Fret', desc: 'Way up the neck to the 12th fret.', pool: R('bass', 'B3', 'G4'), travel: 4.5, goal: 20 }),
      L({ name: 'Groove Sprint', desc: 'The whole neck, against the clock.', pool: R('bass', 'E2', 'G4'), mode: 'sprint', goal: 35, travel: 4 }),
      L({ name: 'Bass Hero', desc: 'Everything — faster and faster. Survive!', pool: R('bass', 'E2', 'G4'), mode: 'survival', goal: 40, travel: 3.5 }),
    ],
  };
})();
