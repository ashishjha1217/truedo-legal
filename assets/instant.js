// ===========================================================================
// TrueDo web — InstantDB data layer (real sync with the phone app)
// Uses @instantdb/core via ESM CDN → no build step (Hostinger GitHub-import ready).
// Mirrors the app's row shapes exactly (src/aura/data/rows.js, instant.js) so
// data created here shows up on the phone and vice-versa.
// ===========================================================================
import { init, id } from 'https://esm.sh/@instantdb/core@1.0.49';

// SAME backend as the phone app (src/aura/data/instant.js:10). The app id is a
// public, client-side identifier — the security boundary is instant.perms.ts.
export const APP_ID = 'c5b80a4b-1857-4486-9130-6d5e95829f4e';

// OAuth client names as configured in the InstantDB dashboard (Auth → OAuth).
// Leave '' until you create them; the buttons stay disabled with a helpful note.
export const OAUTH = {
  google: 'google-web', // InstantDB Google (web) client on the Truedo app
  apple: 'apple',       // InstantDB Apple client on the Truedo app (c5b80a4b…)
};

export const db = init({ appId: APP_ID });
export const newId = id;

// ---- Auth ---------------------------------------------------------------
export function onAuth(cb) { return db.subscribeAuth((a) => cb(a?.user || null, a?.error || null)); }
export function sendCode(email) { return db.auth.sendMagicCode({ email: email.trim().toLowerCase() }); }
export function verifyCode(email, code) { return db.auth.signInWithMagicCode({ email: email.trim().toLowerCase(), code: code.trim() }); }
export function signOut() { return db.auth.signOut(); }

// OAuth (Apple / Google) — needs a clientName configured in the InstantDB
// dashboard. Without it, throws a clear error the UI surfaces as a toast.
export function oauthRedirect(provider) {
  const clientName = OAUTH[provider];
  if (!clientName) throw new Error(`${provider} sign-in isn't configured yet (set OAUTH.${provider} after creating the client in the InstantDB dashboard).`);
  const url = db.auth.createAuthorizationURL({ clientName, redirectURL: window.location.href });
  window.location.href = url;
}

// ---- Row <-> item mapping (mirrors src/aura/data/rows.js) ----------------
// itemFromRow: { id: row.id, ...row.data }. rowFromItem dumps everything except
// id into `data`, plus mirrored indexed columns for some entities.
export const itemFromRow = (row) => ({ id: row.id, ...(row.data || {}) });

export function rowFromItem(item, entity) {
  const { id: _omit, ...data } = item;
  const row = { data, updatedAt: Date.now(), deletedAt: 0 };
  if (entity === 'txn') row.date = String(data.date || '');
  if (entity === 'task') { row.done = !!data.done; row.dueDate = String(data.dueDate || ''); }
  return row;
}

// Live rows readers MUST drop soft-deleted rows (deletedAt truthy).
const live = (rows) => (rows || []).filter((r) => !r.deletedAt).map(itemFromRow);

// ---- Generic subscribe (scoped to the signed-in user) --------------------
// Returns an unsubscribe fn. Perms already restrict to own rows, but we also
// pass a where:{uid} for efficiency.
export function subscribe(entity, uid, cb, { byId = false } = {}) {
  const where = byId ? { id: uid } : { uid };
  return db.subscribeQuery({ [entity]: { $: { where } } }, (resp) => {
    if (resp.error) { cb([], resp.error); return; }
    cb(live(resp.data?.[entity]), null);
  });
}

// ---- Writes --------------------------------------------------------------
export function upsert(entity, item, uid) {
  const rid = item.id || newId();
  return db.transact(db.tx[entity][rid].update({ uid, ...rowFromItem({ ...item, id: rid }, entity) }));
}
export function softDelete(entity, rid) {
  const now = Date.now();
  return db.transact(db.tx[entity][rid].update({ deletedAt: now, updatedAt: now }));
}

// ===========================================================================
// TASKS (kanban). The app's task has only a boolean `done` (no stage), so we
// keep a web-only `data.stage` ('todo'|'doing'|'done') that the phone IGNORES,
// while mirroring done<->stage:'done' so completion syncs both ways.
// ===========================================================================
export const TASK_STAGES = ['todo', 'doing', 'done'];
// Stage is DERIVED from the same fields the phone app uses, so board moves, the
// running timer, and hours all sync both ways:
//   done            → 'done'
//   timerStartedAt  → 'doing' (a running timer == in progress)
//   else            → 'todo'
// (legacy website-only `stage`/`timerStart` are still honoured for old rows.)
export function stageOf(task) {
  if (task.done) return 'done';
  if (task.timerStartedAt || task.timerStart) return 'doing';
  if (task.stage === 'doing') return 'doing';
  return 'todo';
}
export function addTask(uid, { title, category = '', stage = 'todo' }) {
  const now = new Date().toISOString();
  const item = {
    id: newId(),
    title: (title || '').trim() || 'Untitled',
    cat: category,  // the phone app's category field is `cat` — store there so it syncs
    done: stage === 'done',
    dueDate: '',
    createdAt: now,
    timeSpent: 0,
    timerStartedAt: stage === 'doing' ? now : null,  // moving straight to "in progress" starts the timer
    completedAt: stage === 'done' ? now : null,
  };
  return upsert('task', item, uid);
}
// Move a task between board columns, mirroring the app's timer model:
//  • → In progress: start the timer (stamp timerStartedAt)
//  • leaving In progress: commit elapsed into timeSpent, clear timerStartedAt
//  • → Done: mark done (+ completedAt); commit any running time first
export function moveTask(uid, task, stage) {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  // committed time so far (support legacy website field on old rows)
  let timeSpent = Number(task.timeSpent != null ? task.timeSpent : task.timerAccum) || 0;
  const runningIso = task.timerStartedAt || (task.timerStart ? new Date(Number(task.timerStart)).toISOString() : null);
  let timerStartedAt = runningIso;
  const cur = stageOf(task);
  if (cur === 'doing' && stage !== 'doing' && timerStartedAt) {
    timeSpent += Math.max(0, now - new Date(timerStartedAt).getTime()); // commit elapsed
    timerStartedAt = null;
  } else if (stage === 'doing' && cur !== 'doing') {
    timerStartedAt = nowIso; // start the timer
  }
  const next = {
    ...task,
    done: stage === 'done',
    timeSpent,
    timerStartedAt,
    completedAt: stage === 'done' ? (task.completedAt || nowIso) : null,
  };
  // drop the legacy website-only fields so the row matches the app's shape
  delete next.stage; delete next.timerAccum; delete next.timerStart;
  return upsert('task', next, uid);
}
export function updateTask(uid, task, updates) {
  return upsert('task', { ...task, ...updates }, uid);
}
export function fmtDuration(ms) {
  if (!ms || ms < 1000) return null;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ===========================================================================
// NET WORTH + HABITS (sidebar widget) — mirrors store.js selectors.
// ===========================================================================
export function netWorth(accounts, ledger) {
  const acc = (accounts || []).reduce((a, x) => a + (Number(x.bal) || 0), 0);
  const led = (ledger || []).reduce((a, p) =>
    a + ((p?.txns || []).reduce((s, t) => s + (t.dir === 'out' ? t.amt : -t.amt), 0)), 0);
  return acc + led;
}
const hKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function habitMonthPct(log) {
  const n = new Date(); const y = n.getFullYear(), m = n.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  let done = 0;
  for (let d = 1; d <= days; d++) if (log && log[hKey(y, m, d)]) done++;
  return { pct: Math.round((done / days) * 100), done, days };
}
export function todayKey() { const n = new Date(); return hKey(n.getFullYear(), n.getMonth(), n.getDate()); }
export function toggleHabitToday(uid, habit) {
  const k = todayKey();
  const log = { ...(habit.log || {}) };
  if (log[k]) delete log[k]; else log[k] = true;
  return upsert('habit', { ...habit, log }, uid);
}
export function fmtMoney(n, currency = 'USD') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0); }
  catch { return '$' + Math.round(n || 0).toLocaleString(); }
}

// ===========================================================================
// VAULT — secure notes. Web-created secure notes are encrypted with Web Crypto
// (PBKDF2-SHA256 100k + AES-256-GCM). Stored in the `note` entity with
// data.vault=true and data.enc (cipher blob). Legacy app-locked notes (plaintext
// gated by a djb2 PIN hash) are still revealable here via checkPinLegacy.
// NOTE: full app<->web *encrypted* parity arrives when the app's vault-encryption
// fix lands using this same scheme.
// ===========================================================================
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin, saltB64) {
  const salt = unb64(saltB64);
  const base = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}
export async function encryptSecret(plaintext, pin) {
  const saltB64 = b64(crypto.getRandomValues(new Uint8Array(16)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, saltB64);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return { encV: 'wc1', salt: saltB64, iv: b64(iv), ct: b64(ct) };
}
export async function decryptSecret(blob, pin) {
  try {
    const key = await deriveKey(pin, blob.salt);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
    return dec.decode(pt);
  } catch { return null; } // wrong PIN / tampered
}

// Legacy PIN verifier ported from src/aura/data/vaultFiles.js (djb2 s2$ scheme)
// so the web can open notes locked by the current phone build.
function djb2(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return h >>> 0; }
function stretch(pin, salt) { let h = djb2(`${salt}::${String(pin || '')}`); for (let i = 0; i < 50000; i++) h = djb2(`${h}:${salt}:${i & 1023}`); return (h >>> 0).toString(36); }
export function checkPinLegacy(pin, stored) {
  if (!stored) return false;
  if (stored.startsWith('s2$')) { const salt = stored.split('$')[1] || ''; return `s2$${salt}$${stretch(pin, salt)}` === stored; }
  if (stored.startsWith('h')) return 'h' + djb2('truedo·vault·v2' + String(pin || '')).toString(36) === stored;
  return false;
}

// Regular (unencrypted) notes. `blocks` uses the PHONE APP's block model —
// [{id,type:'body'|'title'|'bullet'|'check'|'link',text,bold,italic,done,color}] —
// so headings/bullets/checkboxes round-trip 1:1 with the app. `body` is kept as a
// derived plain-text mirror (search + legacy web notes that predate blocks).
export function addNote(uid, { title, body, blocks, category, bgColor }) {
  const item = {
    id: newId(),
    title: (title || 'Untitled').trim(),
    body: body || '',
    blocks: blocks && blocks.length ? blocks : (body ? [{ id: newId(), type: 'body', text: body, bold: false, italic: false, done: false, color: null }] : []),
    category: category || 'Notes',
    bgColor: bgColor || null,
    vault: false,
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: Date.now(),
  };
  return upsert('note', item, uid);
}
export function updateNote(uid, note, updates) {
  return upsert('note', { ...note, ...updates, updatedAt: Date.now() }, uid);
}

// Create a web secure note (encrypted) in the `note` entity.
export async function addSecureNote(uid, { title, body, pin }) {
  const blob = await encryptSecret(body || '', pin);
  const item = {
    id: newId(),
    title: (title || 'Secure note').trim(),
    category: 'Vault',
    vault: true,
    locked: true,
    enc: blob,                 // encrypted body
    blocks: [],                // no plaintext on the row
    lockHint: title || 'Secure note',
    updatedAt: Date.now(),
    createdAt: new Date().toISOString(),
  };
  return upsert('note', item, uid);
}
// Reveal a vault note: returns plaintext string or null on wrong PIN.
export async function revealNote(note, pin) {
  if (note.enc && note.enc.encV === 'wc1') return decryptSecret(note.enc, pin);
  // Legacy app note: gated, not encrypted — verify PIN then show plaintext blocks.
  if (note.lock) { if (!checkPinLegacy(pin, note.lock)) return null; return blocksToText(note.blocks); }
  return blocksToText(note.blocks);
}
export function blocksToText(blocks) {
  return (blocks || []).map((b) => {
    if (b.type === 'bullet') return `• ${b.text || ''}`;
    if (b.type === 'check') return `${b.done ? '☑' : '☐'} ${b.text || ''}`;
    if (b.type === 'link') return b.title || b.url || '';
    return b.text || '';
  }).join('\n');
}
export function isVaultNote(note) { return !!(note.vault || note.enc || note.lock); }
