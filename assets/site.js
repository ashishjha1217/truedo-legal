/* Shared site chrome: theme persistence + toggle, reveal-on-scroll, footer year.
   Used by the marketing + legal pages. The web-app (app.js) reuses setTheme(). */
(function () {
  const KEY = 'truedo.themePref.v2'; // 'system' | 'light' | 'dark' — v2: premium redesign defaults LIGHT
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  function resolved(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    // Redesign is light-first (per the reference design system); an explicit
    // toggle to dark is remembered, but "system" no longer forces dark.
    return 'light';
  }
  function apply(pref) {
    const mode = resolved(pref);
    document.documentElement.setAttribute('data-theme', mode);
    document.querySelectorAll('[data-theme-icon]').forEach((el) => {
      el.textContent = mode === 'dark' ? '☾' : '☀';
    });
  }
  function getPref() {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  }
  window.setThemePref = function (pref) {
    localStorage.setItem(KEY, pref);
    apply(pref);
  };
  window.toggleTheme = function () {
    const cur = resolved(getPref());
    window.setThemePref(cur === 'dark' ? 'light' : 'dark');
  };

  // Apply immediately (before paint where possible).
  apply(getPref());
  mql.addEventListener('change', () => { if (getPref() === 'system') apply('system'); });

  document.addEventListener('DOMContentLoaded', () => {
    // wire any toggle buttons
    document.querySelectorAll('[data-theme-toggle]').forEach((b) =>
      b.addEventListener('click', window.toggleTheme)
    );
    // footer year
    document.querySelectorAll('[data-year]').forEach((e) => (e.textContent = new Date().getFullYear()));

    // reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  });
})();
