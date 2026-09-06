/* ══════════════════════════════════════════════════════════════════════════
   PortfolioIntro — cinematic opening sequence
   ──────────────────────────────────────────────────────────────────────────
   Four beats, one continuous move:

     ①  an oversized "Hi," sweeps in and is walked through the viewport by a
         virtual camera — only fragments of it are ever in frame
     ②  the camera zooms out AND travels, setting the wordmark down in its
         real place in the hero headline
     ③  "I'm Ayush." types itself in to the right, under a caret
     ④  everything else fades up, top to bottom

   The camera flies the hero's own <span class="h-hi">, so beat ② ends at
   scale 1 / offset 0 — which *is* the hero's layout position. Nothing is
   measured against anything, and there is no cross-fade to give the seam
   away.

   The camera is one object:

       s   scale, as a multiple of the headline's real size
       fx  which slice of the wordmark is under the lens, in wordmark widths
           from its centre  (-0.5 = far left edge, +0.5 = far right)
       fy  the same, vertically, in wordmark heights
       rot rotation in degrees
       fw  framing weight: 1 = hold that slice at the centre of the screen,
           0 = sit exactly where the hero puts the headline

   fx/fy are normalised to the glyphs, so "the H's left stem" or "the
   counter" frames identically on any screen; the scale rungs are read off
   the viewport width at run time. No hard-coded pixels anywhere.

   Configuration lives in window.PORTFOLIO_INTRO (see index.html).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG  = window.PORTFOLIO_INTRO || {};
  var ROOT = document.documentElement;
  var host = document.getElementById('portfolio-intro');

  /* the boot script already decided whether we play */
  if (!host || !ROOT.classList.contains('pi-armed')) return;

  var h1    = document.querySelector('.hero h1');
  var hi    = h1 && h1.querySelector('.h-hi');
  var comma = h1 && h1.querySelector('.h-comma');
  var name  = h1 && h1.querySelector('.h-name');

  var ungate  = CFG.ungate || function () {
    ROOT.classList.remove('pi-armed', 'pi-prep', 'pi-dim', 'pi-fly');
  };
  var disarm  = CFG.disarm || function () {
    ungate(); ROOT.classList.remove('pi-hold');
  };
  var SPEED   = typeof CFG.SPEED === 'number' && CFG.SPEED > 0 ? CFG.SPEED : 1;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  host.innerHTML = '<div class="pi-glow"></div><div class="pi-grid"></div>' +
                   '<div class="pi-seam"></div>';
  var glow = host.querySelector('.pi-glow');
  var grid = host.querySelector('.pi-grid');
  var seam = host.querySelector('.pi-seam');

  var tl = null, caret = null;

  /* items that cascade in behind the headline, in visual top-to-bottom order */
  function cascadeItems() {
    var list = [].slice.call(document.querySelectorAll('.hero > *'))
                 .filter(function (el) { return el !== h1; });
    var nav = document.getElementById('nav');
    return nav ? [nav].concat(list) : list;
  }

  /* ── finish: hand the page back exactly as it was ─────────────────────── */
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    CFG.running = false;
    removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
    var g = window.gsap;
    if (g) {
      if (hi)   g.set([hi, comma], { clearProps: 'all' });
      if (name) g.set(name, { clearProps: 'all' });
      if (h1)   g.set(h1, { clearProps: 'all' });
    }
    if (host.parentNode) host.parentNode.removeChild(host);
    disarm();
  }

  /* jump straight to the end — GSAP suppresses callbacks when you scrub, so
     reveal()/finish() are called directly rather than relied on to fire. */
  function skip() { if (tl) tl.progress(1, false); unpark(); reveal(); cascade(); finish(); }
  function onKey(e) { if (e.key === 'Escape') skip(); }                    // a11y escape hatch
  var startW = innerWidth;
  function onResize() { if (Math.abs(innerWidth - startW) > 60) skip(); }  // framing would jump
  addEventListener('keydown', onKey);
  addEventListener('resize', onResize);

  /* the site's own aurora comes back underneath while the ground fades out */
  function unpark() { ROOT.classList.remove('pi-dim'); }

  /* the ground has finished fading: drop the overlay and give the page back
     (scroll and the hero content stay held until the cascade) */
  var opened = false;
  function reveal() {
    if (opened) return;
    opened = true;
    if (host.parentNode) host.parentNode.removeChild(host);
    ungate();
  }

  /* ④ everything else, faded up top to bottom */
  var cascaded = false;
  function cascade() {
    if (cascaded) return;
    cascaded = true;
    ROOT.classList.remove('pi-hold');

    var g = window.gsap, items = cascadeItems();
    if (!g || !items.length) return;

    /* the site's own .reveal transition would fight GSAP frame-for-frame */
    items.forEach(function (el) { el.style.transition = 'none'; });
    g.fromTo(items,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: .55, ease: 'power2.out', stagger: .09,
        onComplete: function () {
          items.forEach(function (el) { el.style.transition = ''; });
          g.set(items, { clearProps: 'opacity,transform' });
        } });
  }

  /* ── no GSAP (script failed to load): reveal immediately ──────────────── */
  var gsap = window.gsap;
  if (!gsap || !hi || !name) { unpark(); reveal(); cascade(); finish(); return; }

  /* ── reduced motion: settle the headline, fade the ground, cascade ────── */
  if (reduced) {
    ROOT.classList.remove('pi-prep');
    tl = gsap.timeline({ onComplete: finish });
    tl.timeScale(SPEED);
    CFG.running = true; CFG.timeline = tl;
    tl.from(h1, { opacity: 0, duration: .28, ease: 'power2.out' })
      .add(unpark, .18)
      .to(host, { opacity: 0, duration: .30, ease: 'power2.inOut' }, .18)
      .add(reveal, .50)
      .add(cascade, .52);
    return;
  }

  /* ── measure the headline, then derive the whole camera ladder ────────── */
  function build() {
    /* Pristine geometry first: an inline-block boundary swallows one of the
       headline's -3px letter-spaces, so measure before and after the display
       switch and cancel the difference exactly. */
    var preComma = comma.getBoundingClientRect().left;
    var preName  = name.getBoundingClientRect().left;
    ROOT.classList.add('pi-fly');
    var d = comma.getBoundingClientRect().left - preComma;
    if (d) comma.style.marginLeft = (-d) + 'px';
    d = name.getBoundingClientRect().left - preName;
    if (d) hi.style.marginRight = (-d) + 'px';

    var W  = hi.offsetWidth  || 1;                    // layout size, untransformed
    var H  = hi.offsetHeight || 1;
    var fs = parseFloat(getComputedStyle(h1).fontSize) || 100;

    var box = hi.getBoundingClientRect();             // where the hero puts it
    var Cx  = box.left + box.width  / 2;
    var Cy  = box.top  + box.height / 2;
    var Vx  = innerWidth / 2, Vy = innerHeight / 2;

    /* Three rungs, all read off the viewport so the framing survives any
       screen:
         S0     opening scale — the H's stem lands as a slab ~34% of the
                viewport wide, the proportion the reference opens on
         SMID   end of the long zoom — wordmark ~1.55 viewports wide, so the
                counter fills the frame and both stems crop off the edges
         SPLAT  the plateau — ~1.25 viewports, one leg and the comma held  */
    var stem  = fs * 0.13;
    var S0    = Math.max(8, Math.min(60, (0.34 * innerWidth) / stem));
    var SMID  = Math.min(Math.max(3,   (1.55 * innerWidth) / W), S0 * 0.70);
    var SPLAT = Math.min(Math.max(2.4, (1.25 * innerWidth) / W), SMID * 0.85);

    var cam = { s: S0 * 1.30, fx: -0.58, fy: -0.30, rot: -40, fw: 1 };

    function applyCam() {
      var a = cam.rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
      var dx = cam.fx * W, dy = cam.fy * H;           // offset in wordmark space
      var rx = (dx * cos - dy * sin) * cam.s;         // …rotated and scaled
      var ry = (dx * sin + dy * cos) * cam.s;
      gsap.set(hi, {
        x: cam.fw * (Vx - Cx) - rx,                   // fw 1 → centred on screen
        y: cam.fw * (Vy - Cy) - ry,                   // fw 0 → the hero's own spot
        rotation: cam.rot, scale: cam.s,
        force3D: false                                // repaint, don't upscale a bitmap
      });
    }

    /* Motion blur goes on .h-hi itself: a filter is applied in the element's
       own coordinate space and only then scaled by the transform, so the
       radius has to be divided by the scale to land at the intended number of
       screen pixels. Only worth it once the wordmark is close to its final
       size — filtering it while it is still 40x costs the compositor a
       full-screen upscale every frame, which is where the sequence used to
       drop frames. Above BLUR_MAX_S there is nothing to soften anyway: the
       glyph is a flat slab with two edges. */
    var BLUR_MAX_S = 5;
    var blurK = innerWidth < 760 ? 0.55 : 1;
    function blur(screenPx) {
      gsap.set(hi, { filter: (screenPx > .05 && cam.s <= BLUR_MAX_S)
        ? 'blur(' + (screenPx * blurK / cam.s).toFixed(3) + 'px)' : 'none' });
    }
    var bt = { b: 0 };                                // motion-blur driver
    function blurFrom() { blur(bt.b); }

    /* opening state ---------------------------------------------------- */
    applyCam();
    gsap.set(comma, { x: W * 1.9, rotation: -18 });   // satellite waits off-screen right
    gsap.set(name,  { clipPath: 'inset(-30% 100% -30% -6%)',
                      webkitClipPath: 'inset(-30% 100% -30% -6%)' });
    gsap.set(seam,  { y: innerHeight * 1.06, rotation: -6, opacity: 0 });
    ROOT.classList.remove('pi-prep');                 /* opening frame is posed */

    /* the wordmark is down: shed the display switch and its compensation so
       the headline is byte-for-byte the hero's own again. The name is still
       fully clipped at this point, so the 3px it shifts back is never seen. */
    function landed() {
      ROOT.classList.remove('pi-fly');
      gsap.set([hi, comma], { clearProps: 'all' });
      if (!caret) return;
      var nb = name.getBoundingClientRect(), hb = h1.getBoundingClientRect();
      gsap.set(caret, { x: nb.left - hb.left, opacity: 0 });
    }
    function caretEnd() {
      return name.getBoundingClientRect().right - h1.getBoundingClientRect().left;
    }

    if (name.getClientRects().length === 1) {         // single line: caret can track it
      caret = document.createElement('i');
      caret.className = 'pi-caret';
      caret.setAttribute('aria-hidden', 'true');
      h1.appendChild(caret);
      gsap.set(caret, { opacity: 0 });
    }

    tl = gsap.timeline({ onComplete: finish });
    tl.timeScale(SPEED);
    CFG.running  = true;    /* stands the boot failsafe down */
    CFG.timeline = tl;      /* dev handle: PORTFOLIO_INTRO.timeline.pause().seek(1.4, false) */

    /* ① 0.10–0.46 — SWEEP-IN.  The oversized stem crosses the frame and
          wipes the ground clear; the giant type is the transition itself. */
    tl.to(cam, { s: S0, fx: -0.40, fy: -0.02, rot: -33,
                 duration: .36, ease: 'power3.out', onUpdate: applyCam }, .10)
      .to(grid, { opacity: 0, duration: .34, ease: 'power1.out' }, .10)

    /* ② 0.42–1.40 — THE LONG ZOOM-OUT.  Scale and reframing ride different
          curves, so the wordmark drifts rather than simply shrinking:
          stem → crossbar → counter → right leg. */
      .to(cam, { s: SMID, duration: .98, ease: 'power2.out', onUpdate: applyCam }, .42)
      .to(cam, { onUpdate: applyCam, keyframes: [
            { fx: -0.170, fy: .075, rot: -21, duration: .56, ease: 'power1.inOut' },
            { fx: -0.060, fy: .028, rot: -11, duration: .42, ease: 'sine.inOut'  }
         ] }, .42)

    /* ③ 0.92–1.74 — the comma arrives from outside the frame, oversized,
          and shrinks in lock-step with the camera. */
      .to(comma, { x: 0, rotation: 0, duration: .82, ease: 'power3.out' }, .92)

    /* ④ 1.40–1.60 — DECELERATION PLATEAU: motion almost stops, one leg and
          the comma held in frame. */
      .to(cam, { s: SPLAT, fx: .030, fy: .012, rot: -8,
                 duration: .20, ease: 'sine.out', onUpdate: applyCam }, 1.40)

    /* ⑤ 1.60–2.18 — COLLAPSE AND TRAVEL.  Scale, rotation and framing all
          resolve together, so the wordmark shrinks *and* slides across to sit
          down in the hero headline. fw:0 is, exactly, its layout position. */
      .to(cam, { s: 1, fx: 0, fy: 0, rot: 0,
                 duration: .58, ease: 'power3.inOut', onUpdate: applyCam }, 1.60)
      .to(cam, { fw: 0, duration: .58, ease: 'power2.inOut', onUpdate: applyCam }, 1.60)
      .fromTo(bt, { b: 0 },
                   { b: 4, duration: .16, ease: 'sine.out',
                     yoyo: true, repeat: 1, onUpdate: blurFrom }, 1.90)
      .add(landed, 2.18)
      .to(glow, { scale: 1.2, opacity: .5, duration: .5, ease: 'power2.out' }, 1.60)

    /* ⑥ 1.88–2.38 — the ground clears.  The site's own background is the same
          colour underneath, so the field simply lifts away. */
      .add(unpark, 1.92)
      .to(seam, { y: -innerHeight * .12, opacity: 1,
                  duration: .40, ease: 'power2.inOut' }, 1.88)
      .to(seam, { opacity: 0, duration: .14, ease: 'power1.in' }, 2.16)
      .to(host, { opacity: 0, duration: .40, ease: 'power2.inOut' }, 1.96)
      .add(reveal, 2.38)

    /* ⑦ 2.30–2.80 — the name types itself in, left to right, under a caret */
      .to(name, { clipPath: 'inset(-30% -6% -30% -6%)',
                  webkitClipPath: 'inset(-30% -6% -30% -6%)',
                  duration: .50, ease: 'power2.inOut' }, 2.30);

    if (caret) {
      tl.to(caret, { opacity: 1, duration: .12, ease: 'none' }, 2.22)
        .to(caret, { x: caretEnd, duration: .50, ease: 'power2.inOut' }, 2.30)
        .to(caret, { opacity: 0, duration: .24, ease: 'power2.out' }, 2.74);
    }

    /* ⑧ 2.76–3.85 — everything else fades up, top to bottom */
    tl.add(cascade, 2.76)
      .set({}, {}, 3.02);                  /* overlay life; the cascade runs on */
  }

  /* Space Grotesk has to be resolved before the headline is measured,
     otherwise every camera distance is derived from a fallback face. */
  var started = false;
  function start() { if (!started) { started = true; build(); } }
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 900); })])
      .then(start);
  } else {
    start();
  }
})();
