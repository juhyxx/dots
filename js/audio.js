// Tiny Web Audio synth: instrument-ish tones plus game sounds.
window.Dots = window.Dots || {};

Dots.Audio = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;

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
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
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
  }

  function ready() {
    return enabled && ensure();
  }

  // midi = sounding pitch
  function note(midi, timbre = 'piano') {
    if (!ready()) return;
    const f = Dots.Music.freq(midi);
    const t = ctx.currentTime;
    if (timbre === 'guitar') {
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
    fanfare,
    setEnabled(v) {
      enabled = v;
    },
  };
})();
