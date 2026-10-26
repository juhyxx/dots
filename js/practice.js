// Practice mode: whatever you play is written on the staff right away.
// Notes played together (within CHORD_WINDOW) are stacked into one chord.
// The newest item sits on the right; older ones slide left and fade out.
window.Dots = window.Dots || {};

(() => {
  const CHORD_WINDOW = 0.15; // seconds

  Dots.Practice = class Practice {
    constructor() {
      this.practice = true;
      this.state = 'practice';
      this.items = [];
      this.fx = [];
      this.uid = 0;
      this.clock = 0;
    }

    add(note) {
      const cur = this.items[this.items.length - 1];
      if (cur && this.clock - cur.start <= CHORD_WINDOW) {
        if (!cur.notes.some((n) => n.midi === note.midi)) {
          cur.notes.push(note);
          cur.notes.sort((a, b) => a.midi - b.midi);
        }
        return;
      }
      for (const it of this.items) it.slot++;
      this.items.push({ uid: ++this.uid, notes: [note], start: this.clock, slot: 0, pos: -0.6, age: 0 });
      if (this.items.length > 40) this.items.shift();
    }

    update(dt) {
      this.clock += dt;
      const k = Math.min(1, dt * 14);
      for (const it of this.items) {
        it.age += dt;
        it.pos += (it.slot - it.pos) * k;
      }
    }

    pause() {
      return false;
    }

    resume() {}
  };
})();
