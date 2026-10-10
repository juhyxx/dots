// Clickable on-screen instruments: piano keyboard and guitar/bass fretboard.
// Both report WRITTEN MIDI pitch through onPress(midi, element).
window.Dots = window.Dots || {};

(() => {
  const { Music } = Dots;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  class BaseInput {
    flashEl(e, cls, ms) {
      if (!e) return;
      clearTimeout(e['_t' + cls]);
      e.classList.remove(cls);
      void e.offsetWidth; // restart CSS animation
      e.classList.add(cls);
      e['_t' + cls] = setTimeout(() => e.classList.remove(cls), ms);
    }

    // result: 'hit' | 'octave' | 'wrong'
    mark(e, result) {
      this.flashEl(e, { hit: 'good', octave: 'near' }[result] || 'bad', 380);
    }

    hint(midi) {
      this.root.querySelectorAll(`[data-midi="${midi}"]`).forEach((e) => this.flashEl(e, 'hint', 1600));
    }

    press(midi) {
      this.root.querySelectorAll(`[data-midi="${midi}"]`).forEach((e) => this.flashEl(e, 'down', 180));
    }

    markMidi(midi, result) {
      this.root.querySelectorAll(`[data-midi="${midi}"]`).forEach((e) => this.mark(e, result));
    }

    listen(selector, onPress) {
      this.root.addEventListener('pointerdown', (e) => {
        const target = e.target.closest(selector);
        if (!target) return;
        e.preventDefault();
        this.flashEl(target, 'down', 180);
        onPress(Number(target.dataset.midi), target);
      });
    }
  }

  class PianoInput extends BaseInput {
    constructor(container, { low, high, labels, naming, onPress }) {
      super();
      this.root = el('div', 'piano');
      const whites = [];
      for (let m = low; m <= high; m++) if (Music.idxFromMidi(m) !== null) whites.push(m);
      const w = 100 / whites.length;

      whites.forEach((m, i) => {
        const k = el('div', 'key white');
        k.dataset.midi = m;
        k.style.left = `${i * w}%`;
        k.style.width = `${w}%`;
        const idx = Music.idxFromMidi(m);
        const oct = Math.floor(m / 12) - 1;
        k.dataset.name = Music.letter(idx, naming);
        let text = '';
        if (labels === 'all') text = Music.letter(idx, naming) + (idx === 0 ? oct : '');
        else if (labels === 'some' && idx === 0) text = 'C' + oct;
        if (text) k.appendChild(el('span', 'key-label' + (m === 60 ? ' middle' : ''), text));
        this.root.appendChild(k);
      });

      for (let m = low; m <= high; m++) {
        if (Music.idxFromMidi(m) !== null) continue;
        const wi = whites.indexOf(m - 1);
        if (wi < 0 || wi === whites.length - 1) continue;
        const bw = w * 0.6;
        const k = el('div', 'key black');
        k.dataset.midi = m;
        k.style.left = `${(wi + 1) * w - bw / 2}%`;
        k.style.width = `${bw}%`;
        this.root.appendChild(k);
      }

      this.listen('.key', onPress);
      container.replaceChildren(this.root);
    }
  }

  class NeckInput extends BaseInput {
    constructor(container, { strings, thick, wound, frets = 12, labels, naming, onPress }) {
      super();
      this.root = el('div', 'neck-wrap');
      const neck = el('div', 'neck');
      const openFr = 0.9;
      const total = openFr + frets;
      const cols = `${openFr}fr repeat(${frets}, 1fr)`;
      neck.style.setProperty('--cols', cols);
      neck.style.setProperty('--open', `${(openFr / total) * 100}%`);

      [3, 5, 7, 9, 12].forEach((f) => {
        if (f > frets) return;
        const x = ((openFr + f - 0.5) / total) * 100;
        (f === 12 ? [28, 72] : [50]).forEach((y) => {
          const d = el('div', 'inlay');
          d.style.left = `${x}%`;
          d.style.top = `${y}%`;
          neck.appendChild(d);
        });
      });

      strings.forEach((open, si) => {
        for (let f = 0; f <= frets; f++) {
          const m = open + f;
          const idx = Music.idxFromMidi(m);
          const c = el('div', 'cell' + (f === 0 ? ' open' : ''));
          c.dataset.midi = m;
          c.style.setProperty('--th', `${thick[si]}px`);
          if (wound[si]) c.classList.add('wound');
          const dot = el('span', 'dot');
          if (idx !== null) {
            c.dataset.name = dot.dataset.name = Music.letter(idx, naming);
            if (labels === 'all' || (labels === 'some' && f === 0)) {
              dot.textContent = c.dataset.name;
              c.classList.add('labeled');
            }
          }
          c.appendChild(dot);
          neck.appendChild(c);
        }
      });

      const nums = el('div', 'fret-nums');
      nums.style.setProperty('--cols', cols);
      for (let f = 0; f <= frets; f++) nums.appendChild(el('span', '', f === 0 ? '' : String(f)));

      this.root.append(neck, nums);
      this.listen('.cell', onPress);
      container.replaceChildren(this.root);
    }
  }

  Dots.PianoInput = PianoInput;
  Dots.NeckInput = NeckInput;
})();
