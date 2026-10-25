// Web Audio: a sampled grand piano, synthesized guitar and bass tones, and game sounds.
window.Dots = window.Dots || {};

Dots.Audio = (() => {
  // Salamander Grand Piano, one sample every minor third from A0 to C8
  const PIANO = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4',
    'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8']
    .map((name, i) => ({ midi: 21 + 3 * i, url: `samples/piano/${name}.mp3` }));
  const HOLD = 1.2; // seconds a piano note rings before it's damped
  const RELEASE = 0.45;

  let ctx = null;
  let master = null;
  let enabled = true;
  let quietAt = 0; // performance time when every sound played so far has died away
  let piano = null; // the decoded samples; until they're in, the piano is synthesized

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      loadPiano();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // the microphone ignores what it hears until the sound that ends at audio time t has left the speakers
  function until(t) {
    const lag = ctx.outputLatency || ctx.baseLatency || 0;
    quietAt = Math.max(quietAt, performance.now() + (t - ctx.currentTime + lag) * 1000);
  }

  function tone(f, type, gain, dur, t, filter) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = o;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(filter[0], t);
      lp.frequency.exponentialRampToValueAtTime(filter[1], t + dur * 0.6);
      o.connect(lp);
      out = lp;
    }
    out.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
    until(t + dur);
  }

  // A sample that doesn't load is left out; its neighbours cover its notes.
  function loadPiano() {
    const load = (s) =>
      fetch(s.url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buffer) => ({ midi: s.midi, buffer }))
        .catch(() => null);
    Promise.all(PIANO.map(load)).then((list) => {
      list = list.filter(Boolean);
      if (list.length) piano = list;
    });
  }

  // the nearest sample, shifted to the pitch
  function pianoNote(midi, t) {
    const s = piano.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t); // as loud as the synthesized piano
    g.gain.setTargetAtTime(0, t + HOLD, RELEASE / 4);
    src.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + HOLD + RELEASE * 1.5);
    until(t + HOLD + RELEASE);
  }

  function ready() {
    return enabled && ensure();
  }

  // midi = sounding pitch
  function note(midi, timbre = 'piano') {
    if (!ready()) return;
    const f = Dots.Music.freq(midi);
    const t = ctx.currentTime;
    if (timbre === 'piano' && piano) {
      pianoNote(midi, t);
    } else if (timbre === 'guitar') {
      tone(f, 'sawtooth', 0.16, 1.2, t, [3500, 600]);
      tone(f * 2, 'triangle', 0.04, 0.5, t);
    } else if (timbre === 'bass') {
      tone(f, 'triangle', 0.4, 1.1, t, [1200, 250]);
      tone(f, 'sine', 0.25, 1.1, t);
    } else {
      tone(f, 'triangle', 0.3, 1.4, t);
      tone(f * 2, 'sine', 0.07, 0.8, t);
    }
  }

  function buzz(soft) {
    if (!ready()) return;
    tone(92, 'square', soft ? 0.04 : 0.07, 0.2, ctx.currentTime, [900, 300]);
  }

  function tick(final) {
    if (!ready()) return;
    tone(final ? 1320 : 880, 'sine', 0.12, 0.15, ctx.currentTime);
  }

  // Metronome click at audio time t: a short, sharp blip (1 ms attack, so its onset is t).
  // Returns a stop() that silences it if it hasn't played yet, or null when sound is off.
  function click(t, accent) {
    if (!ready()) return null;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = accent ? 2000 : 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.55, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.06);
    until(t + 0.06);
    return () => o.stop();
  }

  // The audio-clock time being heard at performance time ms (event.timeStamp, performance.now()).
  // getOutputTimestamp() accounts for output latency; the fallback estimates it.
  function heardTime(ms) {
    const ts = ctx.getOutputTimestamp && ctx.getOutputTimestamp();
    if (ts && ts.performanceTime > 0) return ts.contextTime + (ms - ts.performanceTime) / 1000;
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) + (ms - performance.now()) / 1000;
  }

  function fanfare(win) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const seq = win ? [72, 76, 79, 84] : [67, 63, 60];
    seq.forEach((m, i) => tone(Dots.Music.freq(m), 'triangle', 0.22, 0.6, t + i * 0.12));
  }

  return {
    ensure,
    note,
    buzz,
    tick,
    click,
    heardTime,
    fanfare,
    // the audio clock runs (even with sound off) once the browser lets the context start
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    get now() {
      return ctx ? ctx.currentTime : 0;
    },
    // performance time when the last sound played has died away
    get quietAt() {
      return quietAt;
    },
    setEnabled(v) {
      enabled = v;
    },
  };
})();
