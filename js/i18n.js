// Translations: picks the language, looks strings up and fills the data-i18n attributes in index.html.
// Each language registers itself from js/lang/<code>.js; a missing string falls back to English.
window.Dots = window.Dots || {};

Dots.I18n = (() => {
  // each language is listed under its own name (no flags: a flag is a country, not a language)
  const LANGS = {
    en: 'English',
    cs: 'Čeština',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    'pt-BR': 'Português (Brasil)',
    zh: '简体中文',
  };
  // the note names people learn with: letters with B, letters with H, or fixed-do solfège
  const NAMING = { en: 'B', cs: 'H', de: 'H', es: 'S', fr: 'S', it: 'S', 'pt-BR': 'S', zh: 'B' };

  const dicts = {};
  const levelNames = {};
  let lang = 'en';
  let plurals = new Intl.PluralRules('en');

  // levels: { course: { 'English level name': ['name', 'description'] } }
  function add(code, strings, levels = {}) {
    dicts[code] = strings;
    levelNames[code] = levels;
  }

  // the first of the browser's languages we have, matched exactly or by base language (pt-PT -> pt-BR, zh-TW -> zh)
  function detect() {
    const codes = Object.keys(LANGS);
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const p of prefs) {
      const want = p.toLowerCase();
      const hit = codes.find((c) => c.toLowerCase() === want) || codes.find((c) => c.split('-')[0] === want.split('-')[0]);
      if (hit) return hit;
    }
    return 'en';
  }

  // code: a key of LANGS, or anything else (e.g. 'auto') to detect
  function use(code) {
    lang = Object.hasOwn(LANGS, code) ? code : detect();
    plurals = new Intl.PluralRules(lang);
    document.documentElement.lang = lang;
    return lang;
  }

  // {name} inserts vars.name. {n, plural, one {# note} other {# notes}} picks the form for vars.n
  // (# = the number, =0 matches exactly); plural branches can't hold other {placeholders}.
  function format(s, vars = {}) {
    return s
      .replace(/\{(\w+), plural,((?:\s*=?\w+\s*\{[^{}]*\})+)\s*\}/g, (m, k, forms) => {
        const n = vars[k];
        const map = {};
        forms.replace(/(=?\w+)\s*\{([^{}]*)\}/g, (_, cat, text) => (map[cat] = text));
        return (map['=' + n] ?? map[plurals.select(n)] ?? map.other ?? '').replace(/#/g, n);
      })
      .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  function t(key, vars) {
    const s = (dicts[lang] && dicts[lang][key]) ?? dicts.en[key] ?? key;
    return format(s, vars);
  }

  // a level's name and description; progress stays keyed by the English name
  function level(course, l) {
    const tr = levelNames[lang] && levelNames[lang][course] && levelNames[lang][course][l.name];
    return { name: tr ? tr[0] : l.name, desc: tr ? tr[1] : l.desc };
  }

  // data-i18n: text, data-i18n-html: markup, data-i18n-label: aria-label
  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((e) => (e.textContent = t(e.dataset.i18n)));
    root.querySelectorAll('[data-i18n-html]').forEach((e) => (e.innerHTML = t(e.dataset.i18nHtml)));
    root.querySelectorAll('[data-i18n-label]').forEach((e) => e.setAttribute('aria-label', t(e.dataset.i18nLabel)));
  }

  return {
    LANGS,
    add,
    detect,
    use,
    t,
    level,
    apply,
    naming: () => NAMING[lang],
    get lang() {
      return lang;
    },
  };
})();
