// Microphone input: hears single notes played on a real instrument and reports each new note once.
// Pitch comes from YIN; a note counts once its pitch has held for a few frames. The same pitch counts
// again only after a new pluck (a jump in loudness) or a silence. Reports SOUNDING MIDI pitch.
window.Dots = window.Dots || {};

Dots.Mic = (() => {
  const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));

  const HOP_MS = 15; // how often a frame is analysed
  const SPAN = 0.022; // seconds of sound compared at each lag
  const THRESHOLD = 0.12; // YIN: how periodic a frame must be to be a note (lower is stricter)
  const OFF_PITCH = 0.4; // semitones away from the nearest note that still count as that note
  const STEADY = 4; // frames a pitch must hold before it counts (~60 ms)
  const MIN_GATE = 0.002; // quieter than this (RMS) is always silence
  const GATE = 2.5; // ...and so is anything within this factor of the room's noise
  const ATTACK = 1.6; // a jump in loudness this big is a new pluck
  const CALM_MS = 150; // after a note or an app sound, how long before a jump counts as a pluck
  const ECHO_MS = 150; // how long the app's own sounds ring in the room after they stop

  let status = supported ? 'off' : 'unsupported';
  let handler = null;
  const listeners = [];
  let wanted = false;
  let opening = null;
  let stream = null;
  let source = null;
  let analyser = null;
  let timer = 0;

  // range (sounding MIDI) and the buffers sized for it
  let low = 40;
  let high = 76;
  let step = 1;
  let span = 0;
  let minLag = 0;
  let maxLag = 0;
  let raw = null;
  let x = null;
  let cmnd = null;

  // what the last frames heard
  let level = 0;
  let noise = Infinity;
  let recent = [];
  let cand = null;
  let count = 0;
  let last = null; // the note already reported while it rings, or null
  let calmUntil = 0;

  function setStatus(s) {
    status = s;
    listeners.forEach((fn) => fn(status));
  }

  // Works at about 22–24 kHz whatever the device rate (guitar pitches sit far below that Nyquist),
  // and holds the longest period in range plus the span compared at each lag.
  function fit() {
    const rate = analyser.context.sampleRate;
    step = Math.max(1, Math.floor(rate / 22050));
    const work = rate / step;
    span = Math.round(work * SPAN);
    minLag = Math.max(2, Math.floor(work / Dots.Music.freq(high + 1)));
    maxLag = Math.ceil(work / Dots.Music.freq(low - 1));
    analyser.fftSize = Math.min(32768, 2 ** Math.ceil(Math.log2((span + maxLag + 2) * step)));
    raw = new Float32Array(analyser.fftSize);
    x = new Float32Array(Math.floor(raw.length / step));
    cmnd = new Float32Array(maxLag + 2);
  }

  // YIN (de Cheveigné & Kawahara): the first lag at which the newest sound matches itself well enough
  // is one period. Returns the frequency in Hz, or 0 if the frame isn't periodic enough to be a note.
  function detect(rate) {
    const start = x.length - span - maxLag;
    let total = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      let d = 0;
      for (let i = start; i < start + span; i++) {
        const v = x[i] - x[i + lag];
        d += v * v;
      }
      total += d;
      cmnd[lag] = total > 0 ? (d * lag) / total : 1;
    }
    for (let lag = minLag; lag < maxLag; lag++) {
      if (cmnd[lag] >= THRESHOLD) continue;
      while (lag + 1 < maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
      // a parabola through the dip and its neighbours puts the period between samples
      const a = cmnd[lag - 1];
      const b = cmnd[lag];
      const c = cmnd[lag + 1];
      const bend = a - 2 * b + c;
      return rate / (lag + (bend > 0 ? (a - c) / (2 * bend) : 0));
    }
    return 0;
  }

  function frame() {
    const now = performance.now();
    analyser.getFloatTimeDomainData(raw);
    // averaging neighbours is the low-pass that goes with dropping the rate
    for (let i = 0; i < x.length; i++) {
      let s = 0;
      for (let k = 0; k < step; k++) s += raw[i * step + k];
      x[i] = s / step;
    }
    let sum = 0;
    for (let i = x.length - span; i < x.length; i++) sum += x[i] * x[i];
    const rms = Math.sqrt(sum / span);
    level = Math.max(0, Math.min(1, (20 * Math.log10(rms + 1e-9) + 60) / 50)); // −60 dB … −10 dB
    noise = Math.min(rms, noise * 1.002); // follows the quietest moments, creeps back up slowly
    const gate = Math.max(MIN_GATE, noise * GATE);
    const floor = Math.min(...recent);
    recent.push(rms);
    if (recent.length > 4) recent.shift();

    // the game is making a sound of its own: don't take it for the player
    if (now < Dots.Audio.quietAt + ECHO_MS) {
      calmUntil = now + CALM_MS;
      count = 0;
      return;
    }
    if (rms < gate) {
      if (rms < gate / 2) last = null; // silence: the next note counts, even the same one
      count = 0;
      return;
    }
    if (rms > floor * ATTACK && now > calmUntil) {
      last = null; // a new pluck: the same note counts again
      count = 0;
      calmUntil = now + CALM_MS;
    }

    const f = detect(analyser.context.sampleRate / step);
    const m = f ? 69 + 12 * Math.log2(f / 440) : NaN;
    const near = Math.round(m);
    if (!f || Math.abs(m - near) > OFF_PITCH || near < low || near > high) {
      count = 0;
      return;
    }
    count = near === cand ? count + 1 : 1;
    cand = near;
    if (count < STEADY || near === last) return;
    // an octave jump with no new pluck is the detector slipping to an overtone, not a new note
    if (last !== null && (near - last) % 12 === 0) return;
    last = near;
    calmUntil = now + CALM_MS;
    if (handler) handler(near, now);
  }

  // Listens for notes from low to high (sounding MIDI pitch). Asks for the microphone the first time.
  function start(range) {
    low = range.low;
    high = range.high;
    wanted = true;
    if (!supported) return Promise.resolve();
    if (stream) {
      fit();
      return Promise.resolve();
    }
    if (opening) return opening;
    setStatus('starting');
    // speech processing (echo cancelling, noise suppression, auto gain) eats steady tones, so it's off
    opening = navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((s) => {
        if (!wanted) return s.getTracks().forEach((tr) => tr.stop());
        const ctx = Dots.Audio.ensure();
        stream = s;
        source = ctx.createMediaStreamSource(s);
        analyser = ctx.createAnalyser();
        source.connect(analyser);
        s.getAudioTracks()[0].onended = () => {
          stop();
          setStatus('no-device');
        };
        fit();
        noise = Infinity;
        recent = [];
        cand = last = null;
        count = 0;
        timer = setInterval(frame, HOP_MS);
        setStatus('on');
      })
      .catch((err) => setStatus(err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'denied' : 'no-device'))
      .finally(() => (opening = null));
    return opening;
  }

  // Lets go of the microphone (the browser's recording indicator goes away).
  function stop() {
    wanted = false;
    if (stream) {
      clearInterval(timer);
      source.disconnect();
      stream.getTracks().forEach((tr) => tr.stop());
      stream = source = analyser = null;
    }
    level = 0;
    if (status === 'on' || status === 'starting') setStatus('off');
  }

  return {
    supported,
    start,
    stop,
    // 'off' | 'starting' | 'on' | 'denied' | 'no-device' | 'unsupported'
    get status() {
      return status;
    },
    // loudness for a meter, 0–1
    get level() {
      return level;
    },
    onNote(fn) {
      handler = fn;
    },
    onStatus(fn) {
      listeners.push(fn);
      fn(status);
    },
  };
})();
