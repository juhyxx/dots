// Note math: diatonic steps, MIDI numbers and note naming (B vs H system).
window.Dots = window.Dots || {};

Dots.Music = (() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
  const PC_TO_IDX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
  const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

  // step = octave * 7 + letter index; C4 (middle C) = 28
  function fromStep(step) {
    const oct = Math.floor(step / 7);
    const idx = step - oct * 7;
    return { step, idx, oct, midi: 12 * (oct + 1) + SEMITONES[idx], id: LETTERS[idx] + oct };
  }

  function parse(name) {
    const m = /^([A-G])(\d)$/.exec(name);
    if (!m) throw new Error('Bad note name: ' + name);
    return fromStep(Number(m[2]) * 7 + LETTERS.indexOf(m[1]));
  }

  function range(from, to) {
    const out = [];
    for (let s = parse(from).step; s <= parse(to).step; s++) out.push(fromStep(s));
    return out;
  }

  const pc = (midi) => ((midi % 12) + 12) % 12;

  function letter(idx, naming) {
    return idx === 6 && naming === 'H' ? 'H' : LETTERS[idx];
  }

  function label(note, naming) {
    return letter(note.idx, naming) + note.oct;
  }

  // Letter index of a white-key MIDI note, or null for black keys.
  function idxFromMidi(midi) {
    const v = PC_TO_IDX[pc(midi)];
    return v === undefined ? null : v;
  }

  // Any MIDI note as a staff note; black keys become the natural below plus a sharp.
  // ottava 1 = written an octave lower under 8va, -1 = an octave higher under 8vb.
  // step is the written position; midi, oct and id stay the real pitch.
  function fromMidi(midi, ottava = 0) {
    const written = midi - 12 * ottava;
    const sharp = idxFromMidi(written) === null;
    const nat = sharp ? written - 1 : written;
    const oct = Math.floor(nat / 12) - 1;
    const n = fromStep(oct * 7 + idxFromMidi(nat));
    return { ...n, midi, sharp, ottava, oct: oct + ottava, id: LETTERS[n.idx] + (oct + ottava) };
  }

  function midiName(midi, naming) {
    const p = pc(midi);
    if (naming === 'H') {
      if (p === 11) return 'H';
      if (p === 10) return 'B';
    }
    return SHARP_NAMES[p];
  }

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // ---- chords

  // sharps, to match how black keys are written on the staff
  const ROOTS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  // [suffix, required, optional] intervals above the root (semitones, mod 12). Optional notes
  // (usually the 5th, 9th or 11th) may be left out, as they often are in real voicings.
  // Listed roughly by how common they are; earlier wins when one set fits several names.
  // Intervals: 1 ♭9, 2 9, 3 ♭3/♯9, 4 3, 5 11, 6 ♭5/♯11, 7 5, 8 ♯5/♭13, 9 6/13, 10 ♭7, 11 7.
  const CHORD_TYPES = [
    ['', [4, 7]], ['m', [3, 7]],
    ['7', [4, 10], [7]], ['maj7', [4, 11], [7]], ['m7', [3, 10], [7]],
    ['dim', [3, 6]], ['aug', [4, 8]], ['sus4', [5, 7]], ['sus2', [2, 7]], ['5', [7]],
    ['6', [4, 7, 9]], ['m6', [3, 7, 9]], ['6/9', [4, 9, 2], [7]], ['m6/9', [3, 9, 2], [7]],
    ['m7♭5', [3, 6, 10]], ['dim7', [3, 6, 9]], ['m(maj7)', [3, 11], [7]],
    ['7♭5', [4, 6, 10]], ['7♯5', [4, 8, 10]], ['maj7♯5', [4, 8, 11]], ['7sus4', [5, 10], [7]],
    ['add9', [4, 7, 2]], ['m(add9)', [3, 7, 2]],
    ['9', [4, 10, 2], [7]], ['maj9', [4, 11, 2], [7]], ['m9', [3, 10, 2], [7]], ['m(maj9)', [3, 11, 2], [7]],
    ['7♭9', [4, 10, 1], [7]], ['7♯9', [4, 10, 3], [7]], ['9sus4', [5, 10, 2], [7]],
    ['add11', [4, 7, 5]], ['m(add11)', [3, 7, 5]],
    ['11', [4, 10, 2, 5], [7]], ['m11', [3, 10, 5], [2, 7]],
    ['7♯11', [4, 10, 6, 7], [2]], ['9♯11', [4, 10, 2, 6], [7]], ['maj7♯11', [4, 11, 6], [2, 7]],
    ['13', [4, 10, 9], [2, 5, 7]], ['m13', [3, 10, 9], [2, 5, 7]], ['maj13', [4, 11, 9], [2, 6, 7]],
    ['7♭13', [4, 10, 8, 7], [2]], ['7♭9♯5', [4, 10, 1, 8]], ['7♯9♯5', [4, 10, 3, 8]],
    ['13♭9', [4, 10, 9, 1], [7]], ['13♯9', [4, 10, 9, 3], [7]], ['13♯11', [4, 10, 9, 6], [2, 7]],
  ];
  const INTERVALS = ['octave', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
    'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];

  function rootName(p, naming) {
    if (naming === 'H' && p === 10) return 'B';
    if (naming === 'H' && p === 11) return 'H';
    return ROOTS[p];
  }

  // Name for notes played together: an interval for two notes, a chord symbol for more, or null.
  function chordName(midis, naming) {
    const sorted = [...new Set(midis)].sort((a, b) => a - b);
    if (sorted.length === 2) return INTERVALS[(sorted[1] - sorted[0]) % 12];
    const pcs = [...new Set(sorted.map(pc))];
    if (pcs.length === 1) return 'octaves';
    const bass = pc(sorted[0]);
    let best = null;
    for (const r of pcs) {
      const ivs = pcs.filter((p) => p !== r).map((p) => (p - r + 12) % 12);
      CHORD_TYPES.forEach(([suffix, req, opt = []], i) => {
        if (!req.every((iv) => ivs.includes(iv))) return;
        if (!ivs.every((iv) => req.includes(iv) || opt.includes(iv))) return;
        const score = (r === bass ? 0 : 1000) + i; // a root in the bass wins, then the commoner name
        if (!best || score < best.score) best = { r, suffix, score };
      });
    }
    if (!best) return null;
    return rootName(best.r, naming) + best.suffix + (best.r === bass ? '' : '/' + rootName(bass, naming));
  }

  return { LETTERS, fromStep, fromMidi, parse, range, letter, label, idxFromMidi, midiName, chordName, freq };
})();
