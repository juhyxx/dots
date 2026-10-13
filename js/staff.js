// Canvas renderer for the staff, clefs, scrolling notes and effects.
window.Dots = window.Dots || {};

(() => {
  // Bravura (SMuFL) is bundled; glyph origins sit on the staff lines by spec. The system
  // fonts below are only a fallback, positioned by fitting their outlines.
  const SMUFL = { gClef: '\uE050', fClef: '\uE062', sharp: '\uE262', ottavaAlta: '\uE511', ottavaBassa: '\uE51C' }; // E51C = 8vb
  const MUSIC_FONT = '"Apple Symbols", "Segoe UI Symbol", "Noto Music", "Noto Sans Symbols 2", serif';
  const UI_FONT = 'Nunito, system-ui, sans-serif';
  const TREBLE = '\u{1D11E}';
  const BASS = '\u{1D122}';
  const C = {
    ink: '#22232b',
    line: '#5d5f70',
    good: '#14a05a',
    bad: '#e23b4e',
    accent: '#f29d0b',
    glow: 'rgba(242, 157, 11, 0.25)',
    band: 'rgba(242, 157, 11, 0.10)',
    pill: '#ffffff',
  };

  // distance (in staff spaces) from a note head to its name label: clear of sharps and 8va/8vb
  const labelSpaces = (n) => (n.ottava ? 3.9 : n.sharp ? 2.2 : 1.7);

  class Staff {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.clefs = 'grand';
      this.naming = 'B';
      this.smufl = false; // set once Bravura has loaded
      this.ext = { top: 4.5, bottom: 4.5 };
    }

    // notes: the level's pool, used to make room above/below the grand staff
    configure({ clefs, naming, notes = [] }) {
      this.clefs = clefs;
      this.naming = naming;
      this.ext = this.extentFor(notes);
      this.lastGame = null; // its notes may sit on a clef the new layout doesn't have
      this.layout();
    }

    // Staff spaces needed above the treble staff and below the bass staff (note + label).
    extentFor(notes) {
      let top = 4.5;
      let bottom = 4.5;
      for (const n of notes) {
        const label = labelSpaces(n) + 0.75; // label offset + half a pill
        if (n.clef === 'treble') top = Math.max(top, (n.step - 38) / 2 + label);
        if (n.clef === 'bass') bottom = Math.max(bottom, (18 - n.step) / 2 + label);
      }
      return { top, bottom };
    }

    resize() {
      const r = this.canvas.parentElement.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = r.width;
      this.h = r.height;
      this.canvas.width = Math.round(r.width * this.dpr);
      this.canvas.height = Math.round(r.height * this.dpr);
      this.layout();
      if (this.lastGame) this.draw(this.lastGame);
    }

    layout() {
      const { w, h } = this;
      if (!w) return;
      if (this.clefs === 'grand') {
        // pad · treble 4 · gap 6 · bass 4 · pad (in staff spaces)
        const { top: et, bottom: eb } = this.ext;
        const rows = et + 14 + eb;
        const S = Math.max(7, Math.min(18, h / rows, w / 34));
        const top = (h - rows * S) / 2 + et * S;
        this.S = S;
        this.staves = {
          treble: { clef: 'treble', top, bottom: 30 },
          bass: { clef: 'bass', top: top + 10 * S, bottom: 18 },
        };
        this.x0 = 14 + S * 1.2;
      } else {
        // pad 4.5 · staff 4 · pad 6
        const S = Math.max(7, Math.min(22, h / 14.5, w / 30));
        const top = (h - 14.5 * S) / 2 + 4.5 * S;
        this.S = S;
        this.staves = { [this.clefs]: { clef: this.clefs, top, bottom: this.clefs === 'treble' ? 30 : 18 } };
        this.x0 = 14;
      }
      const list = Object.values(this.staves);
      const grand = this.clefs === 'grand';
      this.sysTop = list[0].top - (grand ? this.ext.top - 1.5 : 3) * this.S;
      this.sysBottom = list[list.length - 1].top + (grand ? 4 + this.ext.bottom - 1.5 : 7) * this.S;
      this.clefX = this.x0 + 0.5 * this.S;
      this.hitX = this.x0 + 6 * this.S;
      this.spawnX = w + 1.5 * this.S;
    }

    y(staff, step) {
      return staff.top + 4 * this.S - ((step - staff.bottom) * this.S) / 2;
    }

    noteX(n) {
      return this.spawnX + (this.hitX - this.spawnX) * n.p;
    }

    staffFor(n) {
      return this.staves[n.clef];
    }

    line(x1, y1, x2, y2) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draws a font glyph scaled so its ink box spans [top, bottom]. Returns its width.
    glyph(ch, left, top, bottom, color) {
      const ctx = this.ctx;
      ctx.font = `100px ${MUSIC_FONT}`;
      const m = ctx.measureText(ch);
      const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      if (!gh) return 0;
      const k = (bottom - top) / gh;
      ctx.font = `${100 * k}px ${MUSIC_FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ch, left + m.actualBoundingBoxLeft * k, top + m.actualBoundingBoxAscent * k);
      return (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) * k;
    }

    // SMuFL glyph: em = 4 staff spaces, baseline = the staff position the glyph belongs to
    smuflGlyph(ch, x, y, color) {
      const ctx = this.ctx;
      ctx.font = `${4 * this.S}px Bravura`;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ch, x, y);
    }

    sharp(left, y, color) {
      const S = this.S;
      if (this.smufl) this.smuflGlyph(SMUFL.sharp, left, y, color);
      else this.glyph('\u266F', left, y - S * 1.35, y + S * 1.35, color);
    }

    // 8va above / 8vb below a note at (x, y), with a short dashed line and hook
    drawOttava(x, y, dir, color) {
      const { ctx, S } = this;
      const ty = dir > 0 ? y - S * 2.2 : y + S * 2.2;
      const left = x - S * 0.9;
      if (this.smufl) ctx.font = `${3 * S}px Bravura`;
      else ctx.font = `italic 700 ${S * 1.1}px Georgia, serif`;
      const ch = this.smufl ? (dir > 0 ? SMUFL.ottavaAlta : SMUFL.ottavaBassa) : dir > 0 ? '8va' : '8vb';
      const m = ctx.measureText(ch);
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ch, left, ty + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
      const x1 = left + m.width + S * 0.2;
      const x2 = Math.max(x1 + S * 0.4, x + S * 1.5);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, S * 0.09);
      ctx.setLineDash([S * 0.3, S * 0.25]);
      this.line(x1, ty, x2, ty);
      ctx.setLineDash([]);
      this.line(x2, ty, x2, ty + (dir > 0 ? S * 0.7 : -S * 0.7));
    }

    // label distance from a single note head
    labelOffset(n) {
      return this.S * labelSpaces(n);
    }

    pill(text, cx, cy, bg, fg, size) {
      const ctx = this.ctx;
      ctx.font = `800 ${size}px ${UI_FONT}`;
      const tw = ctx.measureText(text).width;
      const ph = size * 1.35;
      const pw = Math.max(ph, tw + size * 0.9);
      ctx.fillStyle = bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
      else ctx.rect(cx - pw / 2, cy - ph / 2, pw, ph);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy + size * 0.05);
    }

    drawBrace(x, top, bottom) {
      const ctx = this.ctx;
      const h = bottom - top;
      const m = top + h / 2;
      const w = this.S * 0.9;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.moveTo(x + w, top);
      ctx.bezierCurveTo(x - w * 0.2, top + h * 0.1, x + w * 0.9, m - h * 0.12, x, m);
      ctx.bezierCurveTo(x + w * 0.9, m + h * 0.12, x - w * 0.2, bottom - h * 0.1, x + w, bottom);
      ctx.bezierCurveTo(x + w * 0.35, bottom - h * 0.1, x + w * 1.45, m + h * 0.1, x, m);
      ctx.bezierCurveTo(x + w * 1.45, m - h * 0.1, x + w * 0.35, top + h * 0.1, x + w, top);
      ctx.fill();
    }

    drawStaves() {
      const { ctx, S, w } = this;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = Math.max(1, S * 0.08);
      for (const st of Object.values(this.staves)) {
        for (let i = 0; i < 5; i++) this.line(this.x0, st.top + i * S, w, st.top + i * S);
        if (this.smufl) this.smuflGlyph(st.clef === 'treble' ? SMUFL.gClef : SMUFL.fClef, this.clefX, st.top + (st.clef === 'treble' ? 3 : 1) * S, C.ink);
        else if (st.clef === 'treble') this.glyph(TREBLE, this.clefX, st.top - 1.45 * S, st.top + 5.65 * S, C.ink);
        else this.glyph(BASS, this.clefX, st.top - 0.05 * S, st.top + 3.5 * S, C.ink);
      }
      if (this.clefs === 'grand') {
        const { treble, bass } = this.staves;
        ctx.lineWidth = Math.max(1.5, S * 0.12);
        this.line(this.x0, treble.top, this.x0, bass.top + 4 * S);
        this.drawBrace(this.x0 - S * 1.15, treble.top, bass.top + 4 * S);
      }
    }

    drawHitLine() {
      const { ctx, S, hitX } = this;
      ctx.fillStyle = C.band;
      ctx.fillRect(hitX - S * 0.9, this.sysTop, S * 1.8, this.sysBottom - this.sysTop);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2.5;
      this.line(hitX, this.sysTop, hitX, this.sysBottom);
    }

    stemUp(staff, step) {
      return step < staff.bottom + 4;
    }

    drawNote(x, staff, step, color, scale = 1, ottava = 0) {
      const { ctx, S } = this;
      const y = this.y(staff, step);
      const b = staff.bottom;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, S * 0.1);
      const lw = S * 1.05;
      for (let s = b - 2; s >= step; s -= 2) this.line(x - lw, this.y(staff, s), x + lw, this.y(staff, s));
      for (let s = b + 10; s <= step; s += 2) this.line(x - lw, this.y(staff, s), x + lw, this.y(staff, s));

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, S * 0.64 * scale, S * 0.46 * scale, -0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = Math.max(1.2, S * 0.1);
      if (this.stemUp(staff, step)) {
        const sx = x + S * 0.6 * scale - ctx.lineWidth / 2;
        this.line(sx, y - S * 0.1, sx, y - S * 3.5);
      } else {
        const sx = x - S * 0.6 * scale + ctx.lineWidth / 2;
        this.line(sx, y + S * 0.1, sx, y + S * 3.5);
      }
      if (ottava) this.drawOttava(x, y, ottava, color);
      return y;
    }

    drawGameNote(n, isTarget) {
      const { ctx, S } = this;
      const st = this.staffFor(n);
      if (!st) return;
      let x = this.noteX(n);
      const y = this.y(st, n.step);
      let color = C.ink;
      let alpha = 1;
      let scale = 1;
      if (n.state === 'hit') {
        color = n.octave ? C.accent : C.good;
        alpha = Math.max(0, 1 - n.age / 0.6);
        scale = 1 + n.age * 0.8;
      } else if (n.state === 'miss') {
        color = C.bad;
        alpha = Math.max(0, 1 - n.age / 0.9);
      }
      if (n.shake > 0) {
        x += Math.sin(n.shake * 70) * S * 0.3 * (n.shake / 0.4);
        color = C.bad;
      }
      ctx.globalAlpha = alpha;
      if (isTarget) {
        ctx.fillStyle = C.glow;
        ctx.beginPath();
        ctx.arc(x, y, S * 1.25, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawNote(x, st, n.step, color, scale, n.ottava);
      if (n.state === 'miss') {
        const ly = this.stemUp(st, n.step) ? y - S * 4.4 : y - this.labelOffset(n);
        this.pill(Dots.Music.letter(n.idx, this.naming), x, ly, C.bad, '#fff', S * 1.05);
      }
      ctx.globalAlpha = 1;
    }

    drawPreview(pool) {
      const { S, w } = this;
      const notes = [...pool].sort((a, b) => a.midi - b.midi || (a.clef === 'bass' ? -1 : 1));
      const left = this.hitX + S * 2;
      const right = w - S * 2;
      const gap = notes.length > 1 ? (right - left) / (notes.length - 1) : 0;
      const labels = notes.length === 1 || gap >= S * 1.9;
      notes.forEach((n, i) => {
        const st = this.staffFor(n);
        if (!st) return;
        const x = notes.length > 1 ? left + i * gap : (left + right) / 2;
        const y = this.drawNote(x, st, n.step, C.ink, 1, n.ottava);
        if (labels) {
          const ly = this.stemUp(st, n.step) ? y + this.labelOffset(n) : y - this.labelOffset(n);
          this.pill(Dots.Music.letter(n.idx, this.naming), x, ly, C.accent, '#1b1407', S * 0.95);
        }
      });
    }

    drawFx(game) {
      const { ctx, S } = this;
      const colors = { good: C.good, bad: C.bad, accent: C.accent };
      for (const f of game.fx) {
        ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
        ctx.fillStyle = colors[f.color] || C.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (f.note) {
          const st = this.staffFor(f.note);
          const ny = this.y(st, f.note.step);
          const y = Math.min(ny - S * 1.8, st.top - S * 1.2) - f.age * S * 1.6;
          ctx.font = `800 ${S * 1.1}px ${UI_FONT}`;
          ctx.fillText(f.text, this.noteX(f.note), y);
        } else {
          ctx.font = `700 ${S * 2}px Fredoka, ${UI_FONT}`;
          ctx.fillText(f.text, (this.hitX + this.w) / 2, this.sysTop + S * 0.5 - f.age * S);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Layout of a chord (or single note) on one staff: shared stem, seconds pushed to the
    // other side of the stem, sharps stacked in columns. Extents are px left/right of x.
    chordLayout(st, notes) {
      const S = this.S;
      const steps = [...notes].sort((a, b) => a.step - b.step || a.midi - b.midi);
      const avg = steps.reduce((a, n) => a + n.step, 0) / steps.length;
      const up = avg < st.bottom + 4;
      const side = up ? S * 1.18 : -S * 1.18;
      const shifted = new Set();
      let prev = null;
      for (const n of up ? steps : [...steps].reverse()) {
        if (prev && Math.abs(n.step - prev.step) === 1 && !shifted.has(prev)) shifted.add(n);
        prev = n;
      }
      // sharps top to bottom; one too close to the sharp above moves a column left
      const cols = [];
      const sharps = [];
      for (const n of [...steps].reverse()) {
        if (!n.sharp) continue;
        let c = 0;
        while (cols[c] !== undefined && cols[c] - n.step < 6) c++;
        cols[c] = n.step;
        sharps.push({ n, c });
      }
      const pushLeft = shifted.size && !up ? S * 1.18 : 0;
      const pushRight = shifted.size && up ? S * 1.18 : 0;
      let left = S * 1.1 + pushLeft + (cols.length ? S * 1.0 + cols.length * S * 1.1 : 0);
      let right = S * 1.1 + pushRight;
      if (steps.some((n) => n.ottava)) {
        left = Math.max(left, S * 1.1); // 8va / 8vb sign and its dashed line
        right = Math.max(right, S * 2.4);
      }
      return { steps, up, side, shifted, sharps, pushLeft, pushRight, left, right };
    }

    drawChord(x, st, L, color, scale = 1) {
      const { ctx, S } = this;
      const lo = L.steps[0].step;
      const hi = L.steps[L.steps.length - 1].step;
      const b = st.bottom;
      const lx1 = x - S * 1.05 - L.pushLeft;
      const lx2 = x + S * 1.05 + L.pushRight;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, S * 0.1);
      for (let s = b - 2; s >= lo; s -= 2) this.line(lx1, this.y(st, s), lx2, this.y(st, s));
      for (let s = b + 10; s <= hi; s += 2) this.line(lx1, this.y(st, s), lx2, this.y(st, s));

      ctx.fillStyle = color;
      for (const n of L.steps) {
        ctx.beginPath();
        ctx.ellipse(x + (L.shifted.has(n) ? L.side : 0), this.y(st, n.step), S * 0.64 * scale, S * 0.46 * scale, -0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.lineWidth = Math.max(1.2, S * 0.1);
      if (L.up) {
        const sx = x + S * 0.6 * scale - ctx.lineWidth / 2;
        this.line(sx, this.y(st, lo) - S * 0.1, sx, this.y(st, hi) - S * 3.5);
      } else {
        const sx = x - S * 0.6 * scale + ctx.lineWidth / 2;
        this.line(sx, this.y(st, hi) + S * 0.1, sx, this.y(st, lo) + S * 3.5);
      }

      const ax0 = x - S * 2.15 - L.pushLeft;
      for (const { n, c } of L.sharps) this.sharp(ax0 - c * S * 1.1, this.y(st, n.step), color);

      const ott = L.steps.filter((n) => n.ottava);
      if (ott.length) {
        const dir = ott[0].ottava;
        const edge = dir > 0 ? ott[ott.length - 1] : ott[0];
        this.drawOttava(x, this.y(st, edge.step), dir, color);
      }
    }

    noteName(n) {
      return Dots.Music.letter(n.idx, this.naming) + (n.sharp ? '♯' : '') + n.oct;
    }

    // Per-item layout: notes grouped by staff, label text, and how wide the item is.
    practiceItem(it) {
      const { ctx, S } = this;
      const groups = new Map();
      for (const n of it.notes) {
        const st = this.staffFor(n);
        if (!st) continue;
        if (!groups.has(st)) groups.set(st, []);
        groups.get(st).push(n);
      }
      const parts = [...groups].map(([st, notes]) => ({ st, L: this.chordLayout(st, notes) }));
      const label = it.notes.length === 1
        ? this.noteName(it.notes[0])
        : Dots.Music.chordName(it.notes.map((n) => n.midi), this.naming) ||
          it.notes.map((n) => this.noteName(n).replace(/\d+$/, '')).join(' ');
      ctx.font = `800 ${S * 0.95}px ${UI_FONT}`;
      const half = (ctx.measureText(label).width + S * 0.9) / 2;
      return {
        parts,
        label,
        left: Math.max(half, ...parts.map((p) => p.L.left)),
        right: Math.max(half, ...parts.map((p) => p.L.right)),
      };
    }

    // practice: the grand staff grows/shrinks smoothly to fit the notes on screen
    fitPractice(p) {
      const visible = p.items.filter((it) => it.x == null || it.x > this.x0).flatMap((it) => it.notes);
      const want = this.extentFor(visible);
      const dt = want.top - this.ext.top;
      const db = want.bottom - this.ext.bottom;
      if (Math.abs(dt) < 0.01 && Math.abs(db) < 0.01) return;
      this.ext = { top: this.ext.top + dt * 0.15, bottom: this.ext.bottom + db * 0.15 };
      this.layout();
    }

    drawPractice(p) {
      const { ctx, S, w, h } = this;
      const left = this.x0 + 4.5 * S;
      const right = w - 2.8 * S;
      if (!p.items.length) {
        ctx.fillStyle = 'rgba(34, 35, 43, 0.38)';
        ctx.font = `700 ${S * 1.2}px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Dots.I18n.t('practice.empty'), (left + right) / 2, this.sysTop - S * 0.2);
        return;
      }

      // place items right to left by their real width; x eases toward its target
      let tx = right;
      let prevLeft = 0;
      const laid = [];
      for (let i = p.items.length - 1; i >= 0; i--) {
        const it = p.items[i];
        const lay = this.practiceItem(it);
        if (laid.length) tx -= prevLeft + lay.right + S * 0.9;
        else tx = Math.min(right, w - lay.right - Math.max(S * 1.6, 24)); // newest: whole width on screen, clear of the rounded corner
        prevLeft = lay.left;
        it.x = it.x == null ? tx + S * 2.5 : it.x + (tx - it.x) * 0.25;
        laid.push({ it, lay });
        if (tx < left - S * 8) break;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(left - S * 2, 0, w, h);
      ctx.clip();
      for (const { it, lay } of laid) {
        const x = it.x;
        const newest = it.slot === 0;
        ctx.globalAlpha = Math.max(0, Math.min(1, (x - left + S * 2) / (S * 4)));
        if (newest) {
          ctx.fillStyle = C.glow;
          for (const { st, L } of lay.parts) {
            const yTop = this.y(st, L.steps[L.steps.length - 1].step) - S * 1.1;
            const yBot = this.y(st, L.steps[0].step) + S * 1.1;
            const x1 = x - S * 1.2 - L.pushLeft;
            const x2 = x + S * 1.2 + L.pushRight;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x1, yTop, x2 - x1, yBot - yTop, S * 1.1);
            else ctx.rect(x1, yTop, x2 - x1, yBot - yTop);
            ctx.fill();
          }
        }
        const scale = newest ? 1 + Math.max(0, 0.3 - it.age) : 1;
        for (const { st, L } of lay.parts) this.drawChord(x, st, L, C.ink, scale);

        const bg = newest ? C.accent : '#ebe5d6';
        let ly;
        if (it.notes.length === 1) {
          const n = it.notes[0];
          const st = this.staffFor(n);
          const y = this.y(st, n.step);
          ly = this.stemUp(st, n.step) ? y + this.labelOffset(n) : y - this.labelOffset(n);
        } else {
          ly = this.sysTop - S * 0.4;
        }
        this.pill(lay.label, x, Math.max(S * 0.9, Math.min(h - S * 0.9, ly)), bg, '#1b1407', S * 0.95);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    drawCountdown(t) {
      const { ctx, S } = this;
      const n = Math.ceil(t);
      const frac = t - Math.floor(t);
      ctx.globalAlpha = 0.25 + 0.75 * frac;
      ctx.fillStyle = C.accent;
      ctx.font = `700 ${S * (4 + 2 * frac)}px Fredoka, ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), (this.hitX + this.w) / 2, (this.sysTop + this.sysBottom) / 2);
      ctx.globalAlpha = 1;
    }

    draw(game) {
      const { ctx, w, h, S } = this;
      this.lastGame = game;
      if (!w || !h) return;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (game.practice && this.clefs === 'grand') this.fitPractice(game);
      this.drawStaves();
      if (game.practice) {
        this.drawPractice(game);
        return;
      }
      this.drawHitLine();
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.hitX - S * 1.4, 0, w, h);
      ctx.clip();
      if (game.state === 'intro') {
        this.drawPreview(game.level.pool);
      } else {
        const target = game.state === 'playing' ? game.target : null;
        for (const n of game.notes) this.drawGameNote(n, n === target);
      }
      ctx.restore();
      this.drawFx(game);
      if (game.state === 'countdown') this.drawCountdown(game.countdown);
    }
  }

  Dots.Staff = Staff;
})();
