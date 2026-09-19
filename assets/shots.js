// ==========================================================================
// Landing screenshots — live from InstantDB file storage ($files).
// Each mockup screen carries data-slot="<name>". The admin uploads a file at
// path `screenshots/<name>.<ext>`; this module swaps the placeholder for the
// real image. Fully optional: if InstantDB is unreachable the placeholders stay.
// ==========================================================================
import { db } from './instant.js';

function slotFromPath(path) {
  // screenshots/hero.jpg -> hero
  const m = /(?:^|\/)screenshots\/([^/.]+)\./.exec(path || '');
  return m ? m[1] : null;
}

function apply(files) {
  const bySlot = {};
  (files || []).forEach((f) => {
    const slot = slotFromPath(f.path);
    if (slot && f.url) bySlot[slot] = f.url;
  });
  document.querySelectorAll('[data-slot]').forEach((screen) => {
    const url = bySlot[screen.getAttribute('data-slot')];
    if (!url) return;
    if (screen.querySelector('img[data-shot]')) { screen.querySelector('img[data-shot]').src = url; return; }
    const img = document.createElement('img');
    img.setAttribute('data-shot', '');
    img.alt = 'TrueDo app screenshot';
    img.loading = 'lazy';
    img.src = url;
    img.style.opacity = '0';
    img.style.transition = 'opacity .6s ease';
    img.onload = () => { img.style.opacity = '1'; const ph = screen.querySelector('.shot-empty'); if (ph) ph.style.display = 'none'; };
    screen.appendChild(img);
  });
}

try {
  db.subscribeQuery({ $files: {} }, (resp) => {
    if (resp.error) return; // keep placeholders
    apply(resp.data && resp.data.$files);
  });
} catch (e) {
  /* offline / blocked — placeholders remain */
}
