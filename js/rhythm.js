// Metronome game: clicks at a steady tempo, the player taps along, and every tap is graded in ms.
// All times are on the audio clock (seconds), so the clicks, the judging and the drawing share one timeline.
window.Dots = window.Dots || {};

(() => {
  const { Audio } = Dots;
  const BEATS = 4; // per bar (4/4); one bar of count-in comes first
  const LEAD = 0.3; // s from Start to the first count-in click
  const LOOKAHEAD = 0.15; // s of clicks handed to the audio clock ahead of time
  const PERFECT = 35; // ms either side of the beat
  const GOOD = 80;

  Dots.INSTRUMENTS.metronome = { name: 'Metronome', rhythm: true };

  // bars: judged bars after the count-in. gaps: [bars with click, silent bars], repeating.
  // stars: accuracy needed for 1 (= pass), 2 and 3 stars. Accuracy = (perfect + good / 2) / (beats + extra taps).
  const L = (o) => Object.assign({ mode: 'tempo', bars: 8, stars: [0.6, 0.75, 0.9] }, o);
  const GAP = { mode: 'gap', bars: 12, stars: [0.5, 0.65, 0.8] };

  Dots.Levels.metronome = [
    L({ name: 'Largo', desc: 'Slow and broad. Take your time and tap on every click.', bpm: 60 }),
    L({ name: 'Adagio', desc: 'Still slow. Slow beats are harder to hit than they sound.', bpm: 70 }),
    L({ name: 'Andante', desc: 'A walking pace.', bpm: 80 }),
    L({ name: 'Moderato', desc: 'Right in the middle: not slow, not fast.', bpm: 92 }),
    L({ name: 'Allegretto', desc: 'Moderately quick and light.', bpm: 104 }),
    L({ name: 'Allegro', desc: 'Quick and lively.', bpm: 116 }),
    L({ name: 'Vivace', desc: 'Lively and fast.', bpm: 132 }),
    L({ name: 'Presto', desc: 'Very fast. Stay relaxed.', bpm: 160 }),
    L({ name: 'Silent Bars', desc: 'Two bars of click, two bars of silence. Keep the beat going on your own.', bpm: 88, ...GAP }),
    L({ name: 'Inner Clock', desc: 'One bar of click, then three silent bars. Can your inner clock keep time?', bpm: 112, ...GAP, gaps: [1, 3] }),
  ];
  Dots.Levels.metronome.forEach((l) => l.mode === 'gap' && !l.gaps && (l.gaps = [2, 2]));

  // Measures the delay between the click and the player's taps (audio output, Bluetooth, input lag).
  // Slow, so even a long delay stays within half a beat of the click it belongs to.
  const CALIBRATE = { name: 'Calibrate', calibrate: true, bpm: 75, bars: 4, stars: [0, 0, 0] };
  const CAL_MIN_TAPS = 12;

  const median = (a) => {
    const s = [...a].sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  class Metronome {
    // latency: ms taken off every tap (ignored while calibrating)
    constructor(level, { latency = 0, hooks = {} } = {}) {
      this.rhythm = true;
      this.level = level;
      this.latency = level.calibrate ? 0 : latency;
      this.hooks = hooks;
      this.state = 'intro'; // intro | countin | playing | paused | over
      this.period = 60 / level.bpm;
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.extra = [];
      this.fx = [];
      this.heard = 0; // audio time being heard now, updated every frame
      const [on, off] = level.gaps || [1, 0];
      this.beats = Array.from({ length: level.bars * BEATS }, (_, i) => ({
        i,
        accent: i % BEATS === 0,
        audible: Math.floor(i / BEATS) % (on + off) < on,
        t: i * this.period, // relative until startAt() places it on the audio clock
        grade: null, // perfect | good | off | miss
        off: null, // ms, + = late
      }));
    }

    emit(name, ...args) {
      if (this.hooks[name]) this.hooks[name](...args);
    }

    get done() {
      return this.beats.filter((b) => b.grade).length;
    }

    begin() {
      if (this.state !== 'intro') return;
      Audio.ensure();
      this.state = 'countin';
      this.pending = true; // timeline starts once the audio clock runs
    }

    // Lays out a count-in bar from audio time `at`, then the beats from `from` on.
    startAt(at, from) {
      const shift = at + BEATS * this.period - from.t;
      for (const b of this.beats) b.t += shift;
      for (const x of this.extra) x.t += shift;
      this.first = from;
      this.clicks = [];
      for (let k = 0; k < BEATS; k++) this.clicks.push({ t: at + k * this.period, accent: k === 0, count: k + 1 });
      for (const b of this.beats) if (b.i >= from.i && b.audible) this.clicks.push({ t: b.t, accent: b.accent });
      this.next = 0;
      this.pending = false;
    }

    schedule(now) {
      while (this.next < this.clicks.length && this.clicks[this.next].t < now + LOOKAHEAD) {
        const c = this.clicks[this.next++];
        if (c.t >= now) c.stop = Audio.click(c.t, c.accent);
      }
    }

    // count-in beat being heard (1–4), or 0
    get count() {
      let n = 0;
      if (this.state === 'countin' && this.clicks) for (const c of this.clicks) if (c.count && c.t <= this.heard) n = c.count;
      return n;
    }

    update(dt) {
      for (const f of this.fx) f.age += dt;
      this.fx = this.fx.filter((f) => f.age < f.life);
      if (this.state !== 'countin' && this.state !== 'playing') return;
      if (this.pending) {
        if (!Audio.running) return;
        this.startAt(Audio.now + LEAD, this.beats[0]);
      }
      this.schedule(Audio.now);
      this.heard = Audio.heardTime(performance.now());
      const half = this.period / 2;
      if (this.state === 'countin' && this.heard >= this.first.t - half) this.state = 'playing';
      if (this.state !== 'playing') return;
      // a beat nobody tapped within half a beat is missed
      for (const b of this.beats) {
        if (b.t + half > this.heard) break;
        if (!b.grade) this.judge(b, null);
      }
      const lastBeat = this.beats[this.beats.length - 1];
      if (this.heard > lastBeat.t + half + 0.2) this.end();
    }

    // ms: event.timeStamp of the tap. Returns the grade, 'extra' or null.
    tap(ms) {
      if (this.state !== 'playing') return null;
      const t = Audio.heardTime(ms) - this.latency / 1000;
      let b = null;
      for (const x of this.beats) if (!b || Math.abs(x.t - t) < Math.abs(b.t - t)) b = x;
      const off = (t - b.t) * 1000;
      if (b.grade || Math.abs(off) > this.period * 500) {
        // a second tap for one beat, or nowhere near one
        this.extra.push({ t, age: 0 });
        this.combo = 0;
        this.fx.push({ text: 'extra', age: 0, life: 0.8 });
        return 'extra';
      }
      return this.judge(b, off);
    }

    judge(b, off) {
      const a = Math.abs(off);
      b.off = off;
      b.grade = off == null ? 'miss' : a <= PERFECT ? 'perfect' : a <= GOOD ? 'good' : 'off';
      if (b.grade === 'perfect' || b.grade === 'good') {
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        const mult = 1 + Math.min(3, Math.floor(this.combo / 8));
        this.score += (b.grade === 'perfect' ? 100 : 50) * mult;
      } else {
        this.combo = 0;
      }
      const word = b.grade === 'off' ? (off < 0 ? 'early' : 'late') : b.grade;
      this.fx.push({ text: word, grade: b.grade, off, age: 0, life: 0.9 });
      this.emit('onBeat', b);
      return b.grade;
    }

    // offsets of the taps so far: count, mean (signed) and spread (standard deviation), in ms
    stats() {
      const offs = this.beats.filter((b) => b.off != null).map((b) => b.off);
      const n = offs.length;
      if (!n) return { n, mean: 0, spread: 0, meanAbs: 0 };
      const mean = offs.reduce((a, x) => a + x, 0) / n;
      const spread = Math.sqrt(offs.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
      const meanAbs = offs.reduce((a, x) => a + Math.abs(x), 0) / n;
      return { n, mean, spread, meanAbs, offs };
    }

    pause() {
      if (this.state !== 'playing' && this.state !== 'countin') return false;
      this.resumeAt = this.state;
      this.state = 'paused';
      if (this.clicks) for (const c of this.clicks) if (c.stop && c.t > Audio.now) c.stop();
      return true;
    }

    // a rhythm can't carry on mid-air: count in again, then pick up at the first beat not yet judged
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'countin';
      if (this.pending) return;
      const from = this.beats.find((b) => !b.grade);
      if (!from) return this.end();
      this.startAt(Audio.now + LEAD, from);
    }

    end() {
      if (this.state === 'over') return;
      this.state = 'over';
      const counts = { perfect: 0, good: 0, off: 0, miss: 0 };
      for (const b of this.beats) counts[b.grade || 'miss']++;
      const st = this.stats();
      if (this.level.calibrate) {
        const offs = (st.offs || []).filter((x) => Math.abs(x) < this.period * 500);
        const ok = offs.length >= CAL_MIN_TAPS;
        this.emit('onEnd', { rhythm: true, calibrate: true, ok, latency: ok ? Math.round(median(offs)) : null, taps: offs.length });
        return;
      }
      const accuracy = (counts.perfect + counts.good / 2) / (this.beats.length + this.extra.length);
      const [one, two, three] = this.level.stars;
      const win = accuracy >= one;
      const stars = !win ? 0 : accuracy >= three ? 3 : accuracy >= two ? 2 : 1;
      this.emit('onEnd', {
        rhythm: true,
        win,
        reason: win ? 'goal' : 'timing',
        stars,
        score: this.score,
        accuracy,
        maxCombo: this.maxCombo,
        counts,
        extra: this.extra.length,
        mean: st.mean,
        spread: st.spread,
        taps: st.n,
      });
    }
  }

  Metronome.BEATS = BEATS;
  Metronome.WINDOWS = { perfect: PERFECT, good: GOOD };
  Metronome.CALIBRATE = CALIBRATE;
  Dots.Metronome = Metronome;
})();
