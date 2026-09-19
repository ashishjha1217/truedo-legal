// Review cards injected into #reviews-grid on the landing page.
(function () {
  const reviews = [
    { name: 'Priya M.', role: 'Designer', color: 'var(--violet)', stars: 5, text: 'Finally one app for money, tasks and notes that doesn’t feel cluttered. The colour-coding means I always know where I am.' },
    { name: 'Daniel R.', role: 'Founder', color: 'var(--cyan)', stars: 5, text: 'The Vault sold me — Face ID + a PIN for my private docs, and now the content is actually encrypted. Calm and trustworthy.' },
    { name: 'Aisha K.', role: 'Student', color: '#22c55e', stars: 5, text: 'Net worth at a glance and habits I actually keep. The web app means I plan my week on my laptop and it’s all on my phone.' },
    { name: 'Marco V.', role: 'Freelancer', color: 'var(--gold)', stars: 5, text: 'The Kanban board on the web is exactly the right amount of features. Drag, drop, done. No bloat.' },
    { name: 'Lena S.', role: 'PM', color: 'var(--coral)', stars: 4, text: 'Truedo Intelligence helps me make sense of my spending and plan the day. Private and genuinely useful.' },
    { name: 'Tomás G.', role: 'Engineer', color: 'var(--violet)', stars: 5, text: 'No ads, no tracking, my data stays mine. Dark mode is gorgeous. This is the organiser I kept wishing existed.' },
  ];
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;
  grid.innerHTML = reviews.map((r) => `
    <div class="glass review reveal">
      <div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <p>${r.text}</p>
      <div class="who">
        <div class="avatar-init" style="background:${r.color}">${r.name.split(' ').map((w) => w[0]).join('')}</div>
        <div><strong style="font-size:.92rem">${r.name}</strong><div class="faint" style="font-size:.8rem">${r.role}</div></div>
      </div>
    </div>`).join('');
  // re-observe newly added reveal nodes
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.1 });
  grid.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();
