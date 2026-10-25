/* ══════════════════════════════════════════════════════════════════════════
   Résumé Roaster — illustrated 2D fire
   Builds the flame layer once, sizes it to the card, and lets it animate
   only while the card is on screen. Styling lives in assets/roast-fire.css.

   The composition is seeded, so the fire looks the same on every load: two
   rows of tongues (tall and deep behind, short and bright in front), a
   white-hot bed between them, an ambient glow, and a few small licks that
   break off and rise.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var card = document.querySelector('.fx-roast');
  var fire = card && card.querySelector('.roast-fire');
  if (!fire) return;

  /* ── tunables ───────────────────────────────────────────────────────── */
  var BACK  = 15;       // tall tongues behind the bed
  var FRONT = 18;       // short bright tongues in front of it
  var BAND_MIN = 0.30;  // tallest tongue, as a share of card height — floor
  var BAND_MAX = 0.50;  //                                              — ceiling

  /* seeded PRNG (mulberry32) */
  var seed = 0x2f6b9d1;
  function rnd() {
    seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function between(a, b) { return a + (b - a) * rnd(); }
  function pick(list)    { return list[Math.floor(rnd() * list.length)]; }
  var SHAPES = ['rf-a', 'rf-b', 'rf-c', 'rf-d'];

  function el(cls, vars) {
    var n = document.createElement('i');
    n.className = cls;
    if (vars) for (var k in vars) n.style.setProperty('--' + k, vars[k]);
    return n;
  }
  /* four independent clocks per tongue: stretch, sway, bend, core */
  function clocks(v) {
    var d = [between(.9, 1.55), between(1.7, 2.9), between(1.2, 2.2), between(.6, 1.15)];
    for (var i = 0; i < 4; i++) {
      v['d' + (i + 1)] = d[i].toFixed(2) + 's';
      v['l' + (i + 1)] = (-between(0, d[i])).toFixed(2) + 's';   // start mid-cycle
    }
    return v;
  }

  /* ── build ──────────────────────────────────────────────────────────── */
  var f = document.createDocumentFragment();
  f.appendChild(el('rf-amb'));

  /* height envelope, read off the reference: the left edge climbs, the run
     under the tags stays low, and the right-hand side carries the tall
     tongues. Shared by every row so they rise and dip together. */
  function envelope(u) {
    if (u < .1)  return .86;
    if (u < .5)  return .5;
    if (u < .72) return .64;
    return .86;
  }
  function lean() { return between(-11, 11).toFixed(1) + 'deg'; }

  /* body: a few wide, low tongues at the very back */
  for (var k = 0; k < 6; k++) {
    var bx = 4 + k * 18.4 + between(-3, 3);
    f.appendChild(el('rf-flame rf-body ' + pick(SHAPES), clocks({
      x: bx.toFixed(2), w: between(19, 25).toFixed(2), lean: lean(),
      h: (envelope(bx / 100) * .62 + between(-.04, .05)).toFixed(3)
    })));
  }

  /* back row: tall, deep, mostly where the envelope runs high */
  for (var i = 0; i < BACK; i++) {
    var x = 2 + i * (96 / (BACK - 1)) + between(-2.2, 2.2), u = x / 100;
    var h = envelope(u) + between(-.08, .08);
    if (u > .5 && rnd() < .3) h += .16;             // the odd tongue that leaps
    f.appendChild(el('rf-flame rf-back ' + pick(SHAPES), clocks({
      x: x.toFixed(2), w: between(7, 11).toFixed(2), lean: lean(),
      h: Math.min(1, Math.max(.4, h)).toFixed(3)
    })));
  }

  f.appendChild(el('rf-bed'));

  /* licks: mostly at the edges and off the right-hand cluster */
  [[4, .52, 1], [8, .7, 3], [93, .56, 3], [97, .76, 1], [58, .62, 1], [79, .74, 3], [70, .5, 1]]
    .forEach(function (L) {
      var d = between(1.5, 2.6);
      f.appendChild(el('rf-lick rf-l', {
        x: L[0], y: L[1], z: L[2], w: between(2.4, 4).toFixed(2), h: between(.13, .22).toFixed(3),
        tilt: between(-18, 18).toFixed(0) + 'deg',
        dx: between(-14, 14).toFixed(0) + '%', d1: d.toFixed(2) + 's', l1: (-between(0, d)).toFixed(2) + 's'
      }));
    });

  /* front row: shorter, brighter, slightly overlapping the card edges */
  for (var j = 0; j < FRONT; j++) {
    var fx = -1 + j * (102 / (FRONT - 1)) + between(-1.8, 1.8), fu = fx / 100;
    var fh = envelope(fu) * .55 + between(-.07, .09);
    f.appendChild(el('rf-flame rf-front ' + pick(SHAPES), clocks({
      x: fx.toFixed(2), w: between(8.5, 12.5).toFixed(2), lean: lean(),
      h: Math.min(.6, Math.max(.22, fh)).toFixed(3)
    })));
  }

  fire.appendChild(f);

  /* ── size the band to the card ──────────────────────────────────────────
     The tallest tongues reach roughly the middle of the green badge, so the
     body of the fire sits under and behind the tags and never climbs into
     the description. Clamped to 30–50% of the card. */
  var badge = card.querySelector('.metric');
  function size() {
    var c = card.getBoundingClientRect(), H = c.height || 1, band = BAND_MIN * H;
    if (badge) {
      var b = badge.getBoundingClientRect();
      band = Math.max(band, c.bottom - (b.top + b.height / 2));
    }
    fire.style.setProperty('--fire-h', Math.min(band, BAND_MAX * H).toFixed(1) + 'px');
  }
  size();
  if (window.ResizeObserver) {
    /* the card for width changes; the description because re-wrapping it
       moves the badge without changing the card's own size */
    var ro = new ResizeObserver(size);
    ro.observe(card);
    var desc = card.querySelector('.desc');
    if (desc) ro.observe(desc);
  } else {
    addEventListener('resize', size);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);

  /* ── run only while visible ─────────────────────────────────────────── */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // CSS holds it still
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { fire.classList.toggle('is-live', e.isIntersecting); });
    }, { rootMargin: '60px 0px' }).observe(card);
  } else {
    fire.classList.add('is-live');
  }
})();
