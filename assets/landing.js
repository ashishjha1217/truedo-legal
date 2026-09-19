/* ==========================================================================
   TrueDo landing — interactions & animations (classic script, no imports so it
   never blocks on the network). Screenshot loading lives in shots.js (module).
   ========================================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;

  /* ---- Theme (persisted) ------------------------------------------------ */
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('truedo-theme-v2'); } catch (e) {}
  if (saved) root.setAttribute('data-theme', saved);
  function setThemeIcon() {
    var d = root.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('[data-theme-icon]').forEach(function (el) { el.textContent = d ? '☾' : '☀'; });
  }
  setThemeIcon();
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('truedo-theme-v2', next); } catch (e2) {}
    setThemeIcon();
  });

  /* ---- Year + App Store links ------------------------------------------ */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---- Mobile menu ------------------------------------------------------ */
  var menuBtn = document.querySelector('.menu-btn');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () { mobileMenu.classList.toggle('open'); });
    mobileMenu.addEventListener('click', function (e) { if (e.target.tagName === 'A') mobileMenu.classList.remove('open'); });
  }

  /* ---- Mouse-follow spotlight ------------------------------------------ */
  var spot = document.querySelector('.spotlight');
  if (spot && !isTouch) {
    var mx = 50, my = 30, tx = 50, ty = 30, raf = null;
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth) * 100;
      ty = (e.clientY / window.innerHeight) * 100;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    function loop() {
      mx += (tx - mx) * 0.12; my += (ty - my) * 0.12;
      spot.style.setProperty('--mx', mx + '%');
      spot.style.setProperty('--my', my + '%');
      if (Math.abs(tx - mx) > 0.1 || Math.abs(ty - my) > 0.1) raf = requestAnimationFrame(loop);
      else raf = null;
    }
  }

  /* ---- Scroll reveal ---------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- Animated counters ------------------------------------------------ */
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        cio.unobserve(en.target);
        var el = en.target, target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '', dec = (el.getAttribute('data-dec') | 0);
        var start = performance.now(), dur = 1400;
        (function tick(now) {
          var p = Math.min(1, (now - start) / dur);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (target * eased).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---- 3D tilt on devices/cards ---------------------------------------- */
  if (!isTouch && !reduce) {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var r = 10;
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        var px = (e.clientX - b.left) / b.width - 0.5;
        var py = (e.clientY - b.top) / b.height - 0.5;
        el.style.transform = 'perspective(1000px) rotateY(' + (px * r) + 'deg) rotateX(' + (-py * r) + 'deg) translateY(-6px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ---- Nav shadow on scroll -------------------------------------------- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.style.boxShadow = window.scrollY > 8 ? '0 10px 30px -18px rgba(0,0,0,0.5)' : 'none'; };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---- Canvas aurora (moving gradient particles) ----------------------- */
  var canvas = document.getElementById('aurora');
  if (canvas && !reduce) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W, H, pts;
    var COLORS = ['#2563eb', '#06b6d4', '#8b5cf6', '#3b82f6'];
    function resize() {
      W = canvas.width = window.innerWidth * dpr;
      H = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      var count = window.innerWidth < 640 ? 5 : 9; // fewer on mobile for perf
      pts = [];
      for (var i = 0; i < count; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          r: (120 + Math.random() * 180) * dpr,
          vx: (Math.random() - 0.5) * 0.28 * dpr,
          vy: (Math.random() - 0.5) * 0.28 * dpr,
          c: COLORS[i % COLORS.length]
        });
      }
    }
    resize();
    var resizeT;
    window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(resize, 200); });
    var running = true;
    document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running) draw(); });
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -p.r) p.x = W + p.r; if (p.x > W + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = H + p.r; if (p.y > H + p.r) p.y = -p.r;
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        var alpha = root.getAttribute('data-theme') === 'light' ? '22' : '2e';
        g.addColorStop(0, p.c + alpha);
        g.addColorStop(1, p.c + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  }
})();
