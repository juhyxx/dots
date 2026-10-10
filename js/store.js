// Settings, level progress and per-note stats, kept in localStorage.
window.Dots = window.Dots || {};

Dots.Store = (() => {
  const KEY = 'dots.v1';
  const INSTRUMENTS = ['piano', 'guitar', 'bass'];

  function defaults() {
    const per = () => Object.fromEntries(INSTRUMENTS.map((k) => [k, {}]));
    return {
      settings: {
        naming: 'B',
        labels: 'some',
        strict: true,
        sound: true,
        midiSound: true,
        midiEnabled: false,
        unlockAll: false,
      },
      progress: per(),
      stats: per(),
    };
  }

  function load() {
    const d = defaults();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw) {
        Object.assign(d.settings, raw.settings);
        for (const k of INSTRUMENTS) {
          Object.assign(d.progress[k], raw.progress && raw.progress[k]);
          Object.assign(d.stats[k], raw.stats && raw.stats[k]);
        }
      }
    } catch (e) {
      // storage unavailable or corrupt: start fresh
    }
    return d;
  }

  function save(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {
      // ignore (private mode, quota)
    }
  }

  return { load, save, defaults };
})();
