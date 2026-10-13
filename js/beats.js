// Canvas renderer for the metronome game: beats slide in to the measuring line in the middle, each tap
// leaves a tick where it landed (past beats drift on to the left), and a meter below the line shows how
// early or late the recent taps were.
window.Dots = window.Dots || {};

(() => {
  const UI_FONT = 'Nunito, system-ui, sans-serif';
  // the stage is light paper in both themes, so these match the staff's colours
  const C = {
    ink: '#22232b',
    line: '#5d5f70',
    faint: 'rgba(34, 35, 43, 0.38)',
    accent: '#f29d0b',
    glow: 'rgba(242, 157, 11, 0.25)',
    band: 'rgba(242, 157, 11, 0.10)',
    track: 'rgba(34, 35, 43, 0.07)',
  };
  const GRADE = { perfect: '#14a05a', good: '#e08a00', off: '#e23b4e', miss: '#e23b4e', extra: '#e23b4e' };
  const RANGE = 150; // ms from the meter's centre to its ends
  const TICKS = 24; // taps shown on the meter

  const signed = (ms) => (ms > 0 ? '+' : ms < 0 ? '−' : '±') + Math.abs(Math.round(ms));

  class BeatView {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
    }

    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = r.width;
      this.h = r.height;
      this.canvas.width = Math.round(r.width * this.dpr);
      this.canvas.height = Math.round(r.height * this.dpr);
      const { w, h } = this;
      this.S = Math.max(8, Math.min(20, h / 15, w / 32));
      this.hitX = w / 2;
      this.laneY = h * 0.4;
      this.meterY = h - this.S * 2.4;
      if (this.lastGame) this.draw(this.lastGame);
    }

    text(s, x, y, size, color, weight = 800, align = 'center') {
      const ctx = this.ctx;
      ctx.font = `${weight} ${size}px ${UI_FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    }

    line(x1, y1, x2, y2, color, width) {
      const ctx = this.ctx;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    dot(x, y, r, color) {
      const ctx = this.ctx;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // x of audio time t: about four beats to each half of the stage, whatever the tempo
    xAt(g, t) {
      const perBeat = Math.max(this.S * 5, Math.min(this.S * 14, this.hitX / 3.8));
      return this.hitX + ((t - g.heard) * perBeat) / g.period;
    }

    // fades things out as they drift towards the left edge
    fade(x) {
      return Math.max(0, Math.min(1, x / (this.hitX * 0.7)));
    }

    drawLane(g) {
      const { S, w, hitX, laneY, ctx } = this;
      this.line(0, laneY, w, laneY, C.line, Math.max(1, S * 0.1));
      ctx.fillStyle = C.band;
      ctx.fillRect(hitX - S * 0.9, laneY - S * 3.2, S * 1.8, S * 6.4);
      this.line(hitX, laneY - S * 3.2, hitX, laneY + S * 3.2, C.accent, 2.5);
      this.text(`♩ = ${g.level.bpm}`, S * 1.2, S * 1.6, S * 1.05, C.ink, 800, 'left');
    }

    drawBeats(g) {
      const { S, laneY, ctx } = this;
      const live = g.state === 'playing' || g.state === 'countin';
      const target = live ? g.beats.find((b) => !b.grade) : null;
      for (const b of g.beats) {
        const x = this.xAt(g, b.t);
        if (x > this.w + S * 2) break;
        if (x < -S * 2) continue;
        // silent beats stay hidden until judged (that's the point), and calibration only listens
        const hidden = !b.grade && (!b.audible || g.level.calibrate);
        if (hidden) continue;
        ctx.globalAlpha = this.fade(x);
        if (b.accent) this.line(x, laneY - S * 1.7, x, laneY + S * 1.7, C.line, Math.max(1, S * 0.08));
        if (b === target) this.dot(x, laneY, S * 1.3, C.glow);
        const color = b.grade ? GRADE[b.grade] : C.ink;
        this.dot(x, laneY, b.accent ? S * 0.72 : S * 0.52, color);
        if (b.off != null) {
          const tx = this.xAt(g, b.t + b.off / 1000);
          this.line(tx, laneY - S * 1.25, tx, laneY + S * 1.25, color, Math.max(2, S * 0.18));
        }
      }
      for (const e of g.extra) {
        const x = this.xAt(g, e.t);
        ctx.globalAlpha = this.fade(x);
        this.line(x, laneY - S * 1.25, x, laneY + S * 1.25, GRADE.extra, Math.max(2, S * 0.18));
      }
      ctx.globalAlpha = 1;
    }

    drawFx(g) {
      const { S, hitX, laneY, ctx } = this;
      const t = Dots.I18n.t;
      for (const f of g.fx) {
        ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
        const y = laneY - S * 2.6 - f.age * S * 1.4;
        const color = GRADE[f.grade || 'extra'];
        this.text(t('met.' + f.text), hitX + S * 2.2, y, S * 1.1, color, 800, 'left');
        if (f.off != null) this.text(`${signed(f.off)} ms`, hitX + S * 2.2, y + S * 1.1, S * 0.75, color, 700, 'left');
      }
      ctx.globalAlpha = 1;
    }

    // what's going on right now, written above the lane
    drawStatus(g) {
      const { S, laneY } = this;
      const t = Dots.I18n.t;
      const cx = this.hitX;
      const n = g.count;
      if (n) {
        const into = (g.heard - g.clicks[n - 1].t) / g.period; // 0..1 through this count
        this.ctx.globalAlpha = Math.max(0.2, 1 - into * 0.8);
        this.text(String(n), cx, laneY - S * 4.6, S * (3.6 - into), C.accent, 700);
        this.ctx.globalAlpha = 1;
        return;
      }
      if (g.level.calibrate && g.state === 'playing') {
        this.text(t('met.listen'), cx, laneY - S * 4.6, S * 1.1, C.faint);
        return;
      }
      if (g.state !== 'playing' || !g.level.gaps) return;
      const now = g.beats.filter((b) => b.t <= g.heard + g.period / 2).pop();
      if (now && !now.audible) this.text(t('met.silent'), cx, laneY - S * 4.6, S * 1.1, C.faint);
    }

    drawMeter(g) {
      const { S, w, meterY, ctx } = this;
      const t = Dots.I18n.t;
      const mw = Math.min(w - S * 12, S * 26);
      const cx = w / 2;
      const x = (ms) => cx + (Math.max(-RANGE, Math.min(RANGE, ms)) / RANGE) * (mw / 2);
      const th = S * 0.9;
      const band = (ms, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x(-ms), meterY - th / 2, x(ms) - x(-ms), th);
      };
      band(RANGE, C.track);
      band(Dots.Metronome.WINDOWS.good, 'rgba(242, 157, 11, 0.22)');
      band(Dots.Metronome.WINDOWS.perfect, 'rgba(20, 160, 90, 0.28)');
      this.line(cx, meterY - th, cx, meterY + th, C.ink, 1.5);
      this.text(t('met.early'), x(-RANGE) - S * 0.6, meterY, S * 0.8, C.faint, 800, 'right');
      this.text(t('met.late'), x(RANGE) + S * 0.6, meterY, S * 0.8, C.faint, 800, 'left');

      const taps = g.beats.filter((b) => b.off != null).slice(-TICKS);
      taps.forEach((b, i) => {
        ctx.globalAlpha = 0.25 + (0.75 * (i + 1)) / taps.length;
        this.line(x(b.off), meterY - th * 0.95, x(b.off), meterY + th * 0.95, GRADE[b.grade], Math.max(2, S * 0.16));
      });
      ctx.globalAlpha = 1;
      const st = g.stats();
      if (st.n >= 3) {
        const mx = x(st.mean);
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(mx, meterY + th * 0.7);
        ctx.lineTo(mx - S * 0.45, meterY + th * 1.45);
        ctx.lineTo(mx + S * 0.45, meterY + th * 1.45);
        ctx.fill();
        this.text(t('met.avg', { ms: signed(st.mean) }), cx, meterY - th * 1.6, S * 0.8, C.ink, 700);
      }
    }

    draw(g) {
      const { ctx, w, h } = this;
      this.lastGame = g;
      if (!w || !h) return;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      this.drawLane(g);
      if (g.clicks) this.drawBeats(g);
      this.drawStatus(g);
      this.drawFx(g);
      this.drawMeter(g);
    }
  }

  BeatView.signed = signed;
  Dots.BeatView = BeatView;
})();
