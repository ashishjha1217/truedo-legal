// ===========================================================================
// TrueDo web app — UI controller. Imports the InstantDB data layer (instant.js).
// Tabs: Tasks (board/list/focus/calendar + timer + subtasks) | Notes | Vault | Reports
// Monochrome edition — hierarchy via grayscale + weight + motion, never hue.
// `?demo=1` boots with in-memory sample data (no sign-in, nothing written).
// ===========================================================================
import * as T from './instant.js';

const $ = (s, r = document) => r.querySelector(s);
const root = $('#app');

// ---- helpers ---------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2400);
}
function modal(html) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `<div class="modal-card">${html}</div>`;
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
  return { ov, close: () => ov.remove() };
}
function initials(name) {
  const n = (name || '').trim(); if (!n) return '✦';
  const p = n.split(/\s+/); return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

// ---- LOCAL day math ---------------------------------------------------------
// The app stores dueDate as a full ISO stamp (local midnight → UTC ISO), so a
// naive slice(0,10) compares UTC days — wrong for anyone east of Greenwich.
// Everything below goes through the local calendar day instead.
const pad2 = (n) => String(n).padStart(2, '0');
const keyOfDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function dayKeyOf(iso) {
  if (!iso) return null;
  // bare YYYY-MM-DD parses as UTC midnight — pin it to local noon first
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso);
  return isNaN(d) ? String(iso).slice(0, 10) : keyOfDate(d);
}
const todayKey = () => keyOfDate(new Date());
const tomorrowKey = () => keyOfDate(new Date(Date.now() + 86400000));
function dateLabelFor(iso) {
  const k = dayKeyOf(iso);
  if (!k) return 'No date';
  if (k === todayKey()) return 'Today';
  if (k === tomorrowKey()) return 'Tomorrow';
  try { return new Date(k + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
  catch { return k; }
}
// due time (hidden when midnight, same rule as the phone app)
function timeLabelFor(iso) {
  if (!iso || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
const isOverdue = (t) => !t.done && t.dueDate && dayKeyOf(t.dueDate) < todayKey();
const isDueToday = (t) => t.dueDate && dayKeyOf(t.dueDate) === todayKey();
const isUpcoming = (t) => t.dueDate && dayKeyOf(t.dueDate) > todayKey();
// compose an app-compatible ISO from the detail form's date + time inputs
function isoFrom(dateStr, timeStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 0, mm = 0;
  if (timeStr) { const p = timeStr.split(':'); hh = Number(p[0]) || 0; mm = Number(p[1]) || 0; }
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}
function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(ss)}` : `${m}:${pad2(ss)}`;
}

// ---- greeting (mono: no emoji) ----------------------------------------------
const GREET = {
  morning: ['Good morning, {name}', 'Rise and shine, {name}', 'A fresh start, {name}', "Let's make today count, {name}"],
  afternoon: ['Good afternoon, {name}', 'Keep the momentum, {name}', 'Halfway there, {name}', 'Strong afternoon, {name}'],
  evening: ['Good evening, {name}', 'Winding down, {name}?', 'Evening, {name}', "How'd today go, {name}?"],
  night: ['Burning the midnight oil, {name}?', 'Late one, {name}', 'Rest soon, {name}', 'Quiet hours, {name}'],
};
function greeting(name) {
  const d = new Date(); const h = d.getHours();
  const bucket = h < 5 ? GREET.night : h < 12 ? GREET.morning : h < 17 ? GREET.afternoon : h < 21 ? GREET.evening : GREET.night;
  const slot = Math.floor((h * 60 + d.getMinutes()) / 20);
  const tpl = bucket[(slot + d.getDate()) % bucket.length];
  const [pre, post = ''] = tpl.split('{name}');
  return { pre, name: name || 'friend', post };
}
const dateLabel = () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

// ===========================================================================
// Demo mode (?demo=1) — in-memory sample data, no auth, no writes.
// ===========================================================================
const DEMO = new URLSearchParams(location.search).has('demo');
function demoTasks() {
  const iso = (dd, hh = 0, mm = 0) => { const d = new Date(); d.setDate(d.getDate() + dd); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  const past = new Date(Date.now() - 9 * 60000).toISOString();
  return [
    { id: 'd1', title: 'Review quarterly report', cat: 'Work', pri: 'high', mins: 45, dueDate: iso(0, 16, 30), done: false, timeSpent: 22 * 60000, createdAt: iso(-3), subTasks: [{ id: 's1', title: 'Read summary', done: true }, { id: 's2', title: 'Note follow-ups', done: false }] },
    { id: 'd2', title: 'Ship the landing page', cat: 'Work', pri: 'high', mins: 120, dueDate: iso(-1, 18), done: false, timeSpent: 0, createdAt: iso(-4), notes: 'Hero copy still pending from marketing.' },
    { id: 'd3', title: 'Book dentist appointment', cat: 'Personal', pri: 'low', mins: 10, dueDate: iso(0), done: false, createdAt: iso(-1) },
    { id: 'd4', title: 'Deep-work: spec the API', cat: 'Work', pri: 'normal', mins: 90, dueDate: iso(0, 14), done: false, timeSpent: 31 * 60000, timerStartedAt: past, createdAt: iso(-2) },
    { id: 'd5', title: 'Grocery run', cat: 'Personal', mins: 30, dueDate: iso(1, 10), done: false, createdAt: iso(0), subTasks: [{ id: 's3', title: 'Milk', done: false }, { id: 's4', title: 'Eggs', done: false }, { id: 's5', title: 'Coffee', done: true }] },
    { id: 'd6', title: 'Prepare workshop slides', cat: 'Work', pri: 'normal', mins: 60, dueDate: iso(2, 9), done: false, createdAt: iso(-1) },
    { id: 'd7', title: 'Call the bank', cat: 'Errands', mins: 15, dueDate: iso(4), done: false, createdAt: iso(0) },
    { id: 'd8', title: 'Morning run 5k', cat: 'Health', mins: 30, dueDate: iso(0, 7), done: true, completedAt: iso(0, 7, 40), timeSpent: 28 * 60000, createdAt: iso(-1) },
    { id: 'd9', title: 'Send invoices', cat: 'Work', pri: 'high', mins: 20, dueDate: iso(0, 9), done: true, completedAt: iso(0, 9, 30), timeSpent: 12 * 60000, createdAt: iso(-2) },
    { id: 'd10', title: 'Read 20 pages', cat: 'Personal', mins: 25, dueDate: '', done: false, createdAt: iso(0) },
    { id: 'd11', title: 'Fix onboarding bug', cat: 'Work', pri: 'normal', mins: 40, dueDate: iso(-2, 12), done: true, completedAt: iso(-1, 15), timeSpent: 55 * 60000, createdAt: iso(-5) },
  ];
}
const demoHabits = () => [
  { id: 'h1', name: 'Meditate', emoji: '🧘', log: { [todayKey()]: true, [keyOfDate(new Date(Date.now() - 86400000))]: true } },
  { id: 'h2', name: 'No sugar', emoji: '🍎', log: {} },
];
const demoNotes = () => [
  { id: 'n1', title: 'Meeting notes — Q3 plan', bgColor: 'var(--gold)', category: 'Work', updatedAt: Date.now() - 3600e3,
    blocks: [
      { id: 'b1', type: 'title', text: 'Q3 focus', bold: false, italic: false, done: false, color: null },
      { id: 'b2', type: 'bullet', text: 'Ship web dashboard', bold: false, italic: false, done: false, color: null },
      { id: 'b3', type: 'check', text: 'Draft referral loop spec', bold: false, italic: false, done: true, color: null },
      { id: 'b4', type: 'check', text: 'Review pricing page', bold: false, italic: false, done: false, color: null },
    ],
    body: 'Q3 focus\n• Ship web dashboard\n☑ Draft referral loop spec\n☐ Review pricing page' },
  { id: 'n2', title: 'Gift ideas', body: '- Watch strap\n- Film camera', category: 'Personal', updatedAt: Date.now() - 86400e3 },
];

// Write facade: demo mutates local state; live calls the data layer.
const W = {
  addTask(fields) {
    if (!DEMO) return T.addTask(S.user.id, fields);
    const now = new Date().toISOString();
    S.tasks.unshift(normTask({ id: 'dm' + Math.random().toString(36).slice(2), title: fields.title || 'Untitled', cat: fields.category || '', done: fields.stage === 'done', dueDate: fields.dueDate || '', pri: fields.pri || 'normal', mins: fields.mins || 0, createdAt: now, timeSpent: 0, timerStartedAt: fields.stage === 'doing' ? now : null, completedAt: fields.stage === 'done' ? now : null, subTasks: [] }));
    renderApp();
  },
  moveTask(task, stage) {
    if (!DEMO) return T.moveTask(S.user.id, task, stage);
    this.updateTask(task, demoMovePatch(task, stage));
  },
  updateTask(task, updates) {
    if (!DEMO) return T.updateTask(S.user.id, task, updates);
    const i = S.tasks.findIndex((x) => x.id === task.id);
    if (i >= 0) S.tasks[i] = normTask({ ...S.tasks[i], ...updates });
    renderApp();
  },
  del(entity, id) {
    if (!DEMO) return T.softDelete(entity, id);
    if (entity === 'task') S.tasks = S.tasks.filter((t) => t.id !== id);
    if (entity === 'note') S.notes = S.notes.filter((n) => n.id !== id);
    renderApp();
  },
  toggleHabit(habit) {
    if (!DEMO) return T.toggleHabitToday(S.user.id, habit);
    const k = todayKey(); const log = { ...(habit.log || {}) };
    if (log[k]) delete log[k]; else log[k] = true;
    const i = S.habits.findIndex((h) => h.id === habit.id);
    if (i >= 0) S.habits[i] = { ...habit, log };
    renderApp();
  },
};
function demoMovePatch(task, stage) {
  const now = Date.now(); const nowIso = new Date(now).toISOString();
  let timeSpent = Number(task.timeSpent) || 0;
  let timerStartedAt = task.timerStartedAt || null;
  const cur = T.stageOf(task);
  if (cur === 'doing' && stage !== 'doing' && timerStartedAt) { timeSpent += Math.max(0, now - new Date(timerStartedAt).getTime()); timerStartedAt = null; }
  else if (stage === 'doing' && cur !== 'doing') timerStartedAt = nowIso;
  return { done: stage === 'done', timeSpent, timerStartedAt, completedAt: stage === 'done' ? (task.completedAt || nowIso) : null };
}

// ===========================================================================
// State + subscriptions
// ===========================================================================
const savedView = (() => { try { return localStorage.getItem('td.viewMode'); } catch { return null; } })();
let S = {
  user: null, profile: {}, accounts: [], ledger: [], habits: [], tasks: [], notes: [],
  tab: 'tasks', unlocked: {}, taskCategory: null, noteCategory: null,
  viewMode: ['board', 'list', 'focus', 'calendar'].includes(savedView) ? savedView : 'board',
  sort: null,               // null | 'asc' (quick wins) | 'desc' (big first) — by estimate
  statFilter: null,         // null | 'active' | 'upcoming' | 'overdue' | 'done'
  calMonth: null,           // 'YYYY-MM' shown in calendar view
  calSel: null,             // selected 'YYYY-MM-DD'
  showCompleted: false,     // focus view: completed section expanded
  search: '',
};
let subs = [];
let _timerTick = null;
let _animKey = '';          // when this changes, entrance animations replay

// The phone app stores category under `cat` and priority under `pri` — mirror
// them onto the website's names so app-created tasks render here.
const normTask = (t) => ({
  ...t,
  category: t.category ?? t.cat ?? '',
  priority: t.priority ?? (t.pri === 'high' ? 'high' : t.pri === 'low' ? 'low' : 'none'),
});

T.onAuth((user) => {
  if (DEMO) return; // demo boots itself below
  subs.forEach((u) => u && u()); subs = [];
  if (_timerTick) { clearInterval(_timerTick); _timerTick = null; }
  if (!user) { S = { ...S, user: null }; renderAuth(); return; }
  S.user = user;
  const sub = (entity, key, opts) => subs.push(T.subscribe(entity, user.id, (rows, err) => {
    if (err) { console.warn(entity, err); return; }
    S[key] = key === 'tasks' ? rows.map(normTask) : rows;
    renderApp();
  }, opts));
  sub('profile', 'profile', { byId: true });
  sub('account', 'accounts');
  sub('ledgerPerson', 'ledger');
  sub('habit', 'habits');
  sub('task', 'tasks');
  sub('note', 'notes');
  renderApp();
});
function profile() { return Array.isArray(S.profile) ? (S.profile[0] || {}) : (S.profile || {}); }

// ===========================================================================
// AUTH screen
// ===========================================================================
let authStage = 'email', authEmail = '';
function renderAuth() {
  root.innerHTML = `
  <div class="auth-wrap accent-home">
    <div class="aura-bg"><div class="blob-mid"></div></div>
    <div class="glass-strong auth-card reveal in">
      <div class="row gap-sm" style="justify-content:center"><span class="brand-mark" style="width:42px;height:42px;font-size:1.3rem">⚡</span></div>
      <h1 class="h2 mt-2" style="text-align:center">${authStage === 'email' ? 'Sign in to TrueDo' : 'Enter your code'}</h1>
      <p class="muted mt-2" style="text-align:center;font-size:.92rem">${authStage === 'email' ? 'A 6-digit code will be emailed to you.' : `Sent to ${esc(authEmail)}`}</p>
      ${authStage === 'email' ? `
        <input class="field" id="email" type="email" placeholder="you@email.com" autocomplete="email" />
        <button class="btn btn-primary btn-block btn-lg mt-2" id="send">Send code</button>
        <div class="divider">or continue with</div>
        <button class="oauth-btn" id="google"> Google</button>
        <button class="oauth-btn" id="apple"> Apple</button>
      ` : `
        <input class="field mono" id="code" inputmode="numeric" placeholder="123456" style="text-align:center;letter-spacing:.3em;font-size:1.3rem" />
        <button class="btn btn-primary btn-block btn-lg mt-2" id="verify">Verify & sign in</button>
        <button class="btn btn-ghost btn-block mt-2" id="back">← Use a different email</button>
      `}
      <p class="faint mt-3" style="text-align:center;font-size:.78rem">By continuing you agree to our <a href="terms.html" style="color:var(--limeInk)">Terms</a> &amp; <a href="privacy.html" style="color:var(--limeInk)">Privacy Policy</a>.</p>
    </div>
  </div>`;

  if (authStage === 'email') {
    const go = async () => {
      const e = $('#email').value.trim(); if (!e) return toast('Enter your email');
      $('#send').textContent = 'Sending…';
      try { await T.sendCode(e); authEmail = e; authStage = 'code'; renderAuth(); }
      catch (err) { toast(err.message || 'Could not send code'); $('#send').textContent = 'Send code'; }
    };
    $('#send').onclick = go;
    $('#email').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    const oauth = (p) => { try { T.oauthRedirect(p); } catch (err) { toast(err.message); } };
    $('#google').onclick = () => oauth('google');
    $('#apple').onclick = () => oauth('apple');
  } else {
    const go = async () => {
      const c = $('#code').value.trim(); if (!c) return toast('Enter the code');
      $('#verify').textContent = 'Signing in…';
      try { await T.verifyCode(authEmail, c); }
      catch (err) { toast(err.message || 'Wrong code'); $('#verify').textContent = 'Verify & sign in'; }
    };
    $('#verify').onclick = go;
    $('#code').onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#back').onclick = () => { authStage = 'email'; renderAuth(); };
    $('#code').focus();
  }
}

// ===========================================================================
// APP shell
// ===========================================================================
function tabContentHtml() {
  return `${S.tab === 'tasks' ? renderTasks() : ''}
    ${S.tab === 'notes' ? renderNotes() : ''}
    ${S.tab === 'vault' ? renderVault() : ''}
    ${S.tab === 'reports' ? renderReports() : ''}`;
}
function wireTab() {
  if (S.tab === 'tasks') wireTasks();
  if (S.tab === 'notes') wireNotes();
  if (S.tab === 'vault') wireVault();
  startTimerTick();
}
// Re-render ONLY the tab body (search typing, checkbox ticks…) so the header —
// and crucially the focused search input — survives.
function renderTab({ animate = false } = {}) {
  const el = $('.tab-content'); if (!el) return renderApp();
  el.classList.toggle('anim-in', animate);
  el.innerHTML = tabContentHtml();
  wireTab();
}

function renderApp() {
  if (!S.user) return renderAuth();
  const p = profile();
  // "u1:…" values are encrypted user details (only the app holds the key) —
  // treat them as absent here rather than rendering ciphertext.
  const priv = (v) => (typeof v === 'string' && v.startsWith('u1:') ? null : v);
  const name = priv(p.name) || (S.user.email || '').split('@')[0] || 'friend';
  const cur = p.currency || 'USD';
  const g = greeting(name);
  const nw = T.netWorth(S.accounts, S.ledger);
  const av = priv(p.avatarUri)
    ? `<img class="dash-avatar" src="${esc(priv(p.avatarUri))}" alt="" />`
    : `<div class="dash-avatar">${esc(initials(name))}</div>`;

  const TABS = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'notes', label: 'Notes' },
    { key: 'vault', label: 'Vault' },
    { key: 'reports', label: 'Reports' },
  ];

  const doneTasks = S.tasks.filter((t) => t.done);
  const totalHoursMs = S.tasks.reduce((s, t) => {
    const committed = Number(t.timeSpent) || 0;
    const live = t.timerStartedAt ? Math.max(0, Date.now() - new Date(t.timerStartedAt).getTime()) : 0;
    let tracked = committed + live;
    if (tracked <= 0 && t.done && t.mins > 0) tracked = t.mins * 60000;
    return s + tracked;
  }, 0);
  const totalHoursStr = T.fmtDuration(totalHoursMs) || '0m';
  const todayDue = S.tasks.filter((t) => isDueToday(t) && !t.done).length;

  const animKey = `${S.tab}|${S.viewMode}`;
  const animate = animKey !== _animKey;
  _animKey = animKey;

  root.innerHTML = `
  <div class="aura-bg"><div class="blob-mid"></div></div>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="row between" style="padding:2px 4px 6px">
        <a class="brand" href="index.html" style="font-size:1rem"><span class="brand-mark" style="width:26px;height:26px">⚡</span> TrueDo</a>
        <button class="theme-toggle" data-theme-toggle title="Theme"><span data-theme-icon>☾</span></button>
      </div>
      <a href="finance.html" class="glass widget sidebar-finance-link" style="text-decoration:none;display:block">
        <div class="row between" style="align-items:flex-start">
          <div class="widget-title">Net worth</div>
          <span class="faint" style="font-size:.72rem;margin-top:1px">Open →</span>
        </div>
        <div class="networth-val">${esc(T.fmtMoney(nw, cur))}</div>
        <div class="faint" style="font-size:.78rem;margin-top:4px">${S.accounts.length} account${S.accounts.length === 1 ? '' : 's'} · tap for details</div>
      </a>
      <div class="glass widget" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 16px">
        <div class="stat-cell"><div class="stat-val">${doneTasks.length}</div><div class="stat-label">Completed</div></div>
        <div class="stat-cell"><div class="stat-val" style="font-size:1.1rem">${totalHoursStr}</div><div class="stat-label">Time tracked</div></div>
        <div class="stat-cell"><div class="stat-val">${todayDue}</div><div class="stat-label">Due today</div></div>
        <div class="stat-cell"><div class="stat-val">${S.tasks.length}</div><div class="stat-label">Total tasks</div></div>
      </div>
      <div class="glass widget" style="flex:1;min-height:0;overflow:auto">
        <div class="widget-title">Habits · this month</div>
        ${renderHabits()}
      </div>
      <button class="btn btn-ghost" id="signout">${DEMO ? 'Exit demo' : 'Sign out'}</button>
    </aside>

    <main class="main">
      <header class="dash-head">
        <div class="avatar-wrap" id="open-profile" style="cursor:pointer" title="Profile settings">${av}</div>
        <div>
          <div class="dash-date">${esc(dateLabel())}</div>
          <div class="dash-greet">${esc(g.pre)}<span style="text-decoration:underline;text-underline-offset:4px">${esc(g.name)}</span>${esc(g.post)}</div>
        </div>
        <div class="search-wrap" style="margin-left:auto">
          <input class="search-bar" id="global-search" placeholder="Search…" value="${esc(S.search)}" autocomplete="off" />
        </div>
        <button class="theme-toggle mobile-theme-toggle" data-theme-toggle title="Theme"><span data-theme-icon>☾</span></button>
      </header>

      <div class="seg" role="tablist">
        ${TABS.map((t) => `<button data-tab="${t.key}" class="${S.tab === t.key ? 'on' : ''}">${t.label}</button>`).join('')}
      </div>

      <div class="tab-content mt-3 ${animate ? 'anim-in' : ''}">${tabContentHtml()}</div>
    </main>
  </div>
  <button class="fab" id="fab-add" title="Quick add (T)">+</button>
  ${DEMO ? '<div class="demo-banner">demo mode — nothing is saved</div>' : ''}`;

  $('#signout').onclick = async () => {
    if (DEMO) { location.href = 'app.html'; return; }
    await T.signOut(); toast('Signed out');
  };
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => (b.onclick = window.toggleTheme));
  const mode = document.documentElement.getAttribute('data-theme');
  document.querySelectorAll('[data-theme-icon]').forEach((el) => (el.textContent = mode === 'dark' ? '☾' : '☀'));
  document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; S.search = ''; window.scrollTo({ top: 0 }); renderApp(); }));
  if (S.taskCategory && !S.tasks.some((t) => t.category === S.taskCategory)) S.taskCategory = null;
  wireTab();
  wireHabits();
  wireShared();
}

function wireShared() {
  const si = $('#global-search');
  if (si) {
    si.oninput = () => { S.search = si.value; renderTab(); };  // body-only → keeps focus
    si.onkeydown = (e) => { if (e.key === 'Escape') { S.search = ''; si.value = ''; renderTab(); } };
  }
  const pa = $('#open-profile');
  if (pa) pa.onclick = openProfileModal;
  const fab = $('#fab-add');
  if (fab) fab.onclick = () => {
    if (S.tab === 'notes') openNoteEdit(null);
    else if (S.tab === 'vault') document.getElementById('add-secure')?.click();
    else openQuickAdd();
  };
  document.onkeydown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key === '?') { showKbHelp(); return; }
    if (e.key === '/') { e.preventDefault(); $('#global-search')?.focus(); return; }
    if (e.key === '1') { S.tab = 'tasks'; renderApp(); return; }
    if (e.key === '2') { S.tab = 'notes'; renderApp(); return; }
    if (e.key === '3') { S.tab = 'vault'; renderApp(); return; }
    if (e.key === '4') { S.tab = 'reports'; renderApp(); return; }
    if (e.key === 'v' || e.key === 'V') {
      if (S.tab !== 'tasks') return;
      const modes = ['board', 'list', 'focus', 'calendar'];
      setViewMode(modes[(modes.indexOf(S.viewMode) + 1) % modes.length]);
      return;
    }
    if (e.key === 'n' || e.key === 'N') { if (S.tab === 'notes') openNoteEdit(null); else openQuickAdd(); return; }
    if (e.key === 't' || e.key === 'T') { openQuickAdd(); return; }
  };
}
function setViewMode(mode) {
  S.viewMode = mode;
  try { localStorage.setItem('td.viewMode', mode); } catch {}
  window.scrollTo({ top: 0 });
  renderApp();
}

function openQuickAdd(presetDate) {
  const m = modal(`
    <div class="row between" style="margin-bottom:14px">
      <h2 class="h3">Quick add task</h2>
      <button class="icon-btn" id="qa-close">✕</button>
    </div>
    <input class="field" id="qa-title" placeholder="Task title…" autofocus />
    <div class="row gap-sm" style="margin-top:8px">
      <input class="field" id="qa-cat" placeholder="Category" style="flex:1.2" />
      <input class="field" id="qa-due" type="date" style="flex:1" value="${esc(presetDate || '')}" />
      <input class="field" id="qa-time" type="time" style="flex:.8" />
    </div>
    <div class="row gap-sm" style="margin-top:8px">
      <input class="field" id="qa-mins" type="number" min="0" placeholder="Estimate (min)" style="flex:1" />
      <select class="field" id="qa-pri" style="flex:1">
        <option value="none">No priority</option><option value="low">Low</option><option value="high">High</option>
      </select>
    </div>
    <div class="row gap-sm mt-2">
      <button class="btn btn-ghost stage-btn on" data-qstage="todo" style="flex:1">To do</button>
      <button class="btn btn-ghost stage-btn" data-qstage="doing" style="flex:1">In progress</button>
      <button class="btn btn-ghost stage-btn" data-qstage="done" style="flex:1">Done</button>
    </div>
    <button class="btn btn-primary btn-block mt-2" id="qa-save">Add task</button>`);
  let qStage = 'todo';
  m.ov.querySelectorAll('[data-qstage]').forEach((b) => {
    b.onclick = () => { qStage = b.dataset.qstage; m.ov.querySelectorAll('[data-qstage]').forEach((x) => x.classList.toggle('on', x === b)); };
  });
  $('#qa-close', m.ov).onclick = m.close;
  const save = async () => {
    const title = $('#qa-title', m.ov).value.trim(); if (!title) return toast('Enter a title');
    const pri = $('#qa-pri', m.ov).value;
    await W.addTask({
      title,
      category: $('#qa-cat', m.ov).value.trim(),
      dueDate: isoFrom($('#qa-due', m.ov).value, $('#qa-time', m.ov).value),
      mins: Number($('#qa-mins', m.ov).value) || 0,
      pri: pri === 'high' ? 'high' : pri === 'low' ? 'low' : 'normal',
      stage: qStage,
    });
    m.close(); toast('Task added');
  };
  $('#qa-save', m.ov).onclick = save;
  $('#qa-title', m.ov).onkeydown = (e) => { if (e.key === 'Enter') save(); };
  setTimeout(() => $('#qa-title', m.ov)?.focus(), 50);
}

function openProfileModal() {
  const p = profile();
  const m = modal(`
    <div class="row between" style="margin-bottom:16px">
      <h2 class="h3">Profile settings</h2>
      <button class="icon-btn" id="pr-close">✕</button>
    </div>
    <label class="field-label">Display name</label>
    <input class="field" id="pr-name" value="${esc(typeof p.name === 'string' && p.name.startsWith('u1:') ? '' : (p.name || ''))}" placeholder="Your name" />
    <label class="field-label">Currency</label>
    <select class="field" id="pr-cur">
      ${['USD','EUR','GBP','INR','JPY','AUD','CAD','SGD'].map((c) => `<option value="${c}" ${(p.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}
    </select>
    <div class="row gap-sm mt-3">
      <button class="btn btn-primary" id="pr-save" style="flex:1">Save</button>
    </div>`);
  $('#pr-close', m.ov).onclick = m.close;
  $('#pr-save', m.ov).onclick = async () => {
    const name = $('#pr-name', m.ov).value.trim();
    const currency = $('#pr-cur', m.ov).value;
    const keepEnc = !name && typeof profile().name === 'string' && profile().name.startsWith('u1:');
    if (!DEMO) await T.upsert('profile', { ...profile(), name: keepEnc ? profile().name : name, currency }, S.user.id);
    m.close(); toast('Profile updated');
  };
}

function showKbHelp() {
  modal(`
    <div class="row between" style="margin-bottom:14px">
      <h2 class="h3">Keyboard shortcuts</h2>
      <button class="icon-btn" id="kb-close">✕</button>
    </div>
    <div class="kb-grid">
      <kbd>/</kbd><span>Focus search</span>
      <kbd>1–4</kbd><span>Switch tabs</span>
      <kbd>V</kbd><span>Cycle task views (board · list · focus · calendar)</span>
      <kbd>T</kbd><span>New task</span>
      <kbd>N</kbd><span>New note / task</span>
      <kbd>?</kbd><span>This help</span>
      <kbd>Esc</kbd><span>Close / clear search</span>
    </div>`);
  document.getElementById('kb-close').onclick = () => document.querySelector('.modal-overlay')?.remove();
}

// ---- Habits (sidebar) -------------------------------------------------------
function renderHabits() {
  if (!S.habits.length) return `<div class="faint" style="font-size:.85rem;padding:6px 0">No habits yet — add them on your phone.</div>`;
  return S.habits.map((h) => {
    const { pct, done, days } = T.habitMonthPct(h.log);
    const on = !!(h.log && h.log[T.todayKey()]);
    return `<div class="habit-row" data-habit="${esc(h.id)}">
      <div class="habit-check ${on ? 'on' : ''}">${on ? '✓' : ''}</div>
      <div style="min-width:0">
        <div style="font-size:.9rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="emoji">${esc(h.emoji || '◦')}</span> ${esc(h.name || 'Habit')}</div>
        <div class="faint" style="font-size:.72rem">${done}/${days} days · ${pct}%</div>
      </div>
      <div class="streak">${pct}%</div>
    </div>`;
  }).join('');
}
function wireHabits() {
  document.querySelectorAll('[data-habit]').forEach((row) => {
    row.querySelector('.habit-check').onclick = () => {
      const h = S.habits.find((x) => x.id === row.dataset.habit); if (h) W.toggleHabit(h);
    };
  });
}

// ===========================================================================
// TASKS — hero + 4 views (board / list / focus / calendar)
// ===========================================================================
const COLS = [
  { key: 'todo', label: 'To do', dotCls: '' },
  { key: 'doing', label: 'In progress', dotCls: 'doing' },
  { key: 'done', label: 'Done', dotCls: 'done' },
];
const PRIORITY_LABEL = { high: 'High', medium: 'Med', low: 'Low' };

function timerParts(task) {
  const accum = Number(task.timeSpent) || 0;
  const startMs = task.timerStartedAt ? new Date(task.timerStartedAt).getTime() : null;
  const total = startMs ? accum + (Date.now() - startMs) : accum;
  return { accum, startMs, total };
}
function renderTimerBadge(task) {
  const { accum, startMs, total } = timerParts(task);
  const str = T.fmtDuration(total);
  if (!str && !startMs) return '';
  const timerAttrs = startMs ? `data-timer-start="${startMs}" data-timer-accum="${accum}"` : '';
  return `<span class="timer-badge ${startMs ? 'running' : ''}" ${timerAttrs}>${str || '0s'}</span>`;
}
function subMeta(t) {
  const subs = Array.isArray(t.subTasks) ? t.subTasks : [];
  if (!subs.length) return '';
  const done = subs.filter((s) => s.done).length;
  const pct = Math.round((done / subs.length) * 100);
  return `<span class="sub-chip">${done}/${subs.length}<span class="sub-bar"><span class="sub-fill" style="width:${pct}%"></span></span></span>`;
}
function dueChip(t) {
  if (!t.dueDate) return '';
  const time = timeLabelFor(t.dueDate);
  return `<span class="due-chip ${isOverdue(t) ? 'overdue' : ''}">${esc(dateLabelFor(t.dueDate))}${time ? ' · ' + esc(time) : ''}</span>`;
}
const estChip = (t) => (t.mins > 0 ? `<span class="est-chip">~${t.mins}m</span>` : '');
const prioDot = (t) => (t.priority && t.priority !== 'none'
  ? `<span class="prio-dot p-${esc(t.priority)}" title="${PRIORITY_LABEL[t.priority] || ''} priority"></span>` : '');

function visibleTasks() {
  const sq = S.search.toLowerCase();
  let v = S.taskCategory ? S.tasks.filter((t) => t.category === S.taskCategory) : [...S.tasks];
  if (S.statFilter === 'active') v = v.filter((t) => !t.done);
  if (S.statFilter === 'upcoming') v = v.filter((t) => !t.done && isUpcoming(t));
  if (S.statFilter === 'overdue') v = v.filter(isOverdue);
  if (S.statFilter === 'done') v = v.filter((t) => t.done);
  if (sq) v = v.filter((t) => (t.title || '').toLowerCase().includes(sq) || (t.category || '').toLowerCase().includes(sq) || (t.notes || '').toLowerCase().includes(sq));
  return v;
}
function sortTasks(arr) {
  const base = [...arr].sort((a, b) => {
    const da = a.dueDate ? dayKeyOf(a.dueDate) : '9999', db2 = b.dueDate ? dayKeyOf(b.dueDate) : '9999';
    if (da !== db2) return da.localeCompare(db2);
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
  if (!S.sort) return base;
  return base.sort((a, b) => S.sort === 'asc' ? (a.mins || 0) - (b.mins || 0) : (b.mins || 0) - (a.mins || 0));
}

// hero % — same rule as the phone app: today's completions over "to do now"
// (overdue + due today + undated active); upcoming excluded → clearing the
// day's plate reads 100%.
function heroNumbers() {
  const doneToday = S.tasks.filter((t) => t.done && dayKeyOf(t.completedAt || t.dueDate) === todayKey()).length;
  const toDoNow = S.tasks.filter((t) => !t.done && !isUpcoming(t)).length;
  const pct = (doneToday + toDoNow) ? Math.round((doneToday / (doneToday + toDoNow)) * 100) : 0;
  const active = S.tasks.filter((t) => !t.done).length;
  const upcoming = S.tasks.filter((t) => !t.done && isUpcoming(t)).length;
  const overdue = S.tasks.filter(isOverdue).length;
  const done = S.tasks.filter((t) => t.done).length;
  return { pct, active, upcoming, overdue, done, doneToday, toDoNow };
}
function heroCopy(h) {
  if (h.overdue > 0) return { title: `${h.overdue} need${h.overdue === 1 ? 's' : ''} attention`, sub: 'A little catch-up and you’re golden.' };
  if (h.toDoNow === 0) return { title: 'All caught up', sub: 'Everything you planned is done. Lovely.' };
  if (h.pct >= 50) return { title: 'Great momentum', sub: `Just ${h.toDoNow} to go — keep it up.` };
  return { title: 'Let’s make today count', sub: `${h.toDoNow} task${h.toDoNow === 1 ? '' : 's'} on your plate.` };
}

function renderHero() {
  const h = heroNumbers();
  const c = heroCopy(h);
  const R = 40, CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - h.pct / 100);
  const stat = (key, val, label, warn = '') => `
    <button class="tstat ${S.statFilter === key ? 'on' : ''} ${warn}" data-stat="${key}">
      <span class="tstat-val">${val}</span><span class="tstat-label">${label}</span>
    </button>`;
  return `
  <div class="glass thero stag" style="--i:0">
    <div class="thero-ring">
      <svg width="92" height="92" viewBox="0 0 92 92">
        <circle class="ring-track" cx="46" cy="46" r="${R}" stroke-width="8" fill="none"/>
        <circle class="ring-arc" cx="46" cy="46" r="${R}" stroke-width="8" fill="none"
          stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}" data-ring-offset="${offset}"/>
      </svg>
      <div class="ring-center"><div><div class="ring-pct">${h.pct}%</div><div class="ring-sub">today</div></div></div>
    </div>
    <div class="thero-copy">
      <div class="thero-title">${esc(c.title)}</div>
      <div class="thero-sub">${esc(c.sub)}</div>
    </div>
    <div class="thero-stats">
      ${stat('active', h.active, 'Active')}
      ${stat('upcoming', h.upcoming, 'Upcoming')}
      ${stat('overdue', h.overdue, 'Overdue', h.overdue ? 'warn' : '')}
      ${stat('done', h.done, 'Done')}
    </div>
  </div>`;
}

function renderTasksToolbar(cats) {
  const modes = [['board', 'Board'], ['list', 'List'], ['focus', 'Focus'], ['calendar', 'Calendar']];
  const sortLabel = S.sort === 'asc' ? 'Quick wins' : S.sort === 'desc' ? 'Big first' : 'Sort';
  return `
  <div class="ttools stag" style="--i:1">
    <div class="vswitch">${modes.map(([k, l]) => `<button data-vmode="${k}" class="${S.viewMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="kfpill sort-pill ${S.sort ? 'on' : ''}" id="sort-toggle" title="Sort by estimate">${sortLabel}</button>
    <span style="flex:1"></span>
  </div>
  <div class="kfilter-bar stag" style="--i:2">
    <button class="kfpill ${!S.taskCategory ? 'on' : ''}" data-kcat="">All <span class="kfcount">${S.tasks.length}</span></button>
    ${cats.map((c) => {
      const n = S.tasks.filter((t) => t.category === c).length;
      return `<button class="kfpill ${S.taskCategory === c ? 'on' : ''}" data-kcat="${esc(c)}">${esc(c)} <span class="kfcount">${n}</span></button>`;
    }).join('')}
  </div>`;
}

function renderTasks() {
  const cats = [...new Set(S.tasks.map((t) => t.category).filter(Boolean))].sort();
  const body =
    S.viewMode === 'board' ? renderBoard() :
    S.viewMode === 'list' ? renderList() :
    S.viewMode === 'focus' ? renderFocus() : renderCalendar();
  return `<div>${renderHero()}${renderTasksToolbar(cats)}${body}</div>`;
}

// ---- board ------------------------------------------------------------------
function groupTasksByDate(tasks) {
  const groups = new Map(); const noDate = [];
  tasks.forEach((t) => {
    const d = t.dueDate ? dayKeyOf(t.dueDate) : null;
    if (!d) { noDate.push(t); return; }
    if (!groups.has(d)) groups.set(d, { label: dateLabelFor(t.dueDate), tasks: [] });
    groups.get(d).tasks.push(t);
  });
  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (noDate.length) sorted.push(['no-date', { label: 'No date', tasks: noDate }]);
  return sorted;
}
function isCompletedToday(t) {
  if (!t.done) return false;
  const when = t.completedAt || t.dueDate;
  return !!when && dayKeyOf(when) === todayKey();
}
function kcardHtml(t, colKey) {
  return `
  <div class="kcard ${isOverdue(t) ? 'overdue' : ''}" draggable="true" data-id="${esc(t.id)}">
    <div class="ktitle">${esc(t.title || 'Untitled')}</div>
    <div class="kmeta">
      ${t.category && !S.taskCategory ? `<span class="chip" style="padding:2px 8px;font-size:.72rem">${esc(t.category)}</span>` : ''}
      ${prioDot(t)}
      ${dueChip(t)}
      ${estChip(t)}
      ${subMeta(t)}
      ${colKey === 'doing' || (colKey === 'done' && (t.timeSpent || t.timerStartedAt)) ? renderTimerBadge(t) : ''}
      <button class="kdel" title="Delete">✕</button>
    </div>
  </div>`;
}
function renderBoard() {
  const visible = visibleTasks();
  const byStage = { todo: [], doing: [], done: [] };
  visible.forEach((t) => byStage[T.stageOf(t)].push(t));
  Object.keys(byStage).forEach((k) => (byStage[k] = sortTasks(byStage[k])));

  return `<div class="kanban">${COLS.map((c, ci) => {
    let colTasks = byStage[c.key];
    let viewAllBtn = '';
    if (c.key === 'done') {
      colTasks = colTasks.filter(isCompletedToday);
      if (byStage.done.length > 0) viewAllBtn = `<button class="k-viewall" id="done-viewall">View all completed (${byStage.done.length})</button>`;
    }
    const groups = groupTasksByDate(colTasks);
    const cards = groups.length === 0
      ? `<div class="k-empty">${c.key === 'done' ? 'Nothing finished today yet' : S.taskCategory ? `No "${esc(S.taskCategory)}" tasks here` : 'Drop tasks here'}</div>`
      : groups.map(([, g]) => `<div class="kdate-sep">${esc(g.label)}</div>${g.tasks.map((t) => kcardHtml(t, c.key)).join('')}`).join('');
    const headCount = c.key === 'done' ? colTasks.length : byStage[c.key].length;
    return `
    <div class="glass kcol stag" style="--i:${3 + ci}" data-stage="${c.key}">
      <div class="kcol-head"><span class="sdot ${c.dotCls}"></span> ${c.label} <span class="kcount">${headCount}</span></div>
      ${cards}
      ${viewAllBtn}
      <div class="add-task"><input placeholder="Add task…" data-add="${c.key}" /></div>
    </div>`;
  }).join('')}</div>`;
}

// ---- list ---------------------------------------------------------------------
function listRowHtml(t, i) {
  const stage = T.stageOf(t);
  const { accum, startMs, total: totalMs } = timerParts(t);
  const timerStr = T.fmtDuration(totalMs);
  return `<div class="list-row ${isOverdue(t) ? 'overdue' : ''}" data-id="${esc(t.id)}" ${i != null ? `style="--i:${i}"` : ''}>
    <button class="fcheck ${stage === 'done' ? 'on' : ''}" data-toggle="${esc(t.id)}" title="${stage === 'done' ? 'Mark not done' : 'Mark done'}">✓</button>
    <span class="sdot ${stage === 'doing' ? 'doing' : stage === 'done' ? 'done' : ''}"></span>
    <div class="list-title ${stage === 'done' ? 'list-done' : ''}">${esc(t.title || 'Untitled')}</div>
    ${t.category ? `<span class="chip" style="padding:2px 8px;font-size:.72rem">${esc(t.category)}</span>` : ''}
    ${subMeta(t)}
    ${dueChip(t)}
    ${estChip(t)}
    ${prioDot(t)}
    ${timerStr ? `<span class="timer-badge ${startMs ? 'running' : ''}" ${startMs ? `data-timer-start="${startMs}" data-timer-accum="${accum}"` : ''}>${timerStr}</span>` : ''}
    <button class="kdel list-del" title="Delete">✕</button>
  </div>`;
}
function renderList() {
  const allSorted = sortTasks(visibleTasks());
  const listHtml = allSorted.length
    ? allSorted.map((t) => listRowHtml(t)).join('')
    : `<div class="faint" style="padding:32px;text-align:center">No tasks found.</div>`;
  return `<div class="glass list-view stag" style="--i:3">${listHtml}</div>`;
}

// ---- focus (Today-first sections, like the phone's focus mode) ----------------
function renderFocus() {
  const v = visibleTasks().filter((t) => !t.done);
  const secs = [
    { key: 'overdue', label: 'Overdue', cls: 'overdue-head', tasks: sortTasks(v.filter(isOverdue)) },
    { key: 'today', label: 'Today', tasks: sortTasks(v.filter((t) => isDueToday(t))) },
    { key: 'upcoming', label: 'Upcoming', tasks: sortTasks(v.filter(isUpcoming)) },
    { key: 'nodate', label: 'No date', tasks: sortTasks(v.filter((t) => !t.dueDate)) },
  ].filter((s) => s.tasks.length);
  const completed = sortTasks(visibleTasks().filter((t) => t.done))
    .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));

  const secHtml = secs.length ? secs.map((s, i) => `
    <div class="glass focus-sec stag" style="--i:${4 + i}">
      <div class="focus-sec-head ${s.cls || ''}">${esc(s.label)} <span class="fs-count">${s.tasks.length}</span></div>
      ${s.tasks.map((t) => `
        <div class="frow" data-id="${esc(t.id)}">
          <button class="fcheck" data-toggle="${esc(t.id)}" title="Mark done">✓</button>
          <div class="ftitle">${esc(t.title || 'Untitled')}</div>
          ${t.category ? `<span class="chip" style="padding:2px 8px;font-size:.7rem">${esc(t.category)}</span>` : ''}
          ${subMeta(t)}
          ${dueChip(t)}
          ${estChip(t)}
          ${prioDot(t)}
        </div>`).join('')}
    </div>`).join('')
    : `<div class="glass focus-sec stag" style="--i:4"><div class="k-empty" style="padding:28px">Nothing on your plate — add a task below or enjoy the calm.</div></div>`;

  const compHtml = completed.length ? `
    <div class="glass focus-sec stag" style="--i:${4 + secs.length}">
      <div class="focus-sec-head clickable ${S.showCompleted ? 'open' : ''}" id="fs-completed">
        <span class="fs-chev">›</span> Completed <span class="fs-count">${completed.length}</span>
      </div>
      ${S.showCompleted ? completed.slice(0, 30).map((t) => `
        <div class="frow" data-id="${esc(t.id)}">
          <button class="fcheck on" data-toggle="${esc(t.id)}" title="Mark not done">✓</button>
          <div class="ftitle done">${esc(t.title || 'Untitled')}</div>
          ${t.completedAt ? `<span class="due-chip">${esc(dateLabelFor(t.completedAt))}</span>` : ''}
        </div>`).join('') : ''}
    </div>` : '';

  return `
  <div class="focus-wrap">
    <div class="focus-quick stag" style="--i:3"><input id="focus-add" placeholder="Add a task for today — press Enter" /></div>
    ${secHtml}
    ${compHtml}
  </div>`;
}

// ---- calendar --------------------------------------------------------------------
function calMonthKey() {
  if (S.calMonth) return S.calMonth;
  const n = new Date(); return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}`;
}
function renderCalendar() {
  const [y, m] = calMonthKey().split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const startDow = first.getDay(); // 0=Sun grid like the phone
  const daysIn = new Date(y, m, 0).getDate();
  const daysPrev = new Date(y, m - 1, 0).getDate();

  const byDay = new Map();
  S.tasks.forEach((t) => {
    if (!t.dueDate) return;
    const k = dayKeyOf(t.dueDate);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(t);
  });

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startDow + 1;
    let cy = y, cm = m, cd = dayNum, dim = false;
    if (dayNum < 1) { dim = true; cm = m - 1; cd = daysPrev + dayNum; if (cm < 1) { cm = 12; cy--; } }
    else if (dayNum > daysIn) { dim = true; cm = m + 1; cd = dayNum - daysIn; if (cm > 12) { cm = 1; cy++; } }
    const k = `${cy}-${pad2(cm)}-${pad2(cd)}`;
    const open = (byDay.get(k) || []).filter((t) => !t.done).length;
    const dots = Math.min(3, open);
    const sizePx = open > 4 ? 5 : 4;
    cells.push(`
      <button class="cal-cell ${dim ? 'dim' : ''} ${k === todayKey() ? 'today' : ''} ${S.calSel === k ? 'sel' : ''}" data-day="${k}">
        <span>${cd}</span>
        <span class="cal-load">${dots ? Array.from({ length: dots }, () => `<i style="width:${sizePx}px;height:${sizePx}px"></i>`).join('') : `<i style="width:4px;height:4px;opacity:0"></i>`}</span>
      </button>`);
  }

  const sel = S.calSel;
  const selTasks = sel ? sortTasks((byDay.get(sel) || [])) : [];
  const panel = sel ? `
    <div class="glass cal-panel">
      <div class="cal-panel-head">${esc(dateLabelFor(sel))} <span class="kcount" style="margin-left:8px">${selTasks.length} task${selTasks.length === 1 ? '' : 's'}</span></div>
      ${selTasks.length ? selTasks.map((t) => `
        <div class="frow" data-id="${esc(t.id)}">
          <button class="fcheck ${t.done ? 'on' : ''}" data-toggle="${esc(t.id)}">✓</button>
          <div class="ftitle ${t.done ? 'done' : ''}">${esc(t.title || 'Untitled')}</div>
          ${t.category ? `<span class="chip" style="padding:2px 8px;font-size:.7rem">${esc(t.category)}</span>` : ''}
          ${timeLabelFor(t.dueDate) ? `<span class="due-chip">${esc(timeLabelFor(t.dueDate))}</span>` : ''}
          ${estChip(t)}
        </div>`).join('') : ''}
      <button class="cal-add" id="cal-add">＋ Add task on this day</button>
    </div>` : '';

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `
  <div class="cal-wrap">
    <div class="cal-head stag" style="--i:3">
      <div class="cal-title">${esc(label)}</div>
      <button class="cal-nav" data-calnav="-1">‹</button>
      <button class="cal-nav" data-calnav="1">›</button>
      <button class="kfpill" id="cal-today" style="margin-left:4px">Today</button>
    </div>
    <div class="glass cal-grid stag" style="--i:4">
      ${DOW.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    ${panel}
  </div>`;
}

// ---- completed archive modal -----------------------------------------------------
function openCompletedAll() {
  const done = S.tasks.filter((t) => t.done)
    .sort((a, b) => String(b.completedAt || b.dueDate || '').localeCompare(String(a.completedAt || a.dueDate || '')));
  const rows = done.length ? done.map((t) => {
    const when = t.completedAt || t.dueDate;
    const { total } = timerParts(t);
    const timeStr = T.fmtDuration(total) || (t.mins ? `${t.mins}m est` : '');
    return `<div class="list-row" data-id="${esc(t.id)}">
      <span class="sdot done"></span>
      <div class="list-title list-done">${esc(t.title || 'Untitled')}</div>
      ${t.category ? `<span class="chip" style="padding:2px 8px;font-size:.72rem">${esc(t.category)}</span>` : ''}
      ${when ? `<span class="due-chip">${esc(dateLabelFor(when))}</span>` : ''}
      ${timeStr ? `<span class="timer-badge">${timeStr}</span>` : ''}
    </div>`;
  }).join('') : `<div class="faint" style="padding:32px;text-align:center">No completed tasks yet.</div>`;
  const m = modal(`
    <div class="row between" style="margin-bottom:12px">
      <h2 class="h3">Completed tasks <span class="faint" style="font-size:.9rem">(${done.length})</span></h2>
      <button class="icon-btn" id="ca-close">✕</button>
    </div>
    <div class="glass list-view" style="max-height:60vh;overflow-y:auto">${rows}</div>`);
  $('#ca-close', m.ov).onclick = m.close;
  m.ov.querySelectorAll('.list-row').forEach((row) => {
    row.addEventListener('click', () => { const t = S.tasks.find((x) => x.id === row.dataset.id); if (t) { m.close(); openTaskDetail(t); } });
  });
}

// ---- task detail (subtasks · due time · estimate · timer) --------------------------
function openTaskDetail(task) {
  // live-derive so subtask/timer taps re-render against fresh data
  let subs = Array.isArray(task.subTasks) ? task.subTasks.map((s) => ({ ...s })) : [];
  const { accum, startMs: start, total: totalMs } = timerParts(task);
  const due = task.dueDate || '';
  const dueDateVal = due ? (() => { const d = new Date(due); return isNaN(d) ? due.slice(0, 10) : keyOfDate(d); })() : '';
  const dueTimeVal = (() => {
    if (!due) return ''; const d = new Date(due);
    if (isNaN(d) || (d.getHours() === 0 && d.getMinutes() === 0)) return '';
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  })();

  const subRow = (s) => `
    <div class="sub-row" data-sub="${esc(s.id)}">
      <button class="fcheck ${s.done ? 'on' : ''}" data-subtoggle="${esc(s.id)}">✓</button>
      <div class="sub-title ${s.done ? 'done' : ''}">${esc(s.title)}</div>
      <button class="kdel" data-subdel="${esc(s.id)}">✕</button>
    </div>`;

  const m = modal(`
    <div class="row between" style="margin-bottom:16px">
      <h2 class="h3">Task detail</h2>
      <button class="icon-btn" id="td-close">✕</button>
    </div>
    <label class="field-label">Title</label>
    <input class="field" id="td-title" value="${esc(task.title || '')}" placeholder="Task title" />
    <div class="row gap-sm">
      <div style="flex:1"><label class="field-label">Category</label><input class="field" id="td-cat" value="${esc(task.category || '')}" placeholder="Category" /></div>
      <div style="flex:1"><label class="field-label">Estimate (min)</label><input class="field" id="td-mins" type="number" min="0" value="${task.mins > 0 ? task.mins : ''}" placeholder="—" /></div>
    </div>
    <div class="row gap-sm">
      <div style="flex:1.2"><label class="field-label">Due date</label><input class="field" id="td-due" type="date" value="${esc(dueDateVal)}" /></div>
      <div style="flex:1"><label class="field-label">Due time</label><input class="field" id="td-time" type="time" value="${esc(dueTimeVal)}" /></div>
      <div style="flex:1"><label class="field-label">Priority</label>
        <select class="field" id="td-prio">
          ${['none', 'low', 'medium', 'high'].map((p) => `<option value="${p}" ${task.priority === p ? 'selected' : ''}>${p === 'none' ? 'No priority' : p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
        </select>
      </div>
    </div>
    <label class="field-label">Subtasks ${subs.length ? `<span style="text-transform:none;letter-spacing:0">· ${subs.filter((s) => s.done).length}/${subs.length}</span>` : ''}</label>
    <div class="sub-list" id="td-subs">${subs.map(subRow).join('')}</div>
    <div class="sub-add"><input id="td-subadd" placeholder="Add a subtask — press Enter" /></div>
    <label class="field-label">Notes</label>
    <textarea class="field" id="td-notes" rows="3" placeholder="Add notes…">${esc(task.notes || '')}</textarea>
    <div class="timer-ctl">
      <div>
        <div class="timer-clock" id="td-clock" ${start ? `data-timer-start="${start}" data-timer-accum="${accum}" data-clock="1"` : ''}>${fmtClock(totalMs)}</div>
        <div class="timer-state">${start ? 'timer running' : totalMs > 0 ? 'time tracked' : 'timer'}</div>
      </div>
      <span style="flex:1"></span>
      ${task.done ? '' : start
        ? `<button class="tbtn" id="td-pause">Pause</button><button class="tbtn solid" id="td-stop">Stop &amp; complete</button>`
        : `<button class="tbtn solid" id="td-start">Start</button>${totalMs > 0 ? '<button class="tbtn" id="td-stop">Stop &amp; complete</button>' : ''}`}
    </div>
    <div class="row gap-sm" style="margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-ghost stage-btn ${T.stageOf(task) === 'todo' ? 'on' : ''}" data-move="todo">To do</button>
      <button class="btn btn-ghost stage-btn ${T.stageOf(task) === 'doing' ? 'on' : ''}" data-move="doing">In progress</button>
      <button class="btn btn-ghost stage-btn ${T.stageOf(task) === 'done' ? 'on' : ''}" data-move="done">Done</button>
    </div>
    <div class="meta-line">created ${task.createdAt ? dateLabelFor(task.createdAt) : '—'}${task.completedAt ? ` · completed ${dateLabelFor(task.completedAt)}` : ''}</div>
    <div class="row gap-sm mt-2">
      <button class="btn btn-primary" id="td-save" style="flex:1">Save</button>
      <button class="btn btn-danger" id="td-del">Delete</button>
    </div>`);

  const refreshSubs = () => {
    $('#td-subs', m.ov).innerHTML = subs.map(subRow).join('');
    wireSubRows();
  };
  const wireSubRows = () => {
    m.ov.querySelectorAll('[data-subtoggle]').forEach((b) => (b.onclick = () => {
      const s = subs.find((x) => x.id === b.dataset.subtoggle); if (s) { s.done = !s.done; refreshSubs(); }
    }));
    m.ov.querySelectorAll('[data-subdel]').forEach((b) => (b.onclick = () => {
      subs = subs.filter((x) => x.id !== b.dataset.subdel); refreshSubs();
    }));
  };
  wireSubRows();
  $('#td-subadd', m.ov).onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim(); if (!v) return;
    subs.push({ id: T.newId(), title: v, done: false });
    e.target.value = '';
    refreshSubs();
  };

  const collect = () => {
    const prio = $('#td-prio', m.ov).value;
    return {
      title: $('#td-title', m.ov).value.trim() || task.title,
      cat: $('#td-cat', m.ov).value.trim(),
      category: $('#td-cat', m.ov).value.trim(),
      mins: Number($('#td-mins', m.ov).value) || 0,
      dueDate: isoFrom($('#td-due', m.ov).value, $('#td-time', m.ov).value),
      pri: prio === 'high' ? 'high' : prio === 'low' ? 'low' : 'normal',
      priority: prio,
      notes: $('#td-notes', m.ov).value,
      subTasks: subs,
    };
  };
  // timer controls — the app's semantics: pause commits elapsed into timeSpent,
  // stop commits AND completes.
  const commitMs = () => (task.timerStartedAt ? Math.max(0, Date.now() - new Date(task.timerStartedAt).getTime()) : 0);
  const startBtn = $('#td-start', m.ov), pauseBtn = $('#td-pause', m.ov), stopBtn = $('#td-stop', m.ov);
  if (startBtn) startBtn.onclick = () => { W.updateTask(task, { ...collect(), timerStartedAt: new Date().toISOString() }); m.close(); toast('Timer started'); };
  if (pauseBtn) pauseBtn.onclick = () => { W.updateTask(task, { ...collect(), timeSpent: (Number(task.timeSpent) || 0) + commitMs(), timerStartedAt: null }); m.close(); toast('Timer paused'); };
  if (stopBtn) stopBtn.onclick = () => {
    W.updateTask(task, { ...collect(), timeSpent: (Number(task.timeSpent) || 0) + commitMs(), timerStartedAt: null, done: true, completedAt: task.completedAt || new Date().toISOString() });
    m.close(); toast('Completed');
  };

  $('#td-close', m.ov).onclick = m.close;
  m.ov.querySelectorAll('[data-move]').forEach((b) => {
    b.onclick = () => { W.updateTask(task, collect()); W.moveTask({ ...task, ...collect() }, b.dataset.move); m.close(); };
  });
  $('#td-save', m.ov).onclick = () => { W.updateTask(task, collect()); m.close(); toast('Saved'); };
  $('#td-del', m.ov).onclick = () => { W.del('task', task.id); m.close(); toast('Task deleted'); };
}

// ---- wiring (all task views) --------------------------------------------------------
function wireTasks() {
  // hero ring sweep (double rAF so the transition runs from empty)
  const ring = document.querySelector('.ring-arc');
  if (ring) requestAnimationFrame(() => requestAnimationFrame(() => { ring.style.strokeDashoffset = ring.dataset.ringOffset; }));

  document.querySelectorAll('[data-stat]').forEach((b) => (b.onclick = () => {
    S.statFilter = S.statFilter === b.dataset.stat ? null : b.dataset.stat;
    renderTab();
  }));
  document.querySelectorAll('[data-vmode]').forEach((b) => (b.onclick = () => setViewMode(b.dataset.vmode)));
  const st = document.getElementById('sort-toggle');
  if (st) st.onclick = () => { S.sort = S.sort === null ? 'asc' : S.sort === 'asc' ? 'desc' : null; renderTab(); };
  document.querySelectorAll('[data-kcat]').forEach((btn) => {
    btn.onclick = () => { S.taskCategory = btn.dataset.kcat || null; renderTab(); };
  });

  // board: drag + cards
  let dragId = null;
  document.querySelectorAll('.kcard').forEach((card) => {
    card.addEventListener('dragstart', () => { dragId = card.dataset.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.querySelector('.kdel').onclick = (e) => { e.stopPropagation(); W.del('task', card.dataset.id); toast('Task deleted'); };
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('kdel')) return;
      const t = S.tasks.find((x) => x.id === card.dataset.id);
      if (t) openTaskDetail(t);
    });
  });
  document.querySelectorAll('.kcol').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop-hint'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop-hint'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('drop-hint');
      const t = S.tasks.find((x) => x.id === dragId); if (t) W.moveTask(t, col.dataset.stage);
    });
  });
  document.getElementById('done-viewall')?.addEventListener('click', openCompletedAll);
  document.querySelectorAll('[data-add]').forEach((inp) => {
    inp.onkeydown = (e) => {
      if (e.key !== 'Enter' || !inp.value.trim()) return;
      W.addTask({ title: inp.value, stage: inp.dataset.add }); inp.value = '';
    };
  });

  // list + focus + calendar rows
  document.querySelectorAll('.list-row[data-id], .frow[data-id]').forEach((row) => {
    row.querySelector('.list-del')?.addEventListener('click', (e) => { e.stopPropagation(); W.del('task', row.dataset.id); toast('Task deleted'); });
    row.addEventListener('click', (e) => {
      if (e.target.closest('.kdel') || e.target.closest('[data-toggle]')) return;
      const t = S.tasks.find((x) => x.id === row.dataset.id); if (t) openTaskDetail(t);
    });
  });
  // quick complete (round checkboxes)
  document.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const t = S.tasks.find((x) => x.id === b.dataset.toggle); if (!t) return;
    b.classList.add('just');
    W.moveTask(t, t.done ? 'todo' : 'done');
  }));
  // focus quick add
  const fa = document.getElementById('focus-add');
  if (fa) fa.onkeydown = (e) => {
    if (e.key !== 'Enter' || !fa.value.trim()) return;
    W.addTask({ title: fa.value, stage: 'todo', dueDate: isoFrom(todayKey(), '') });
    fa.value = '';
    toast('Added for today');
  };
  document.getElementById('fs-completed')?.addEventListener('click', () => { S.showCompleted = !S.showCompleted; renderTab(); });
  // calendar
  document.querySelectorAll('[data-calnav]').forEach((b) => (b.onclick = () => {
    const [y, m] = calMonthKey().split('-').map(Number);
    const d = new Date(y, m - 1 + Number(b.dataset.calnav), 1);
    S.calMonth = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    renderTab();
  }));
  document.getElementById('cal-today')?.addEventListener('click', () => { S.calMonth = null; S.calSel = todayKey(); renderTab(); });
  document.querySelectorAll('[data-day]').forEach((c) => (c.onclick = () => { S.calSel = S.calSel === c.dataset.day ? null : c.dataset.day; renderTab(); }));
  document.getElementById('cal-add')?.addEventListener('click', () => openQuickAdd(S.calSel));
}

// Live 1s tick: any visible timer badge + the detail modal clock. Runs on every
// tab (a running timer shows in the sidebar totals too).
function startTimerTick() {
  if (_timerTick) clearInterval(_timerTick);
  const hasTicking = S.tasks.some((t) => t.timerStartedAt);
  if (!hasTicking) return;
  _timerTick = setInterval(() => {
    document.querySelectorAll('[data-timer-start]').forEach((el) => {
      const start = Number(el.dataset.timerStart);
      const accum = Number(el.dataset.timerAccum || 0);
      const ms = accum + (Date.now() - start);
      el.textContent = el.dataset.clock ? fmtClock(ms) : (T.fmtDuration(ms) || '0s');
    });
  }, 1000);
}

// ===========================================================================
// MARKDOWN — tiny renderer (safe: user text always escaped via esc() first)
// ===========================================================================
function renderMd(text) {
  if (!text) return '';
  const inl = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  return text.split('\n').map((line) => {
    const m3 = line.match(/^### (.+)/); if (m3) return `<div class="md-h3">${inl(m3[1])}</div>`;
    const m2 = line.match(/^## (.+)/);  if (m2) return `<div class="md-h2">${inl(m2[1])}</div>`;
    const m1 = line.match(/^# (.+)/);   if (m1) return `<div class="md-h1">${inl(m1[1])}</div>`;
    const mb = line.match(/^[-•] (.+)/); if (mb) return `<div class="md-li">${inl(mb[1])}</div>`;
    if (line.trim() === '---') return '<hr class="md-hr" />';
    if (line.trim() === '') return '<div class="md-gap"></div>';
    return `<div class="md-p">${inl(line)}</div>`;
  }).join('');
}

// ── WYSIWYG note editor (contenteditable, BLOCK-NATIVE) ─────────────────────
// Notes are stored in the PHONE APP's block model and edited here as rich rows:
// blocks → editable HTML on open, HTML → blocks on save. This is what keeps
// checkboxes/headings/bullets (and their done-state) in sync both ways — the
// old editor flattened everything to one text block and destroyed app formatting.
const nbid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const mkB = (type, text, extra = {}) => ({ id: nbid(), type, text: text ?? '', bold: false, italic: false, done: false, color: null, ...extra });
// App colour tokens → fixed hexes (user data keeps its colour even on the mono theme).
const NOTE_HEX = { 'var(--coral)': '#E2604A', 'var(--gold)': '#D99A06', 'var(--lime-ink)': '#34A853', 'var(--cyan)': '#0A8FD0', 'var(--violet)': '#7C5CFF' };
function noteTint(token, a) {
  const h = NOTE_HEX[token]; if (!h) return '';
  return `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
}
const hasRealBlocks = (n) => Array.isArray(n?.blocks) && n.blocks.some((b) => ['body', 'title', 'bullet', 'check', 'link'].includes(b.type));

const CHK_HTML = (text, done = false, colorAttr = '') =>
  `<div class="chk${done ? ' done' : ''}"${colorAttr}><span class="chkbox" contenteditable="false"></span><span class="chktxt">${text || '<br>'}</span></div>`;

function blocksToHtml(blocks) {
  const out = []; let inList = false;
  const close = () => { if (inList) { out.push('</ul>'); inList = false; } };
  (blocks || []).forEach((b) => {
    const colorAttr = b.color && NOTE_HEX[b.color] ? ` style="color:${NOTE_HEX[b.color]}" data-color="${esc(b.color)}"` : '';
    let t = esc(b.text || '');
    if (b.bold) t = `<strong>${t}</strong>`;
    if (b.italic) t = `<em>${t}</em>`;
    if (b.type === 'title') { close(); out.push(`<h1${colorAttr}>${t || '<br>'}</h1>`); }
    else if (b.type === 'bullet') { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li${colorAttr}>${t || '<br>'}</li>`); }
    else if (b.type === 'check') { close(); out.push(CHK_HTML(t, !!b.done, colorAttr)); }
    else if (b.type === 'link') { close(); out.push(`<div class="lnk" contenteditable="false" data-url="${esc(b.url || '')}" data-ltitle="${esc(b.title || '')}" data-host="${esc(b.host || '')}" data-favicon="${esc(b.favicon || '')}">↗ ${esc(b.title || b.url || 'link')}</div>`); }
    else {
      close();
      // The app now stores multiline paragraphs (newlines INSIDE one body block —
      // its Select-All model). Render each line as its own div so contenteditable
      // shows real lines instead of collapsing the \n; save re-splits, app re-merges.
      const lines = (b.text || '').split('\n');
      lines.forEach((line) => {
        let lt = esc(line);
        if (b.bold) lt = `<strong>${lt}</strong>`;
        if (b.italic) lt = `<em>${lt}</em>`;
        out.push(`<div${colorAttr}>${lt || '<br>'}</div>`);
      });
    }
  });
  close();
  return out.join('');
}

// whole-block bold/italic (the app has no per-span marks)
function inlineFlags(el) {
  const text = (el.textContent || '').trim();
  if (!text) return {};
  const st = el.querySelector('strong,b');
  const em = el.querySelector('em,i');
  return {
    bold: !!(st && (st.textContent || '').trim() === text),
    italic: !!(em && (em.textContent || '').trim() === text),
  };
}
function editableToBlocks(root) {
  const blocks = [];
  const colorOf = (el) => (el.dataset && el.dataset.color) || null;
  root.childNodes.forEach((n) => {
    if (n.nodeType === 3) { if (n.nodeValue.trim()) blocks.push(mkB('body', n.nodeValue.trim())); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (n.classList.contains('chk')) {
      blocks.push(mkB('check', (n.querySelector('.chktxt')?.textContent || '').trim(), { done: n.classList.contains('done'), color: colorOf(n) }));
      return;
    }
    if (n.classList.contains('lnk')) {
      blocks.push({ id: nbid(), type: 'link', url: n.dataset.url || '', title: n.dataset.ltitle || '', host: n.dataset.host || '', favicon: n.dataset.favicon || '' });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      Array.from(n.children).forEach((li) => blocks.push(mkB('bullet', (li.textContent || '').trim(), { ...inlineFlags(li), color: colorOf(li) })));
      return;
    }
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') { blocks.push(mkB('title', (n.textContent || '').trim(), { color: colorOf(n) })); return; }
    if (tag === 'br' || tag === 'hr') return;
    const text = (n.innerText != null ? n.innerText : n.textContent) || '';
    if (!text.trim()) return; // the app editor spaces blocks itself
    text.split('\n').forEach((l) => { if (l.trim()) blocks.push(mkB('body', l, { ...inlineFlags(n), color: colorOf(n) })); });
  });
  return blocks;
}

// caret + check-row helpers for the toolbar's ☑ action
function placeCaretEnd(el) {
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
}
function currentBlockEl(editor) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.anchorNode;
  while (n && n.parentElement && n.parentElement !== editor) n = n.parentElement;
  return n && n.nodeType === 1 && n.parentElement === editor ? n : null;
}
function toggleCheckRow(editor) {
  editor.focus();
  const el = currentBlockEl(editor);
  if (!el) { editor.insertAdjacentHTML('beforeend', CHK_HTML('')); placeCaretEnd(editor.lastElementChild.querySelector('.chktxt')); return; }
  if (el.classList.contains('chk')) {
    const d = document.createElement('div');
    d.textContent = (el.querySelector('.chktxt')?.textContent || '').trim(); if (!d.textContent) d.innerHTML = '<br>';
    el.replaceWith(d); placeCaretEnd(d);
  } else {
    const w = document.createElement('div');
    w.innerHTML = CHK_HTML(esc((el.textContent || '').trim()));
    const chk = w.firstChild;
    el.replaceWith(chk); placeCaretEnd(chk.querySelector('.chktxt'));
  }
}
// After Enter clones a .chk row, the clone keeps the done state / may lose its
// box — normalise every check row so each has exactly one leading box.
function normalizeChecks(editor, e) {
  if (e && e.key !== 'Enter') return;
  editor.querySelectorAll('.chk').forEach((c) => {
    if (!c.querySelector('.chkbox')) {
      const box = document.createElement('span'); box.className = 'chkbox'; box.contentEditable = 'false';
      const txt = document.createElement('span'); txt.className = 'chktxt'; txt.innerHTML = c.innerHTML || '<br>';
      c.innerHTML = ''; c.append(box, txt);
    }
    if (!(c.querySelector('.chktxt')?.textContent || '').trim()) c.classList.remove('done');
  });
}

function mdToEditable(text) {
  if (!text) return '';
  const inl = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const out = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  text.split('\n').forEach((line) => {
    let m;
    if ((m = line.match(/^### (.+)/))) { closeList(); out.push(`<h3>${inl(m[1])}</h3>`); }
    else if ((m = line.match(/^## (.+)/))) { closeList(); out.push(`<h2>${inl(m[1])}</h2>`); }
    else if ((m = line.match(/^# (.+)/))) { closeList(); out.push(`<h1>${inl(m[1])}</h1>`); }
    else if ((m = line.match(/^[-•] (.+)/))) { if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inl(m[1])}</li>`); }
    else if (line.trim() === '---') { closeList(); out.push('<hr>'); }
    else if (line.trim() === '') { closeList(); out.push('<div><br></div>'); }
    else { closeList(); out.push(`<div>${inl(line)}</div>`); }
  });
  closeList();
  return out.join('');
}
function inlineToMd(node) {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += n.nodeValue; return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') out += '\n';
    else if (tag === 'b' || tag === 'strong') { const t = inlineToMd(n); out += t.trim() ? `**${t}**` : t; }
    else if (tag === 'i' || tag === 'em') { const t = inlineToMd(n); out += t.trim() ? `*${t}*` : t; }
    else out += inlineToMd(n);
  });
  return out;
}
function blockToMd(node, lines) {
  if (node.nodeType === 3) { if (node.nodeValue.trim()) lines.push(node.nodeValue); return; }
  if (node.nodeType !== 1) return;
  const tag = node.tagName.toLowerCase();
  if (tag === 'hr') { lines.push('---'); return; }
  if (tag === 'br') { lines.push(''); return; }
  if (tag === 'ul' || tag === 'ol') { Array.from(node.children).forEach((li) => lines.push('- ' + inlineToMd(li).trim())); return; }
  if (tag === 'li') { lines.push('- ' + inlineToMd(node).trim()); return; }
  if (tag === 'h1') { lines.push('# ' + inlineToMd(node).trim()); return; }
  if (tag === 'h2') { lines.push('## ' + inlineToMd(node).trim()); return; }
  if (tag === 'h3') { lines.push('### ' + inlineToMd(node).trim()); return; }
  inlineToMd(node).split('\n').forEach((l) => lines.push(l));
}
function htmlToMd(root) {
  const lines = [];
  root.childNodes.forEach((n) => blockToMd(n, lines));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function applyFormat(el, fmt) {
  el.focus();
  if (fmt === 'bold') document.execCommand('bold');
  else if (fmt === 'italic') document.execCommand('italic');
  else if (fmt === 'h1') document.execCommand('formatBlock', false, '<h1>');
  else if (fmt === 'h2') document.execCommand('formatBlock', false, '<h2>');
  else if (fmt === 'bullet') document.execCommand('insertUnorderedList');
  else if (fmt === 'divider') document.execCommand('insertHorizontalRule');
}

// ===========================================================================
// NOTES — regular (unencrypted) notes
// ===========================================================================
function renderNotes() {
  const items = S.notes.filter((n) => !T.isVaultNote(n));
  const noteCats = [...new Set(items.map((n) => n.category).filter(Boolean))].sort();
  const sq = S.search.toLowerCase();
  let sorted = [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  if (S.noteCategory) sorted = sorted.filter((n) => n.category === S.noteCategory);
  if (sq) sorted = sorted.filter((n) => (n.title || '').toLowerCase().includes(sq) || (n.body || '').toLowerCase().includes(sq) || (n.category || '').toLowerCase().includes(sq));
  const noteCatBar = noteCats.length ? `
    <div class="kfilter-bar" style="margin-bottom:14px">
      <button class="kfpill ${!S.noteCategory ? 'on' : ''}" data-ncat="">All <span class="kfcount">${items.length}</span></button>
      ${noteCats.map((c) => {
        const n = items.filter((x) => x.category === c).length;
        return `<button class="kfpill ${S.noteCategory === c ? 'on' : ''}" data-ncat="${esc(c)}">${esc(c)} <span class="kfcount">${n}</span></button>`;
      }).join('')}
    </div>` : '';
  return `<div>
    <div class="row between stag" style="--i:0;margin-bottom:10px">
      <p class="muted" style="font-size:.92rem">Notes sync with your phone in real time.</p>
      <button class="btn btn-primary" id="add-note" style="padding:9px 16px">+ Note</button>
    </div>
    ${noteCatBar}
    ${sorted.length ? `<div class="notes-grid">${sorted.map((n, i) => {
      // Real app blocks render natively (checkboxes keep their ticks); legacy
      // body-only web notes fall back to the markdown preview.
      const previewHtml = hasRealBlocks(n)
        ? n.blocks.slice(0, 6).map((b) => {
            const t = esc(b.text || '');
            if (b.type === 'title') return `<div class="md-h2">${t}</div>`;
            if (b.type === 'bullet') return `<div class="md-li">${t}</div>`;
            if (b.type === 'check') return `<div class="pv-chk${b.done ? ' done' : ''}"><span class="chkbox"></span><span>${t}</span></div>`;
            if (b.type === 'link') return `<div class="md-p">↗ ${esc(b.title || b.url || '')}</div>`;
            // Multiline paragraph blocks (app Select-All model): first 3 lines.
            return t ? t.split('\n').filter(Boolean).slice(0, 3).map((l) => `<div class="md-p">${l}</div>`).join('') : '';
          }).join('')
        : ((n.body || '') ? renderMd((n.body || '').slice(0, 200)) : '');
      const tintStyle = n.bgColor && noteTint(n.bgColor, 0.14) ? `;background:${noteTint(n.bgColor, 0.14)}` : '';
      return `<div class="glass note-card stag" style="--i:${Math.min(i + 1, 10)}${tintStyle}" data-note-id="${esc(n.id)}">
        <div class="note-title">${esc(n.title || 'Untitled')}</div>
        ${previewHtml ? `<div class="note-preview">${previewHtml}</div>` : ''}
        <div class="note-meta">${n.category ? `<span class="chip" style="font-size:.7rem;padding:2px 8px">${esc(n.category)}</span>` : ''}<span class="faint" style="font-size:.72rem;margin-left:auto">${n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : ''}</span></div>
      </div>`;
    }).join('')}</div>` : `<div class="glass card stag" style="--i:1;text-align:center;color:var(--faint);padding:40px">No notes yet. Tap "+ Note" to create one.</div>`}
  </div>`;
}

const NOTE_TOOLBAR_HTML = `
  <div class="note-toolbar">
    <button class="ntb" data-fmt="bold" title="Bold (⌘B)"><b>B</b></button>
    <button class="ntb" data-fmt="italic" title="Italic (⌘I)"><i>I</i></button>
    <span class="ntb-sep"></span>
    <button class="ntb" data-fmt="h1" title="Heading">H1</button>
    <button class="ntb" data-fmt="bullet" title="Bullet list">• List</button>
    <button class="ntb" data-fmt="check" title="Checkbox">☑ Check</button>
    <span class="ntb-hint">Synced with your phone's formatting</span>
  </div>`;

const NOTE_BG_TOKENS = [null, 'var(--coral)', 'var(--gold)', 'var(--lime-ink)', 'var(--cyan)', 'var(--violet)'];

function openNoteEdit(note) {
  // Real app blocks render natively; legacy web notes (plain body) fall back to
  // the old markdown conversion — both SAVE as app blocks from here on.
  const initialHtml = note
    ? (hasRealBlocks(note) ? blocksToHtml(note.blocks) : mdToEditable(note.body || T.blocksToText(note.blocks)))
    : '';
  let bgColor = note?.bgColor || null;
  const m = modal(`
    <div class="row between" style="margin-bottom:12px">
      <h2 class="h3">${note ? 'Edit note' : 'New note'}</h2>
      <button class="icon-btn" id="ne-close">✕</button>
    </div>
    <label class="field-label">Title</label>
    <input class="field" id="ne-title" value="${esc(note?.title || '')}" placeholder="Note title" />
    <div id="ne-edit-pane">
      ${NOTE_TOOLBAR_HTML}
      <div class="field note-editable" id="ne-body" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Write anything… headings, bullets and checkboxes sync with the app">${initialHtml}</div>
    </div>
    <div class="row" style="gap:10px;margin-top:12px;align-items:center">
      <span class="field-label" style="margin:0">Colour</span>
      <span class="note-dots" id="ne-colors">
        ${NOTE_BG_TOKENS.map((t) => `<button class="note-dot ${bgColor === t ? 'on' : ''}" data-bg="${t || ''}" style="${t ? `background:${noteTint(t, 0.85)}` : ''}" title="${t ? '' : 'Default'}">${t ? '' : '—'}</button>`).join('')}
      </span>
    </div>
    <div class="row gap-sm mt-2">
      <button class="btn btn-primary" id="ne-save" style="flex:1">Save</button>
      ${note ? `<button class="btn btn-danger" id="ne-del">Delete</button>` : ''}
    </div>`);

  const ta = $('#ne-body', m.ov);
  const card = m.ov.querySelector('.modal-card');
  const paintBg = () => { card.style.background = bgColor ? noteTint(bgColor, 0.16) : ''; };
  paintBg();
  m.ov.querySelectorAll('[data-bg]').forEach((d) => (d.onclick = () => {
    bgColor = d.dataset.bg || null;
    m.ov.querySelectorAll('[data-bg]').forEach((x) => x.classList.toggle('on', x === d));
    paintBg();
  }));

  m.ov.querySelectorAll('[data-fmt]').forEach((btn) => {
    btn.onmousedown = (e) => e.preventDefault();
    btn.onclick = () => (btn.dataset.fmt === 'check' ? toggleCheckRow(ta) : applyFormat(ta, btn.dataset.fmt));
  });
  ta.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); applyFormat(ta, 'bold'); }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); applyFormat(ta, 'italic'); }
  });
  ta.addEventListener('keyup', (e) => normalizeChecks(ta, e));
  // tick/untick checkboxes right in the editor
  ta.addEventListener('click', (e) => {
    const box = e.target.closest('.chkbox');
    if (box) { box.parentElement.classList.toggle('done'); e.preventDefault(); }
    const lnk = e.target.closest('.lnk');
    if (lnk && lnk.dataset.url) window.open(lnk.dataset.url, '_blank', 'noopener');
  });

  $('#ne-close', m.ov).onclick = m.close;
  $('#ne-save', m.ov).onclick = async () => {
    const title = $('#ne-title', m.ov).value.trim();
    const blocks = editableToBlocks(ta);
    const bodyText = T.blocksToText(blocks);
    if (DEMO) {
      if (note) { const i = S.notes.findIndex((n) => n.id === note.id); if (i >= 0) S.notes[i] = { ...note, title: title || note.title, blocks, body: bodyText, bgColor, updatedAt: Date.now() }; }
      else S.notes.unshift({ id: 'dn' + Math.random().toString(36).slice(2), title: title || 'Untitled', blocks, body: bodyText, bgColor, category: 'Notes', updatedAt: Date.now() });
      renderApp();
    } else if (note) {
      await T.updateNote(S.user.id, note, { title: title || note.title, blocks, body: bodyText, bgColor });
    } else {
      await T.addNote(S.user.id, { title, blocks, body: bodyText, bgColor });
    }
    m.close(); toast(note ? 'Note updated' : 'Note saved');
  };
  if (note) {
    $('#ne-del', m.ov).onclick = () => { W.del('note', note.id); m.close(); toast('Note deleted'); };
  }
  $('#ne-title', m.ov).focus();
}

function wireNotes() {
  $('#add-note').onclick = () => openNoteEdit(null);
  document.querySelectorAll('[data-note-id]').forEach((card) => {
    card.onclick = () => {
      const n = S.notes.find((x) => x.id === card.dataset.noteId);
      if (n) openNoteEdit(n);
    };
  });
  document.querySelectorAll('[data-ncat]').forEach((btn) => {
    btn.onclick = () => { S.noteCategory = btn.dataset.ncat || null; renderTab(); };
  });
}

// ===========================================================================
// REPORTS — analytics (completion rate, time per category, habit streaks)
// ===========================================================================
function renderReports() {
  const total = S.tasks.length;
  const done = S.tasks.filter((t) => T.stageOf(t) === 'done').length;
  const doing = S.tasks.filter((t) => T.stageOf(t) === 'doing').length;
  const todo = total - done - doing;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const catTime = {};
  S.tasks.forEach((t) => {
    const cat = t.category || 'Uncategorized';
    const committed = Number(t.timeSpent) || 0;
    const live = t.timerStartedAt ? Math.max(0, Date.now() - new Date(t.timerStartedAt).getTime()) : 0;
    let ms = committed + live;
    if (ms <= 0 && t.done && t.mins > 0) ms = t.mins * 60000;
    catTime[cat] = (catTime[cat] || 0) + ms;
  });
  const catEntries = Object.entries(catTime).filter(([, ms]) => ms > 0).sort(([, a], [, b]) => b - a);
  const maxMs = catEntries.length ? catEntries[0][1] : 1;

  // grayscale ladder — rank speaks through tone, not hue
  const barTone = (i, n) => `color-mix(in srgb, var(--ink) ${Math.max(28, 100 - Math.round((i / Math.max(1, n - 1)) * 60))}%, transparent)`;

  const catChart = catEntries.length ? `
    <div class="report-chart">
      ${catEntries.slice(0, 8).map(([cat, ms], i, arr) => {
        const pctW = Math.max(4, Math.round((ms / maxMs) * 100));
        return `<div class="report-bar-row">
          <div class="report-bar-label">${esc(cat)}</div>
          <div class="report-bar-track">
            <div class="report-bar-fill" style="width:${pctW}%;background:${barTone(i, arr.length)}"></div>
          </div>
          <div class="report-bar-val">${T.fmtDuration(ms) || '0s'}</div>
        </div>`;
      }).join('')}
    </div>` : `<div class="faint" style="padding:24px;text-align:center">No time tracked yet — start a timer from any task.</div>`;

  const habitRows = S.habits.map((h) => {
    const { pct: hp, done: hd, days } = T.habitMonthPct(h.log);
    const on = !!(h.log && h.log[T.todayKey()]);
    return `<div class="report-habit-row">
      <span><span class="emoji">${esc(h.emoji || '◦')}</span> ${esc(h.name || 'Habit')}</span>
      <div class="report-bar-track" style="flex:1;margin:0 12px">
        <div class="report-bar-fill" style="width:${hp}%;background:var(--ink)"></div>
      </div>
      <span class="faint" style="font-size:.8rem">${hd}/${days}d</span>
      ${on ? `<span style="font-size:.78rem;margin-left:6px;font-weight:700">✓ today</span>` : ''}
    </div>`;
  }).join('');

  return `<div style="max-width:760px">
    <div class="stag" style="--i:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">
      <div class="glass card report-stat"><div class="report-stat-val">${pct}%</div><div class="report-stat-label">Completion rate</div></div>
      <div class="glass card report-stat"><div class="report-stat-val">${done}</div><div class="report-stat-label">Tasks done</div></div>
      <div class="glass card report-stat"><div class="report-stat-val">${doing}</div><div class="report-stat-label">In progress</div></div>
      <div class="glass card report-stat"><div class="report-stat-val" style="color:var(--faint)">${todo}</div><div class="report-stat-label">To do</div></div>
    </div>

    ${catEntries.length ? `<div class="glass card stag" style="--i:1;margin-bottom:20px">
      <div class="widget-title" style="margin-bottom:16px">Time per category</div>
      ${catChart}
    </div>` : ''}

    ${S.habits.length ? `<div class="glass card stag" style="--i:2">
      <div class="widget-title" style="margin-bottom:16px">Habit progress this month</div>
      <div style="display:flex;flex-direction:column;gap:12px">${habitRows}</div>
    </div>` : ''}
  </div>`;
}

// ===========================================================================
// VAULT — secure notes (PIN-encrypted)
// ===========================================================================
function renderVault() {
  const items = S.notes.filter(T.isVaultNote);
  return `<div>
    <div class="row between stag" style="--i:0;margin-bottom:14px">
      <p class="muted" style="font-size:.92rem">Secure notes — encrypted with a PIN-derived key.</p>
      <button class="btn btn-primary" id="add-secure" style="padding:9px 16px">+ Secure note</button>
    </div>
    ${items.length ? `<div class="vault-grid">${items.map((n, i) => {
      const open = S.unlocked[n.id];
      return `<div class="glass vault-item stag ${open ? '' : 'locked'}" style="--i:${Math.min(i + 1, 10)}" data-note="${esc(n.id)}">
        <div class="lock-badge">${open ? '○' : '●'}</div>
        <div style="font-weight:700;font-size:.98rem">${esc(n.title || n.lockHint || 'Secure note')}</div>
        <div class="vault-body" style="margin-top:8px;font-size:.88rem;color:var(--muted);white-space:pre-wrap;min-height:36px">${open ? esc(open) : '••••••••\n••••••'}</div>
        <button class="btn btn-ghost" data-unlock style="margin-top:10px;padding:7px 14px;font-size:.82rem">${open ? 'Lock' : 'Unlock'}</button>
      </div>`;
    }).join('')}</div>` : `<div class="glass card vault-empty stag" style="--i:1">No secure notes yet. Tap "+ Secure note" to add one.</div>`}
  </div>`;
}
function wireVault() {
  $('#add-secure').onclick = () => {
    const m = modal(`
      <h2 class="h3">New secure note</h2>
      <label class="field-label">Title</label>
      <input class="field" id="v-title" placeholder="Title" />
      <label class="field-label">Content</label>
      <textarea class="field" id="v-body" rows="4" placeholder="Secret content…"></textarea>
      <label class="field-label">PIN <span class="faint" style="font-weight:400">(optional — leave blank for no lock)</span></label>
      <input class="field mono" id="v-pin" inputmode="numeric" placeholder="4+ digit PIN (optional)" style="letter-spacing:.2em" />
      <button class="btn btn-primary btn-block mt-2" id="v-save">Save note</button>`);
    $('#v-save', m.ov).onclick = async () => {
      const title = $('#v-title', m.ov).value;
      const body = $('#v-body', m.ov).value;
      const pin = $('#v-pin', m.ov).value.trim();
      if (pin && pin.length < 4) return toast('PIN must be at least 4 digits');
      if (DEMO) { toast('Demo mode — not saved'); m.close(); return; }
      $('#v-save', m.ov).textContent = pin ? 'Encrypting…' : 'Saving…';
      try {
        if (pin) await T.addSecureNote(S.user.id, { title, body, pin });
        else await T.addNote(S.user.id, { title, body });
        m.close(); toast('Note saved');
      } catch (e) { toast('Could not save'); $('#v-save', m.ov).textContent = 'Save note'; }
    };
  };
  document.querySelectorAll('[data-note]').forEach((card) => {
    const nid = card.dataset.note;
    card.querySelector('[data-unlock]').onclick = () => {
      if (S.unlocked[nid]) { delete S.unlocked[nid]; renderTab(); return; }
      const note = S.notes.find((n) => n.id === nid);
      if (!note.enc && !note.lock) {
        S.unlocked[nid] = T.blocksToText(note.blocks) || note.body || '(empty)'; renderTab(); return;
      }
      const m = modal(`<h2 class="h3">Unlock "${esc(note.title || 'note')}"</h2>
        <input class="field mono" id="u-pin" inputmode="numeric" placeholder="PIN" style="text-align:center;letter-spacing:.3em" />
        <button class="btn btn-primary btn-block mt-2" id="u-go">Unlock</button>`);
      const go = async () => {
        const pin = $('#u-pin', m.ov).value.trim();
        const txt = await T.revealNote(note, pin);
        if (txt == null) return toast('Wrong PIN');
        S.unlocked[nid] = txt || '(empty)'; m.close(); renderTab();
      };
      $('#u-go', m.ov).onclick = go;
      $('#u-pin', m.ov).onkeydown = (e) => { if (e.key === 'Enter') go(); };
      $('#u-pin', m.ov).focus();
    };
  });
}

// boot
if (DEMO) {
  S.user = { id: 'demo-user', email: 'demo@truedo.app' };
  S.profile = [{ name: 'Ashish', currency: 'USD' }];
  S.tasks = demoTasks().map(normTask);
  S.habits = demoHabits();
  S.notes = demoNotes();
  S.accounts = [{ bal: 12450 }, { bal: 3210 }];
  renderApp();
} else {
  renderAuth();
}
