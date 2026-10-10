// App controller: screens, input routing, HUD, results and settings.
(() => {
  const { Music, Audio, Midi, Store, Levels, INSTRUMENTS, Staff, PianoInput, NeckInput, Game, Practice } = Dots;
  const $ = (s) => document.querySelector(s);

  const data = Store.load();
  const S = () => data.settings;
  const staff = new Staff($('#staff'));

  let screen = 'home';
  let inst = null;
  let levelIdx = 0;
  let game = null;
  let inputUI = null;
  let raf = 0;
  let last = 0;
  let overlayPrimary = null;
  let overlayMidi = null;
  let overlayMidiReadyAt = 0;
  const hudCache = {};

  const level = () => Levels[inst][levelIdx];
  // progress is keyed by level name, so reordering a course keeps stars on the right level
  const prog = (k, i) => data.progress[k][Levels[k][i].name] || {};
  const I = () => INSTRUMENTS[inst];
  const letters = () => (S().naming === 'H' ? 'C D E F G A H' : 'C D E F G A B');
  const starStr = (n, max = 3) => '★'.repeat(n) + `<span class="off">${'★'.repeat(max - n)}</span>`;

  // ---------- screens

  function show(name) {
    screen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    document.body.classList.toggle('in-game', name === 'game');
    if (name !== 'game') {
      cancelAnimationFrame(raf);
      raf = 0;
      game = null;
      hideOverlay();
    }
    if (name === 'home') renderHome();
    if (name === 'levels') renderLevels();
  }

  function starsFor(k) {
    return Levels[k].reduce((a, _, i) => a + (prog(k, i).stars || 0), 0);
  }

  function renderHome() {
    document.querySelectorAll('.instrument-card').forEach((c) => {
      const k = c.dataset.instrument;
      c.querySelector('.inst-stars').textContent = `★ ${starsFor(k)} / ${Levels[k].length * 3}`;
    });
    document.querySelectorAll('.letters').forEach((e) => (e.textContent = letters()));
  }

  const unlocked = (k, i) => S().unlockAll || i === 0 || (prog(k, i - 1).stars || 0) > 0;

  function notesSummary(pool) {
    const uniq = [...new Map(pool.map((n) => [n.midi, n])).values()].sort((a, b) => a.midi - b.midi);
    if (uniq.length <= 7) return uniq.map((n) => Music.letter(n.idx, S().naming)).join(' ');
    return `${Music.label(uniq[0], S().naming)} – ${Music.label(uniq[uniq.length - 1], S().naming)}`;
  }

  function modeLabel(l) {
    if (l.mode === 'sprint') return `Sprint ${l.time}s`;
    if (l.mode === 'survival') return 'Survival';
    return 'Classic';
  }

  function rulesText(l) {
    if (l.mode === 'sprint') return `Get ${l.goal} right within ${l.time} seconds. Each mistake costs ${l.penalty}s.`;
    if (l.mode === 'survival') return `Get ${l.goal} right with ${l.lives} lives. The notes keep speeding up.`;
    return `Get ${l.goal} right. You have ${l.lives} lives — a wrong answer or a missed note costs one.`;
  }

  function renderLevels() {
    $('#levelsTitle').textContent = I().name;
    $('#levelsStars').textContent = `★ ${starsFor(inst)} / ${Levels[inst].length * 3}`;
    const cards = Levels[inst].map((l, i) => {
      const ok = unlocked(inst, i);
      const p = prog(inst, i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'level-card' + (ok ? '' : ' locked');
      b.innerHTML = `
        <span class="badge ${l.mode}">${modeLabel(l)}</span>
        <span class="num">${ok ? i + 1 : '🔒'}</span>
        <span class="lname">${l.name}</span>
        <span class="lnotes">${notesSummary(l.pool)}</span>
        <span class="lfoot"><span class="stars">${starStr(p.stars || 0)}</span>${p.best ? `<span class="best">Best ${p.best}</span>` : ''}</span>`;
      b.addEventListener('click', () => ok && startLevel(i));
      return b;
    });
    const practice = document.createElement('button');
    practice.type = 'button';
    practice.className = 'level-card practice-card';
    practice.innerHTML = `
      <span class="badge practice">Free play</span>
      <span class="num">♪</span>
      <span class="lname">Practice</span>
      <span class="lnotes">Play anything and see where it is written.</span>`;
    practice.addEventListener('click', startPractice);
    $('#levelGrid').replaceChildren(practice, ...cards);
    renderTrouble();
  }

  function renderTrouble() {
    const rows = Object.entries(data.stats[inst])
      .map(([id, s]) => ({ id, n: s.ok + s.bad, rate: s.bad / (s.ok + s.bad) }))
      .filter((r) => r.n >= 4 && r.rate >= 0.15)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8);
    $('#troubleBox').hidden = rows.length === 0;
    $('#troubleList').replaceChildren(
      ...rows.map((r) => {
        const e = document.createElement('span');
        e.className = 'trouble-chip';
        e.textContent = `${Music.label(Music.parse(r.id), S().naming)} · ${Math.round(r.rate * 100)}% wrong`;
        return e;
      })
    );
  }

  // ---------- game

  // 'hit' | 'octave' (right letter, wrong octave) | false
  function check(note, ans) {
    if (ans.midi != null && S().strict) {
      if (ans.midi === note.midi) return 'hit';
      return ans.idx === note.idx ? 'octave' : false;
    }
    return ans.idx === note.idx ? 'hit' : false;
  }

  function startLevel(i) {
    levelIdx = i;
    enterGame(new Game(level(), { check, hooks }), i + 1, level().name);
    renderIntro();
  }

  function startPractice() {
    enterGame(new Practice(), '♪', 'Practice');
    renderPracticeIntro();
  }

  function enterGame(g, num, name) {
    show('game');
    game = g;
    $('#screen-game').classList.toggle('practice', !!g.practice);
    staff.configure({ clefs: I().clefs, naming: S().naming, notes: g.practice ? [] : level().pool });
    buildInput();
    Object.keys(hudCache).forEach((k) => delete hudCache[k]);
    $('#hudLevelNum').textContent = num;
    $('#hudLevelName').textContent = name;
    hideOverlay();
    if (document.activeElement) document.activeElement.blur();
    staff.resize();
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function refreshIntro() {
    if (!game) return;
    if (game.practice) renderPracticeIntro();
    else if (game.state === 'intro') renderIntro();
  }

  function kbdLetters() {
    return letters()
      .split(' ')
      .map((k) => `<kbd>${k}</kbd>`)
      .join('');
  }

  function renderPracticeIntro() {
    const piano = I().input === 'piano';
    $('#intro').hidden = false;
    $('#startBtn').hidden = true;
    $('#introTitle').textContent = `Practice · ${I().name}`;
    $('#introDesc').textContent = 'Play any note or chord and see where it is written. No score, no clock.';
    $('#introRules').textContent = piano
      ? 'Middle C and above go on the treble staff, lower notes on the bass staff. Black keys are shown as sharps.'
      : `${I().name} music is written an octave higher than it sounds.`;
    const midi = Midi.status === 'connected' ? ', play your MIDI keyboard (chords too)' : '';
    $('#introKeys').innerHTML = `Click the ${piano ? 'keys' : 'fretboard'}${midi}, or type ${kbdLetters()} to find a note on the ${piano ? 'keyboard' : 'neck'}.`;
  }

  // Written MIDI pitch -> staff note on the right clef for this instrument.
  // Piano notes above C7 / below C1 are written under 8va / 8vb, as in printed music.
  function practiceNote(midi) {
    const grand = I().clefs === 'grand';
    const clef = grand ? (midi >= 60 ? 'treble' : 'bass') : I().clefs;
    const ottava = grand && midi > 96 ? 1 : grand && midi < 24 ? -1 : 0;
    game.add({ ...Music.fromMidi(midi, ottava), clef });
  }

  function renderIntro() {
    const l = level();
    $('#intro').hidden = false;
    $('#startBtn').hidden = false;
    $('#introTitle').textContent = `Level ${levelIdx + 1} · ${l.name}`;
    $('#introDesc').textContent = `${l.desc} Notes: ${notesSummary(l.pool)}.`;
    $('#introRules').textContent = rulesText(l);
    const where = I().input === 'piano' ? 'click the keys' : 'click the fretboard';
    const midiOn = Midi.status === 'connected';
    const midi = midiOn ? ', or play your MIDI keyboard' : '';
    $('#introKeys').innerHTML = `Type ${kbdLetters()}, ${where}${midi}. <kbd>Esc</kbd> pauses.`;
    $('#startBtn').innerHTML = `Start <kbd>Enter</kbd>${midiOn ? '<span class="or">or any MIDI key</span>' : ''}`;
  }

  function buildInput() {
    const panel = $('#inputPanel');
    const common = { labels: S().labels, naming: S().naming, onPress: onInstrumentPress };
    if (I().input === 'piano') {
      const mids = game.practice ? I().practiceRange.map((n) => Music.parse(n).midi) : level().pool.map((n) => n.midi);
      const low = Math.floor(Math.min(...mids) / 12) * 12;
      let high = Math.ceil(Math.max(...mids) / 12) * 12;
      if (high - low < 24) high = low + 24;
      // a real piano runs A0 (21) to C8 (108)
      inputUI = new PianoInput(panel, { low: Math.max(21, low), high: Math.min(108, high), ...common });
    } else {
      inputUI = new NeckInput(panel, {
        strings: I().strings.map((n) => Music.parse(n).midi),
        thick: I().thick,
        wound: I().wound,
        frets: 12,
        ...common,
      });
    }
  }

  function begin() {
    if (!game || game.state !== 'intro') return;
    Audio.ensure();
    $('#intro').hidden = true;
    staff.resize();
    game.begin();
  }

  function answer(ans) {
    if (!game || game.state !== 'playing') return null;
    const r = game.input(ans);
    if (!r) return null;
    if (r.result === 'wrong') Audio.buzz();
    if (r.result === 'hit' && ans.source === 'key') Audio.note(r.note.midi + I().transpose, I().timbre);
    return r.result;
  }

  function onInstrumentPress(midi, el) {
    Audio.note(midi + I().transpose, I().timbre);
    if (game && game.practice) return practiceNote(midi);
    const result = answer({ midi, idx: Music.idxFromMidi(midi), label: Music.midiName(midi, S().naming), source: 'mouse' });
    if (result) inputUI.mark(el, result);
  }

  function recordStat(note, ok) {
    const st = data.stats[inst];
    const s = st[note.id] || (st[note.id] = { ok: 0, bad: 0 });
    if (ok) s.ok++;
    else s.bad++;
  }

  const hooks = {
    onTick(final) {
      Audio.tick(final);
    },
    onResult(kind, note) {
      recordStat(note, kind === 'hit' || kind === 'octave');
      if (kind === 'octave') inputUI.hint(note.midi);
      if (kind === 'miss') {
        inputUI.hint(note.midi);
        Audio.buzz(true);
      }
    },
    onEnd(result) {
      const p = { stars: 0, best: 0, ...prog(inst, levelIdx) };
      const wasLocked = levelIdx + 1 < Levels[inst].length && !unlocked(inst, levelIdx + 1);
      p.best = Math.max(p.best || 0, result.score);
      if (result.win) p.stars = Math.max(p.stars || 0, result.stars);
      data.progress[inst][level().name] = p;
      Store.save(data);
      result.newBest = result.score === p.best && result.score > 0;
      result.unlockedNext = wasLocked && unlocked(inst, levelIdx + 1);
      Audio.fanfare(result.win);
      const ended = game;
      setTimeout(() => game === ended && showResults(result), 650);
    },
  };

  function setText(sel, val, html) {
    if (hudCache[sel] === val) return;
    hudCache[sel] = val;
    if (html) $(sel).innerHTML = val;
    else $(sel).textContent = val;
  }

  function hud() {
    const g = game;
    if (g.practice) return;
    setText('#hudScore', g.score);
    setText('#hudCombo', g.combo);
    if (g.timeLeft != null) {
      setText('#hudLivesLabel', 'Time');
      setText('#hudLives', `${Math.ceil(g.timeLeft)}s`);
    } else {
      setText('#hudLivesLabel', 'Lives');
      const lost = g.level.lives - Math.max(0, g.lives);
      setText('#hudLives', '♥'.repeat(Math.max(0, g.lives)) + `<span class="off">${'♥'.repeat(lost)}</span>`, true);
    }
    setText('#hudGoal', `${g.correct} / ${g.level.goal}`);
    const pct = `${Math.min(100, (g.correct / g.level.goal) * 100)}%`;
    if (hudCache.pct !== pct) $('#hudProgress').style.width = hudCache.pct = pct;
  }

  function frame(t) {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    if (game) {
      game.update(dt);
      staff.draw(game);
      hud();
    }
    raf = requestAnimationFrame(frame);
  }

  // ---------- overlays

  // midi: any MIDI key triggers the first action (after a short guard against stray presses)
  function showOverlay(html, actions, { midi = false } = {}) {
    const card = $('#overlayCard');
    card.innerHTML = html;
    const foot = document.createElement('div');
    foot.className = 'overlay-actions';
    actions.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (i === 0 ? '' : ' ghost');
      b.textContent = a.label;
      if (i === 0 && midi && Midi.status === 'connected') b.insertAdjacentHTML('beforeend', '<span class="or">or any MIDI key</span>');
      b.addEventListener('click', a.run);
      foot.appendChild(b);
    });
    card.appendChild(foot);
    overlayPrimary = actions[0].run;
    overlayMidi = midi ? actions[0].run : null;
    overlayMidiReadyAt = performance.now() + 1000;
    $('#overlay').classList.remove('hidden');
  }

  function hideOverlay() {
    $('#overlay').classList.add('hidden');
    overlayPrimary = null;
    overlayMidi = null;
  }

  function pause() {
    if (!game || !game.pause()) return;
    showOverlay(`<h2>Paused</h2><p class="muted">Take a breath. The notes will wait.</p>`, [
      { label: 'Resume', run: resume },
      { label: 'Restart', run: () => startLevel(levelIdx) },
      { label: 'Levels', run: () => show('levels') },
    ]);
  }

  function resume() {
    hideOverlay();
    if (game) {
      last = performance.now();
      game.resume();
    }
  }

  function showResults(r) {
    if (screen !== 'game') return;
    const hasNext = levelIdx + 1 < Levels[inst].length;
    const titles = { goal: r.stars === 3 ? 'Flawless!' : 'Level complete!', lives: 'Out of lives', time: "Time's up" };
    let sub = '';
    if (!r.win && r.reason === 'time') sub = `You got ${r.correct} of ${level().goal}. Answer faster to beat the clock.`;
    else if (!r.win) sub = 'Missed notes light up on the instrument — watch for them and try again.';
    else if (r.unlockedNext) sub = `Level ${levelIdx + 2} unlocked.`;
    else if (!hasNext) sub = `That's every ${I().name.toLowerCase()} level. Respect.`;
    const trouble = r.trouble.length
      ? `<p class="trouble-line">Watch out for: ${r.trouble.map((id) => `<b>${Music.label(Music.parse(id), S().naming)}</b>`).join(', ')}</p>`
      : '';
    const html = `
      <div class="big-stars">${starStr(r.stars)}</div>
      <h2>${titles[r.reason]}</h2>
      ${sub ? `<p class="muted">${sub}</p>` : ''}
      <div class="result-grid">
        <div><span>Score</span><b>${r.score}</b>${r.bonus ? `<small>incl. +${r.bonus} bonus</small>` : ''}${r.newBest ? '<small class="new">New best!</small>' : ''}</div>
        <div><span>Accuracy</span><b>${Math.round(r.accuracy * 100)}%</b></div>
        <div><span>Best streak</span><b>${r.maxCombo}</b></div>
        <div><span>Avg. per note</span><b>${r.avgReaction ? r.avgReaction.toFixed(1) + 's' : '—'}</b></div>
      </div>
      ${trouble}`;
    const actions = [];
    if (r.win && hasNext) actions.push({ label: 'Next level', run: () => startLevel(levelIdx + 1) });
    actions.push({ label: r.win ? 'Play again' : 'Try again', run: () => startLevel(levelIdx) });
    actions.push({ label: 'Levels', run: () => show('levels') });
    showOverlay(html, actions, { midi: true });
  }

  // ---------- keyboard

  function keyToIdx(key) {
    const k = key.toUpperCase();
    const i = 'CDEFGA'.indexOf(k);
    if (k.length === 1 && i >= 0) return i;
    if (k === (S().naming === 'H' ? 'H' : 'B')) return 6;
    return null;
  }

  document.addEventListener('keydown', (e) => {
    if ($('#settings').open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (screen !== 'game' || !game) return;
    const k = e.key;
    if (game.practice) {
      const idx = keyToIdx(k);
      if (idx === null || e.repeat) return;
      e.preventDefault();
      const midi = Music.fromStep(I().letterOctave * 7 + idx).midi;
      Audio.ensure();
      Audio.note(midi + I().transpose, I().timbre);
      practiceNote(midi);
      inputUI.hint(midi);
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (game.state === 'intro') begin();
      else if (overlayPrimary) overlayPrimary();
      return;
    }
    if (k === 'Escape' || k === ' ') {
      e.preventDefault();
      if (game.state === 'intro' && k === ' ') begin();
      else if (game.state === 'paused') resume();
      else pause();
      return;
    }
    if (e.repeat) return;
    const idx = keyToIdx(k);
    if (idx === null) return;
    e.preventDefault();
    answer({ idx, midi: null, label: Music.letter(idx, S().naming), source: 'key' });
  });

  // ---------- MIDI

  Midi.onNote((m) => {
    if (screen !== 'game' || !game) return;
    const written = m - I().transpose;
    // a key used like Enter (start / results screen) stays silent
    if (game.state === 'intro') {
      begin();
      return;
    }
    if (overlayMidi) {
      if (performance.now() >= overlayMidiReadyAt) overlayMidi();
      return;
    }
    if (S().midiSound) Audio.note(m, I().timbre);
    if (game.practice) {
      inputUI.press(written);
      practiceNote(written);
      return;
    }
    if (inputUI) inputUI.press(written);
    const result = answer({ midi: written, idx: Music.idxFromMidi(written), label: Music.midiName(written, S().naming), source: 'midi' });
    if (result && inputUI) inputUI.markMidi(written, result);
  });

  const MIDI_TEXT = {
    unsupported: "This browser doesn't support Web MIDI — try Chrome or Edge.",
    off: 'Not connected',
    denied: 'Access was denied. Allow MIDI for this page in your browser settings.',
    'no-device': 'Allowed, but no device found. Plug one in.',
  };

  Midi.onStatus((status, names) => {
    const chip = $('#midiChip');
    chip.classList.toggle('on', status === 'connected');
    chip.textContent = status === 'connected' ? `MIDI · ${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}` : status === 'unsupported' ? 'No MIDI' : 'MIDI off';
    $('#midiStatus').textContent = status === 'connected' ? `Connected: ${names.join(', ')}` : MIDI_TEXT[status];
    $('#midiConnect').hidden = status === 'connected' || status === 'unsupported';
    if (screen === 'game') refreshIntro();
  });

  function connectMidi() {
    Midi.connect().then((ok) => {
      S().midiEnabled = ok;
      Store.save(data);
    });
  }

  // ---------- settings

  const dlg = $('#settings');
  const form = $('#settingsForm');

  function fillSettings() {
    const s = S();
    form.elements.naming.value = s.naming;
    form.elements.labels.value = s.labels;
    ['strict', 'sound', 'midiSound', 'unlockAll'].forEach((k) => (form.elements[k].checked = s[k]));
  }

  form.addEventListener('change', () => {
    const s = S();
    s.naming = form.elements.naming.value;
    s.labels = form.elements.labels.value;
    ['strict', 'sound', 'midiSound', 'unlockAll'].forEach((k) => (s[k] = form.elements[k].checked));
    Store.save(data);
    applySettings();
  });

  function applySettings() {
    Audio.setEnabled(S().sound);
    staff.naming = S().naming;
    if (screen === 'home') renderHome();
    if (screen === 'levels') renderLevels();
    if (screen === 'game' && game) {
      buildInput();
      refreshIntro();
    }
  }

  function openSettings() {
    if (game && game.state === 'playing') pause();
    fillSettings();
    dlg.showModal();
  }

  $('#settingsBtn').addEventListener('click', openSettings);
  $('#midiConnect').addEventListener('click', connectMidi);
  $('#midiChip').addEventListener('click', () => (Midi.status === 'off' || Midi.status === 'denied' ? connectMidi() : openSettings()));
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Reset all stars, best scores and note stats?')) return;
    const fresh = Store.defaults();
    data.progress = fresh.progress;
    data.stats = fresh.stats;
    Store.save(data);
    applySettings();
  });

  // ---------- wiring

  document.querySelectorAll('.instrument-card').forEach((c) =>
    c.addEventListener('click', () => {
      inst = c.dataset.instrument;
      show('levels');
    })
  );
  $('#brandBtn').addEventListener('click', () => show('home'));
  $('#levelsBack').addEventListener('click', () => show('home'));
  $('#gameBack').addEventListener('click', () => show('levels'));
  $('#pauseBtn').addEventListener('click', () => (game && game.state === 'paused' ? resume() : pause()));
  $('#startBtn').addEventListener('click', begin);

  new ResizeObserver(() => staff.resize()).observe($('#stage'));
  document.addEventListener('visibilitychange', () => document.hidden && pause());
  if (document.fonts) {
    document.fonts
      .load('40px Bravura', '\uE050\uE062')
      .then((faces) => {
        staff.smufl = faces.length > 0;
        if (staff.lastGame) staff.draw(staff.lastGame);
      })
      .catch(() => {});
  }

  Audio.setEnabled(S().sound);
  if (S().midiEnabled) connectMidi();
  renderHome();
})();
