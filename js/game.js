// Game engine: spawns notes, moves them toward the hit line, judges answers.
// Positions are kept as progress p (0 = right edge, 1 = hit line) so resizing is free.
window.Dots = window.Dots || {};

Dots.Game = class Game {
  constructor(level, { check, name, hooks }) {
    this.level = level;
    this.check = check;
    this.name = name;
    this.hooks = hooks || {};
    this.state = 'intro'; // intro | countdown | playing | paused | over
    this.notes = [];
    this.fx = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.correct = 0;
    this.wrong = 0;
    this.missed = 0;
    this.lives = level.lives;
    this.timeLeft = level.time;
    this.speed = 1;
    this.since = 0;
    this.idle = 0;
    this.clock = 0;
    this.countdown = 0;
    this.prev = null;
    this.uid = 0;
    this.bad = {};
    this.reactions = [];
  }

  begin() {
    if (this.state !== 'intro') return;
    this.state = 'countdown';
    this.countdown = 3;
    this.emit('onTick', false);
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'countdown') return false;
    this.resumeTo = this.state;
    this.state = 'paused';
    return true;
  }

  resume() {
    if (this.state === 'paused') this.state = this.resumeTo;
  }

  emit(name, ...args) {
    if (this.hooks[name]) this.hooks[name](...args);
  }

  get target() {
    let t = null;
    for (const n of this.notes) if (n.state === 'live' && (!t || n.p > t.p)) t = n;
    return t;
  }

  pick() {
    const pool = this.level.pool;
    let total = 0;
    // avoid immediate repeats; notes you got wrong come back more often
    const weights = pool.map((n) => {
      const w = this.prev && pool.length > 1 && n.id === this.prev.id ? 0 : 1 + 1.5 * Math.min(3, this.bad[n.id] || 0);
      total += w;
      return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  spawn() {
    const base = this.pick();
    this.prev = base;
    this.notes.push({ ...base, uid: ++this.uid, p: 0, state: 'live', age: 0, shake: 0, born: this.clock, played: new Set() });
    this.since = 0;
    this.idle = 0;
  }

  update(dt) {
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < f.life);
    for (const n of this.notes) {
      if (n.state !== 'live') n.age += dt;
      if (n.shake > 0) n.shake = Math.max(0, n.shake - dt);
    }
    this.notes = this.notes.filter((n) => n.state === 'live' || n.age < 0.9);

    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (this.countdown <= 0) {
        this.state = 'playing';
        this.emit('onTick', true);
        this.spawn();
      } else if (after !== before) {
        this.emit('onTick', false);
      }
      return;
    }
    if (this.state !== 'playing') return;

    this.clock += dt;
    if (this.timeLeft != null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.end(false, 'time');
        return;
      }
    }

    const rate = (dt * this.speed) / this.level.travel;
    for (const n of this.notes) {
      if (n.state !== 'live') continue;
      n.p += rate;
      if (n.p >= 1) {
        n.p = 1;
        this.miss(n);
        if (this.state !== 'playing') return;
      }
    }

    this.since += rate;
    const live = this.notes.filter((n) => n.state === 'live').length;
    if (live === 0) {
      this.idle += dt;
      if (this.idle >= 0.2) this.spawn();
    } else if (this.since >= 1 / this.level.density) {
      this.spawn();
    }
  }

  // the notes of a target: just itself, or both notes of an interval
  parts(n) {
    return n.notes || [n];
  }

  pending(n) {
    return this.parts(n).filter((p) => !n.played.has(p));
  }

  // ans: { idx, midi|null, label, source }. Returns { result, note } or null; note is the note that was played.
  // An interval's notes can come in any order; it's hit once both are in.
  input(ans) {
    if (this.state !== 'playing') return null;
    const n = this.target;
    if (!n) return null;

    let part = null;
    let verdict = false;
    for (const p of this.pending(n)) {
      const v = this.check(p, ans);
      if (v && (!verdict || v === 'hit')) [part, verdict] = [p, v];
    }
    // playing a note of the interval again is neither right nor wrong
    if (!verdict && this.parts(n).some((p) => n.played.has(p) && this.check(p, ans) === 'hit')) return null;
    if (verdict) {
      n.played.add(part);
      if (verdict === 'octave') n.octave = true;
      this.emit('onResult', verdict, [part], ans);
      if (this.pending(n).length) return { result: verdict, note: part };
      // right letter in the wrong octave still counts, but for half points and no streak growth
      const octave = !!n.octave;
      n.state = 'hit';
      n.age = 0;
      this.correct++;
      if (!octave) this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const mult = 1 + Math.min(4, Math.floor(this.combo / 5));
      const pts = Math.round(((50 + 100 * (1 - n.p)) * mult) / (octave ? 2 : 1));
      this.score += pts;
      this.reactions.push(this.clock - n.born);
      const names = this.parts(n).map(this.name).join(' ');
      if (octave) this.fx.push({ note: n, text: names + ' · ' + Dots.I18n.t('fx.octave'), color: 'accent', age: 0, life: 1.3 });
      else this.fx.push({ note: n, text: names + ' +' + pts, color: 'good', age: 0, life: 0.9 });
      if (!octave && this.combo % 10 === 0) this.fx.push({ text: Dots.I18n.t('fx.streak', { n: this.combo }), color: 'accent', age: 0, life: 1.4 });
      this.speed = Math.min(this.level.maxSpeed, this.speed + this.level.ramp);
      if (this.correct >= this.level.goal) this.end(true, 'goal');
      return { result: verdict, note: part };
    }

    this.wrong++;
    this.combo = 0;
    n.shake = 0.4;
    this.bad[n.id] = (this.bad[n.id] || 0) + 1;
    this.fx.push({ note: n, text: Dots.I18n.t('fx.not', { note: ans.label }), color: 'bad', age: 0, life: 0.9 });
    this.emit('onResult', 'wrong', this.pending(n), ans);
    this.penalize();
    return { result: 'wrong', note: n };
  }

  miss(n) {
    n.state = 'miss';
    n.age = 0;
    this.missed++;
    this.combo = 0;
    this.bad[n.id] = (this.bad[n.id] || 0) + 1;
    this.emit('onResult', 'miss', this.pending(n), null);
    this.penalize();
  }

  penalize() {
    if (this.timeLeft != null) {
      this.timeLeft = Math.max(0, this.timeLeft - this.level.penalty);
      this.fx.push({ text: Dots.I18n.t('fx.penalty', { n: this.level.penalty }), color: 'bad', age: 0, life: 1 });
      if (this.timeLeft <= 0) this.end(false, 'time');
    } else {
      this.lives--;
      if (this.lives <= 0) this.end(false, 'lives');
    }
  }

  end(win, reason) {
    if (this.state === 'over') return;
    this.state = 'over';
    const attempts = this.correct + this.wrong + this.missed;
    const accuracy = attempts ? this.correct / attempts : 0;
    const stars = win ? (accuracy >= 0.95 ? 3 : accuracy >= 0.8 ? 2 : 1) : 0;
    let bonus = 0;
    if (win) {
      if (Number.isFinite(this.lives)) bonus += this.lives * 250;
      if (this.timeLeft != null) bonus += Math.round(this.timeLeft) * 20;
    }
    this.score += bonus;
    const avg = this.reactions.length ? this.reactions.reduce((a, b) => a + b, 0) / this.reactions.length : 0;
    const trouble = Object.entries(this.bad)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id]) => id);
    this.emit('onEnd', {
      win,
      reason,
      stars,
      bonus,
      score: this.score,
      accuracy,
      maxCombo: this.maxCombo,
      correct: this.correct,
      avgReaction: avg,
      trouble,
    });
  }
};
