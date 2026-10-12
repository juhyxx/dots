// App controller: screens and their URLs, input routing, HUD, results, settings, language and theme.
(() => {
  const { Music, Audio, Midi, Mic, Store, Levels, INSTRUMENTS, Staff, BeatView, PianoInput, NeckInput, Game, Practice, Metronome, I18n } = Dots;
  const { t } = I18n;
  const $ = (s) => document.querySelector(s);

  const data = Store.load();
  const S = () => data.settings;
  const staff = new Staff($('#staff'));
  const beatView = new BeatView($('#beats'));

  let screen = 'home';
  let inst = null;
  let levelIdx = 0;
  let game = null;
  let inputUI = null;
  let raf = 0;
  let last = 0;
  let overlayPrimary = null;
  let overlayNote = null;
  let overlayNoteAt = 0;
  let padTimer = 0;
  const hudCache = {};

  const level = () => Levels[inst][levelIdx];
  // progress is keyed by level name, so reordering a course keeps stars on the right level
  const prog = (k, i) => data.progress[k][Levels[k][i].name] || {};
  const I = () => INSTRUMENTS[inst];
  // the note names in use: the player's pick, or else what their language uses
  const naming = () => S().naming || I18n.naming();
  const letters = () => Music.LETTERS.map((_, i) => Music.letter(i, naming())).join(' ');
  const lvl = (l) => I18n.level(inst, l); // translated { name, desc }
  const view = () => (game && game.rhythm ? beatView : staff);
  const starStr = (n, max = 3) => '★'.repeat(n) + `<span class="off">${'★'.repeat(max - n)}</span>`;
  // joins whole sentences (Chinese runs them together without a space)
  const sentences = (...a) => a.filter(Boolean).join(t('sentenceGap'));
  const decimal = (x, d) => x.toLocaleString(I18n.lang, { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------- screens

  function show(name) {
    if (game && game.rhythm) game.pause(); // silences clicks already handed to the audio clock
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
    syncMic();
  }

  function starsFor(k) {
    return Levels[k].reduce((a, _, i) => a + (prog(k, i).stars || 0), 0);
  }

  function renderHome() {
    document.querySelectorAll('.instrument-card').forEach((c) => {
      const k = c.dataset.instrument;
      c.querySelector('.inst-stars').textContent = `★ ${starsFor(k)} / ${Levels[k].length * 3}`;
    });
    $('#howAnswer').innerHTML =
      naming() === 'S'
        ? t('how.answerTextSolfege', { keys: `1 = ${Music.letter(0, 'S')} … 7 = ${Music.letter(6, 'S')}` })
        : t('how.answerText', { keys: `<span class="letters">${letters()}</span>` });
  }

  const unlocked = (k, i) => S().unlockAll || i === 0 || (prog(k, i - 1).stars || 0) > 0;

  function notesSummary(pool) {
    const uniq = [...new Map(pool.map((n) => [n.midi, n])).values()].sort((a, b) => a.midi - b.midi);
    if (uniq.length <= 7) return uniq.map((n) => Music.letter(n.idx, naming())).join(' ');
    return `${Music.label(uniq[0], naming())} – ${Music.label(uniq[uniq.length - 1], naming())}`;
  }

  function modeLabel(l) {
    if (I().rhythm) return t('met.bpm', { bpm: l.bpm });
    if (l.mode === 'sprint') return t('mode.sprint', { n: l.time });
    if (l.mode === 'survival') return t('mode.survival');
    return t('mode.classic');
  }

  function rulesText(l) {
    if (l.mode === 'sprint') return t('rules.sprint', { goal: l.goal, time: l.time, penalty: l.penalty });
    if (l.mode === 'survival') return t('rules.survival', { goal: l.goal, lives: l.lives });
    return t('rules.classic', { goal: l.goal, lives: l.lives });
  }

  const barsText = (l) => t('met.bars', { n: l.bars }) + (l.gaps ? ' · ' + t('met.gapShort') : '');

  function renderLevels() {
    const rhythm = !!I().rhythm;
    $('#levelsTitle').textContent = t('inst.' + inst);
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
        <span class="lname">${lvl(l).name}</span>
        <span class="lnotes">${rhythm ? barsText(l) : notesSummary(l.pool)}</span>
        <span class="lfoot"><span class="stars">${starStr(p.stars || 0)}</span>${p.best ? `<span class="best">${t('levels.best', { n: p.best })}</span>` : ''}</span>`;
      b.addEventListener('click', () => ok && go(`${inst}/${i + 1}`));
      return b;
    });
    // first card: free play for instruments, calibration for the metronome
    const first = document.createElement('button');
    first.type = 'button';
    first.className = 'level-card practice-card';
    if (rhythm) {
      first.innerHTML = `
        <span class="badge practice">${t('met.calBadge')}</span>
        <span class="num">◎</span>
        <span class="lname">${t('met.calName')}</span>
        <span class="lnotes">${S().latency ? t('met.calCardSet', { ms: S().latency }) : t('met.calCard')}</span>`;
      first.addEventListener('click', () => go(`${inst}/calibrate`));
    } else {
      first.innerHTML = `
        <span class="badge practice">${t('practice.badge')}</span>
        <span class="num">♪</span>
        <span class="lname">${t('practice.name')}</span>
        <span class="lnotes">${t('practice.card')}</span>`;
      first.addEventListener('click', () => go(`${inst}/practice`));
    }
    $('#levelGrid').replaceChildren(first, ...cards);
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
        e.textContent = t('levels.troubleChip', { note: Music.label(Music.parse(r.id), naming()), pct: Math.round(r.rate * 100) });
        return e;
      })
    );
  }

  // ---------- routing
  // Every screen has its own URL, so the browser's Back and Forward buttons move between them:
  // home (no hash) · #/piano (levels) · #/piano/3 (level 3) · #/piano/practice · #/metronome/calibrate.
  // Hash URLs because GitHub Pages can't rewrite other paths to index.html.

  let path = null; // route of the screen on show

  const hashPath = () => location.hash.replace(/^#\/?/, '');
  const urlFor = (p) => (p ? '#/' + p : location.pathname + location.search);

  // Shows the screen for p and returns the route it settled on: an unknown or locked one falls back to its parent.
  function render(p) {
    const [k, sub, extra] = p.split('/').filter(Boolean);
    if (!Object.hasOwn(INSTRUMENTS, k) || extra != null) {
      show('home');
      return '';
    }
    inst = k;
    const rhythm = !!INSTRUMENTS[k].rhythm;
    if (sub === (rhythm ? 'calibrate' : 'practice')) {
      if (rhythm) startCalibration();
      else startPractice();
      return `${k}/${sub}`;
    }
    const i = Number(sub) - 1;
    if (Levels[k][i] && unlocked(k, i)) {
      startLevel(i);
      return `${k}/${i + 1}`;
    }
    show('levels');
    return k;
  }

  function route() {
    const p = hashPath();
    if (p === path) return;
    path = render(p);
    if (path !== p) history.replaceState(history.state, '', urlFor(path));
  }

  // Going back up to the screen we came from steps back in history instead of adding an entry,
  // so the in-app back buttons and the browser's Back button stay in step.
  // replace: swap the current entry (Next level, so Back still leads to the level list).
  function go(p, { replace = false } = {}) {
    if (p === path) return;
    const st = history.state || {};
    if (!replace && st.from === p) {
      history.back();
      return;
    }
    if (replace) history.replaceState(st, '', urlFor(p));
    else history.pushState({ from: path }, '', urlFor(p));
    route();
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
    const l = level();
    enterGame(I().rhythm ? new Metronome(l, { latency: S().latency, hooks }) : new Game(l, { check, hooks }), i + 1);
    renderIntro();
  }

  function startPractice() {
    enterGame(new Practice(), '♪');
    renderPracticeIntro();
  }

  function startCalibration() {
    enterGame(new Metronome(Metronome.CALIBRATE, { hooks }), '◎');
    renderIntro();
  }

  const restart = () => (game.level && game.level.calibrate ? startCalibration() : startLevel(levelIdx));
  const calibrating = () => !!(game && game.level && game.level.calibrate);

  const gameName = () => (game.practice ? t('practice.name') : calibrating() ? t('met.calName') : lvl(level()).name);

  function enterGame(g, num) {
    show('game');
    game = g;
    const el = $('#screen-game');
    el.classList.toggle('practice', !!g.practice);
    el.classList.toggle('rhythm', !!g.rhythm);
    el.classList.toggle('calibrate', calibrating());
    $('#hudLives').classList.toggle('lives', !g.rhythm);
    if (!g.rhythm) staff.configure({ clefs: I().clefs, naming: naming(), notes: g.practice ? [] : level().pool });
    buildInput();
    Object.keys(hudCache).forEach((k) => delete hudCache[k]);
    $('#hudLevelNum').textContent = num;
    $('#hudLevelName').textContent = gameName();
    hideOverlay();
    if (document.activeElement) document.activeElement.blur();
    view().resize();
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function refreshIntro() {
    if (!game) return;
    if (game.practice) renderPracticeIntro();
    else if (game.state === 'intro') renderIntro();
  }

  // the keys that answer: letters, or 1–7 for solfège
  function kbdKeys() {
    if (naming() === 'S') return Music.LETTERS.map((_, i) => `<kbd>${i + 1}</kbd>${Music.letter(i, 'S')}`).join(' ');
    return letters()
      .split(' ')
      .map((k) => `<kbd>${k}</kbd>`)
      .join('');
  }

  const micOn = () => !!(inst && I().mic) && Mic.status === 'on';
  // what else works like Enter on the start and results screens
  const orNote = () => (Midi.status === 'connected' ? t('intro.orMidi') : micOn() ? t('intro.orPlay') : '');

  function startButton() {
    const or = orNote();
    $('#startBtn').hidden = false;
    $('#startBtn').innerHTML = `${t('intro.start')} <kbd>Enter</kbd>${or ? `<span class="or">${or}</span>` : ''}`;
  }

  function renderPracticeIntro() {
    const piano = I().input === 'piano';
    $('#intro').hidden = false;
    $('#startBtn').hidden = true;
    $('#introTitle').textContent = t('practice.title', { inst: t('inst.' + inst) });
    $('#introDesc').textContent = t('practice.desc');
    $('#introRules').textContent = t('practice.rules.' + inst);
    $('#introKeys').innerHTML = sentences(
      t(piano ? 'practice.keysPiano' : 'practice.keysNeck', { keys: kbdKeys() }),
      Midi.status === 'connected' && t('practice.midi'),
      micOn() && t('practice.mic')
    );
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
    if (game.rhythm) return renderRhythmIntro();
    const l = level();
    const midiOn = Midi.status === 'connected';
    $('#intro').hidden = false;
    $('#introTitle').textContent = t('intro.level', { n: levelIdx + 1, name: lvl(l).name });
    $('#introDesc').textContent = sentences(lvl(l).desc, t('intro.notes', { notes: notesSummary(l.pool) }));
    $('#introRules').textContent = rulesText(l);
    $('#introKeys').innerHTML = sentences(
      t(I().input === 'piano' ? 'intro.typePiano' : 'intro.typeNeck', { keys: kbdKeys() }),
      midiOn && t('intro.midi'),
      micOn() && t('intro.mic'),
      t('intro.esc', { esc: '<kbd>Esc</kbd>' })
    );
    startButton();
  }

  function renderRhythmIntro() {
    const l = game.level;
    const midiOn = Midi.status === 'connected';
    const soundOff = !S().sound && t('met.soundOff');
    $('#intro').hidden = false;
    if (l.calibrate) {
      $('#introTitle').textContent = t('met.calName');
      $('#introDesc').textContent = t('met.calDesc');
      $('#introRules').textContent = sentences(S().latency ? t('met.calNow', { ms: S().latency }) : t('met.calNone'), soundOff);
    } else {
      $('#introTitle').textContent = t('intro.level', { n: levelIdx + 1, name: lvl(l).name });
      $('#introDesc').textContent = sentences(lvl(l).desc, t('met.tempo', { bpm: l.bpm, bars: t('met.bars', { n: l.bars }) }));
      $('#introRules').textContent = sentences(t('met.rules', { pct: Math.round(l.stars[0] * 100) }), l.gaps && t('met.rulesGap'), soundOff);
    }
    $('#introKeys').innerHTML = sentences(t('met.keys'), midiOn && t('met.midi'), t('intro.esc', { esc: '<kbd>Esc</kbd>' }));
    startButton();
  }

  function buildInput() {
    const panel = $('#inputPanel');
    if (game.rhythm) {
      const pad = document.createElement('button');
      pad.type = 'button';
      pad.className = 'tap-pad';
      pad.innerHTML = `<b>${t('met.tap')}</b><small>${t('met.tapHint')}</small>`;
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        onTap(e.timeStamp);
      });
      panel.replaceChildren(pad);
      inputUI = null;
      return;
    }
    const common = { labels: S().labels, naming: naming(), onPress: onInstrumentPress };
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
    view().resize();
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
    const result = answer({ midi, idx: Music.idxFromMidi(midi), label: Music.midiName(midi, naming()), source: 'mouse' });
    if (result) inputUI.mark(el, result);
  }

  // metronome tap from any source; ms is the event's timeStamp
  function onTap(ms) {
    if (!game || !game.rhythm) return;
    if (game.state === 'intro') return begin();
    const grade = game.tap(ms);
    const pad = $('.tap-pad');
    if (!grade || !pad) return;
    clearTimeout(padTimer);
    pad.className = 'tap-pad flash ' + grade;
    padTimer = setTimeout(() => (pad.className = 'tap-pad'), 90);
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
      const ended = game;
      if (result.calibrate) {
        if (result.ok) {
          S().latency = result.latency;
          Store.save(data);
        }
        Audio.fanfare(result.ok);
        setTimeout(() => game === ended && showCalibration(result), 650);
        return;
      }
      const p = { stars: 0, best: 0, ...prog(inst, levelIdx) };
      const wasLocked = levelIdx + 1 < Levels[inst].length && !unlocked(inst, levelIdx + 1);
      p.best = Math.max(p.best || 0, result.score);
      if (result.win) p.stars = Math.max(p.stars || 0, result.stars);
      data.progress[inst][level().name] = p;
      Store.save(data);
      result.newBest = result.score === p.best && result.score > 0;
      result.unlockedNext = wasLocked && unlocked(inst, levelIdx + 1);
      Audio.fanfare(result.win);
      setTimeout(() => game === ended && showResults(result), 650);
    },
  };

  function setText(sel, val, html) {
    if (hudCache[sel] === val) return;
    hudCache[sel] = val;
    if (html) $(sel).innerHTML = val;
    else $(sel).textContent = val;
  }

  function progress(done, goal) {
    setText('#hudGoal', `${done} / ${goal}`);
    const pct = `${Math.min(100, (done / goal) * 100)}%`;
    if (hudCache.pct !== pct) $('#hudProgress').style.width = hudCache.pct = pct;
  }

  function hud() {
    const g = game;
    if (g.practice) return;
    setText('#hudScore', g.score);
    setText('#hudCombo', g.combo);
    if (g.rhythm) {
      const st = g.stats();
      setText('#hudLivesLabel', t('hud.timing'));
      setText('#hudLives', st.n ? `±${Math.round(st.meanAbs)} ms` : '—');
      progress(g.done, g.beats.length);
      return;
    }
    if (g.timeLeft != null) {
      setText('#hudLivesLabel', t('hud.time'));
      setText('#hudLives', `${Math.ceil(g.timeLeft)}s`);
    } else {
      setText('#hudLivesLabel', t('hud.lives'));
      const lost = g.level.lives - Math.max(0, g.lives);
      setText('#hudLives', '♥'.repeat(Math.max(0, g.lives)) + `<span class="off">${'♥'.repeat(lost)}</span>`, true);
    }
    progress(g.correct, g.level.goal);
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (game) {
      game.update(dt);
      view().draw(game);
      hud();
    }
    if (Mic.status === 'on') micMeter(Mic.level);
    raf = requestAnimationFrame(frame);
  }

  // ---------- overlays

  // byNote: any MIDI key or note played into the microphone triggers the first action
  // (after a short guard against stray presses)
  function showOverlay(html, actions, { byNote = false } = {}) {
    const card = $('#overlayCard');
    card.innerHTML = html;
    const foot = document.createElement('div');
    foot.className = 'overlay-actions';
    actions.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (i === 0 ? '' : ' ghost');
      b.textContent = a.label;
      if (i === 0 && byNote && orNote()) b.insertAdjacentHTML('beforeend', `<span class="or">${orNote()}</span>`);
      b.addEventListener('click', a.run);
      foot.appendChild(b);
    });
    card.appendChild(foot);
    overlayPrimary = actions[0].run;
    overlayNote = byNote ? actions[0].run : null;
    overlayNoteAt = performance.now() + 1000;
    $('#overlay').classList.remove('hidden');
  }

  function hideOverlay() {
    $('#overlay').classList.add('hidden');
    overlayPrimary = null;
    overlayNote = null;
  }

  function pause() {
    if (!game || !game.pause()) return;
    showPause();
  }

  function showPause() {
    showOverlay(`<h2>${t('pause.title')}</h2><p class="muted">${t(game.rhythm ? 'pause.textRhythm' : 'pause.text')}</p>`, [
      { label: t('pause.resume'), run: resume },
      { label: t('pause.restart'), run: restart },
      { label: t('btn.levels'), run: () => go(inst) },
    ]);
  }

  function resume() {
    hideOverlay();
    if (game) {
      last = performance.now();
      game.resume();
    }
  }

  // the buttons under a level's results
  function resultActions(r) {
    const actions = [];
    if (r.win && levelIdx + 1 < Levels[inst].length) actions.push({ label: t('res.next'), run: () => go(`${inst}/${levelIdx + 2}`, { replace: true }) });
    actions.push({ label: r.win ? t('res.again') : t('res.retry'), run: restart });
    actions.push({ label: t('btn.levels'), run: () => go(inst) });
    return actions;
  }

  function resultSub(r) {
    if (r.win && r.unlockedNext) return t('res.unlocked', { n: levelIdx + 2 });
    if (r.win && levelIdx + 1 >= Levels[inst].length) return t('res.allDone');
    return '';
  }

  function showResults(r) {
    if (screen !== 'game') return;
    if (r.rhythm) return showRhythmResults(r);
    const titles = { goal: r.stars === 3 ? t('res.flawless') : t('res.complete'), lives: t('res.lives'), time: t('res.time') };
    let sub = resultSub(r);
    if (!r.win && r.reason === 'time') sub = t('res.timeSub', { correct: r.correct, goal: level().goal });
    else if (!r.win) sub = t('res.livesSub');
    const trouble = r.trouble.length
      ? `<p class="trouble-line">${t('res.watch', { notes: r.trouble.map((id) => `<b>${Music.label(Music.parse(id), naming())}</b>`).join(', ') })}</p>`
      : '';
    const html = `
      <div class="big-stars">${starStr(r.stars)}</div>
      <h2>${titles[r.reason]}</h2>
      ${sub ? `<p class="muted">${sub}</p>` : ''}
      <div class="result-grid">
        <div><span>${t('res.score')}</span><b>${r.score}</b>${r.bonus ? `<small>${t('res.bonus', { n: r.bonus })}</small>` : ''}${r.newBest ? `<small class="new">${t('res.best')}</small>` : ''}</div>
        <div><span>${t('res.accuracy')}</span><b>${Math.round(r.accuracy * 100)}%</b></div>
        <div><span>${t('res.streak')}</span><b>${r.maxCombo}</b></div>
        <div><span>${t('res.avg')}</span><b>${r.avgReaction ? decimal(r.avgReaction, 1) + ' s' : '—'}</b></div>
      </div>
      ${trouble}`;
    showOverlay(html, resultActions(r), { byNote: true });
  }

  function showRhythmResults(r) {
    const l = game.level;
    const sub = r.win ? resultSub(r) : t('met.resFailSub', { pct: Math.round(l.stars[0] * 100) });
    const mean = Math.round(r.mean);
    let tendency = '';
    if (r.taps >= 4) tendency = Math.abs(mean) < 20 ? t('met.steady') : mean > 0 ? t('met.drag', { ms: mean }) : t('met.rush', { ms: -mean });
    const c = r.counts;
    const counts = [
      [t('met.perfect'), c.perfect],
      [t('met.good'), c.good],
      [t('met.offBeat'), c.off],
      [t('met.missed'), c.miss],
      ...(r.extra ? [[t('met.extras'), r.extra]] : []),
    ]
      .map(([k, v]) => `${k} <b>${v}</b>`)
      .join(' · ');
    const html = `
      <div class="big-stars">${starStr(r.stars)}</div>
      <h2>${r.win ? (r.stars === 3 ? t('res.flawless') : t('res.complete')) : t('met.resFail')}</h2>
      ${sub ? `<p class="muted">${sub}</p>` : ''}
      <div class="result-grid">
        <div><span>${t('res.score')}</span><b>${r.score}</b>${r.newBest ? `<small class="new">${t('res.best')}</small>` : ''}</div>
        <div><span>${t('res.accuracy')}</span><b>${Math.round(r.accuracy * 100)}%</b></div>
        <div><span>${t('met.resAverage')}</span><b>${r.taps ? BeatView.signed(r.mean) + ' ms' : '—'}</b><small>${t('met.signHint')}</small></div>
        <div><span>${t('met.resSpread')}</span><b>${r.taps > 1 ? '±' + Math.round(r.spread) + ' ms' : '—'}</b><small>${t('met.spreadHint')}</small></div>
      </div>
      <p class="result-counts">${counts}</p>
      ${tendency ? `<p>${tendency}</p>` : ''}`;
    showOverlay(html, resultActions(r), { byNote: true });
  }

  function showCalibration(r) {
    if (screen !== 'game') return;
    let text;
    if (!r.ok) text = t('met.calFailSub', { n: r.taps });
    else if (Math.abs(r.latency) < 5) text = t('met.calZero');
    else text = r.latency > 0 ? t('met.calLate', { ms: r.latency }) : t('met.calEarly', { ms: -r.latency });
    const html = `<h2>${r.ok ? t('met.calDone') : t('met.calFail')}</h2><p class="muted">${text}</p>`;
    const toLevels = () => go(inst);
    showOverlay(
      html,
      r.ok
        ? [{ label: t('set.done'), run: toLevels }, { label: t('met.calAgain'), run: startCalibration }]
        : [{ label: t('res.retry'), run: startCalibration }, { label: t('btn.levels'), run: toLevels }],
      { byNote: true }
    );
  }

  // ---------- keyboard

  function keyToIdx(key) {
    const k = key.toUpperCase();
    if (naming() === 'S' && /^[1-7]$/.test(k)) return Number(k) - 1;
    const i = 'CDEFGA'.indexOf(k);
    if (k.length === 1 && i >= 0) return i;
    if (k === (naming() === 'H' ? 'H' : 'B')) return 6;
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
    if (k === 'Enter' && (game.state === 'intro' || overlayPrimary)) {
      e.preventDefault();
      if (game.state === 'intro') begin();
      else overlayPrimary();
      return;
    }
    if (game.rhythm) {
      if (k === 'Escape') {
        e.preventDefault();
        if (game.state === 'paused') resume();
        else pause();
        return;
      }
      // any character key (Space included) or Enter is a tap
      if (e.repeat || (k.length !== 1 && k !== 'Enter')) return;
      e.preventDefault();
      onTap(e.timeStamp);
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
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
    answer({ idx, midi: null, label: Music.letter(idx, naming()), source: 'key' });
  });

  // ---------- MIDI and microphone

  // On the start and results screens a MIDI key or a played note works like Enter, and stays silent.
  // Returns true if it was used that way.
  function noteAsEnter() {
    if (game.state === 'intro') {
      begin();
      return true;
    }
    if (overlayNote) {
      if (performance.now() >= overlayNoteAt) overlayNote();
      return true;
    }
    return false;
  }

  // a note played on a MIDI keyboard or a real instrument, as written pitch
  function playedNote(written, source) {
    if (inputUI) inputUI.press(written);
    if (game.practice) return practiceNote(written);
    const result = answer({ midi: written, idx: Music.idxFromMidi(written), label: Music.midiName(written, naming()), source });
    if (result && inputUI) inputUI.markMidi(written, result);
  }

  Midi.onNote((m, vel, ms) => {
    if (screen !== 'game' || !game || noteAsEnter()) return;
    if (game.rhythm) {
      onTap(ms || performance.now());
      return;
    }
    if (S().midiSound) Audio.note(m, I().timbre);
    playedNote(m - I().transpose, 'midi');
  });

  // the instrument makes its own sound, so nothing is played back
  Mic.onNote((m) => {
    if (screen !== 'game' || !game || !I().mic || noteAsEnter()) return;
    playedNote(m - I().transpose, 'mic');
  });

  let midiState = ['off', []];

  function renderMidi() {
    const [status, names] = midiState;
    const chip = $('#midiChip');
    chip.classList.toggle('on', status === 'connected');
    chip.textContent =
      status === 'connected'
        ? `MIDI · ${names[0]}${names.length > 1 ? ` +${names.length - 1}` : ''}`
        : t(status === 'unsupported' ? 'midi.chipNone' : 'midi.chipOff');
    $('#midiStatus').textContent = status === 'connected' ? t('midi.connected', { names: names.join(', ') }) : t('midi.status.' + status);
    $('#midiConnect').hidden = status === 'connected' || status === 'unsupported';
  }

  Midi.onStatus((status, names) => {
    midiState = [status, names];
    renderMidi();
    if (screen === 'game') refreshIntro();
  });

  function connectMidi() {
    Midi.connect().then((ok) => {
      S().midiEnabled = ok;
      Store.save(data);
    });
  }

  // The microphone listens only during the levels and practice of an instrument that takes it,
  // and only while it's turned on. Elsewhere it's let go, so the browser's recording indicator goes away.
  function syncMic() {
    if (S().mic && screen === 'game' && I().mic) {
      const open = I().strings.map((n) => Music.parse(n).midi + I().transpose);
      // sounding range: a little below the lowest open string, up to the 15th fret on the highest
      Mic.start({ low: Math.min(...open) - 2, high: Math.max(...open) + 15 });
    } else Mic.stop();
    renderMic();
  }

  let micLevel = '';
  function micMeter(v) {
    const s = v.toFixed(2);
    if (s !== micLevel) $('#micChip').style.setProperty('--level', (micLevel = s));
  }

  function renderMic() {
    const st = Mic.status;
    const trouble = st === 'denied' || st === 'no-device' || st === 'unsupported';
    const chip = $('#micChip');
    chip.hidden = !(inst && I().mic && (screen === 'levels' || screen === 'game'));
    chip.classList.toggle('on', S().mic && !trouble);
    chip.textContent = t(
      st === 'unsupported' ? 'mic.chipNone' : !S().mic ? 'mic.chipOff' : st === 'denied' ? 'mic.chipDenied' : trouble ? 'mic.chipNone' : 'mic.chipOn'
    );
    if (st !== 'on') micMeter(0);
    $('#micStatus').textContent = trouble ? t('mic.status.' + st) : t('set.micHint');
  }

  Mic.onStatus(() => {
    renderMic();
    if (screen === 'game') refreshIntro();
  });

  // ---------- settings

  const dlg = $('#settings');
  const form = $('#settingsForm');

  function fillSettings() {
    const s = S();
    form.elements.lang.value = Object.hasOwn(I18n.LANGS, s.lang) ? s.lang : 'auto';
    form.elements.naming.value = naming();
    form.elements.labels.value = s.labels;
    form.elements.theme.value = s.theme;
    ['strict', 'sound', 'midiSound', 'mic', 'unlockAll'].forEach((k) => (form.elements[k].checked = s[k]));
    form.elements.mic.disabled = !Mic.supported;
  }

  // each control is named after its setting; only the one that changed is stored
  form.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.name) return;
    S()[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    Store.save(data);
    applySettings();
    fillSettings();
  });

  function applySettings() {
    applyLanguage();
    applyTheme();
    Audio.setEnabled(S().sound);
    syncMic();
    staff.naming = naming();
    Object.keys(hudCache).forEach((k) => delete hudCache[k]);
    if (screen === 'home') renderHome();
    if (screen === 'levels') renderLevels();
    if (screen === 'game' && game) {
      $('#hudLevelName').textContent = gameName();
      buildInput();
      refreshIntro();
      if (game.state === 'paused') showPause();
    }
  }

  function openSettings() {
    if (game && (game.state === 'playing' || game.state === 'countin')) pause();
    fillSettings();
    dlg.showModal();
  }

  $('#settingsBtn').addEventListener('click', openSettings);
  $('#midiConnect').addEventListener('click', connectMidi);
  $('#midiChip').addEventListener('click', () => (Midi.status === 'off' || Midi.status === 'denied' ? connectMidi() : openSettings()));
  $('#micChip').addEventListener('click', () => {
    S().mic = !S().mic;
    Store.save(data);
    syncMic();
  });
  // after a reload the audio clock (and so the microphone) waits for a click or a key press
  ['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, () => Mic.status === 'on' && Audio.ensure(), true));
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm(t('set.resetConfirm'))) return;
    const fresh = Store.defaults();
    data.progress = fresh.progress;
    data.stats = fresh.stats;
    Store.save(data);
    applySettings();
  });

  // ---------- language

  // every language under its own name; "Automatic" names the one it picked
  $('#langSelect').append(
    new Option('', 'auto'),
    ...Object.entries(I18n.LANGS).map(([code, name]) => {
      const o = new Option(name, code);
      o.lang = code;
      return o;
    })
  );

  function applyLanguage() {
    I18n.use(S().lang);
    Music.localize({ solfege: t('music.solfege').split(' '), intervals: t('music.intervals').split('|'), octaves: t('music.octaves') });
    I18n.apply();
    $('meta[name="description"]').content = t('meta.desc');
    $('#solfegeNames').textContent = Music.LETTERS.map((_, i) => Music.letter(i, 'S')).join(' ');
    $('#langSelect').options[0].textContent = t('set.langAuto', { name: I18n.LANGS[I18n.detect()] });
    renderMidi();
    renderMic();
  }

  // ---------- theme

  // the inline script in index.html applies the same rule before first paint
  const lightQuery = matchMedia('(prefers-color-scheme: light)');
  const theme = () => (S().theme === 'auto' ? (lightQuery.matches ? 'light' : 'dark') : S().theme);

  function applyTheme() {
    const label = t(theme() === 'dark' ? 'top.toDay' : 'top.toNight');
    document.documentElement.dataset.theme = theme();
    // the browser bar (and the installed app's title bar) takes the page background
    $('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    $('#themeBtn').setAttribute('aria-label', label);
    $('#themeBtn').title = label;
  }

  lightQuery.addEventListener('change', () => S().theme === 'auto' && applyTheme());
  $('#themeBtn').addEventListener('click', () => {
    S().theme = theme() === 'dark' ? 'light' : 'dark';
    Store.save(data);
    applyTheme();
  });

  // ---------- wiring

  document.querySelectorAll('.instrument-card').forEach((c) => c.addEventListener('click', () => go(c.dataset.instrument)));
  $('#brandBtn').addEventListener('click', () => go(''));
  $('#levelsBack').addEventListener('click', () => go(''));
  $('#gameBack').addEventListener('click', () => go(inst));
  $('#pauseBtn').addEventListener('click', () => (game && game.state === 'paused' ? resume() : pause()));
  $('#startBtn').addEventListener('click', begin);

  new ResizeObserver(() => {
    staff.resize();
    beatView.resize();
  }).observe($('#stage'));
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

  window.addEventListener('popstate', route);

  applyLanguage();
  applyTheme();
  Audio.setEnabled(S().sound);
  if (S().midiEnabled) connectMidi();
  route();
  document.documentElement.classList.remove('booting');

  // offline play and "install as app" (sw.js); needs https or localhost
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
