/* ══════════════════════════════════════════════════════════════════════════
   PortfolioIntro — cinematic opening sequence
   ──────────────────────────────────────────────────────────────────────────
   One continuous virtual-camera move through an oversized "HI," wordmark.
   The camera is a single object {s, fx, fy, rot}:

       s   scale, expressed as a multiple of the final lockup size
       fx  which slice of the wordmark sits under the lens, in wordmark
           widths from its centre  (-0.5 = far left edge, +0.5 = far right)
       fy  the same, vertically, in wordmark heights
       rot rotation in degrees

   Because fx/fy are normalised to the glyphs themselves, the framing —
   "the H's left stem", "the crossbar and counter", "the leg plus the comma" —
   holds at every viewport size without a single hard-coded pixel.

   Configuration lives in window.PORTFOLIO_INTRO (see index.html).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG  = window.PORTFOLIO_INTRO || {};
  var ROOT = document.documentElement;
  var host = document.getElementById('portfolio-intro');

  /* the boot script already decided whether we play */
  if (!host || !ROOT.classList.contains('pi-armed')) return;

  var disarm  = CFG.disarm || function () { ROOT.classList.remove('pi-armed', 'pi-hold'); };
  var SPEED   = typeof CFG.SPEED === 'number' && CFG.SPEED > 0 ? CFG.SPEED : 1;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var blurK   = innerWidth < 760 ? 0.55 : 1;       // filters are pricier on phones
  var bl      = function (px) { return 'blur(' + (px * blurK).toFixed(2) + 'px)'; };

  /* ── markup ───────────────────────────────────────────────────────────── */
  host.className = 'pi-prep';
  host.innerHTML =
    '<div class="pi-glow"></div>' +
    '<div class="pi-grid"></div>' +
    '<div class="pi-blur"><div class="pi-stage"><div class="pi-word">' +
      '<span class="pi-hi">HI</span><span class="pi-comma">,</span>' +
    '</div></div></div>' +
    '<div class="pi-subwrap"><div class="pi-sub"><b>I\'m <i>Ayush.</i></b></div></div>' +
    '<div class="pi-seam"></div>';

  var blurL = host.querySelector('.pi-blur');
  var word  = host.querySelector('.pi-word');
  var comma = host.querySelector('.pi-comma');
  var grid  = host.querySelector('.pi-grid');
  var glow  = host.querySelector('.pi-glow');
  var sub   = host.querySelector('.pi-sub');
  var subIn = host.querySelector('.pi-sub b');
  var seam  = host.querySelector('.pi-seam');

  var CLIP_OPEN   = 'polygon(-12% -14%, 112% -14%, 112% 114%, -12% 114%)';
  var CLIP_LIFTED = 'polygon(-12% -14%, 112% -14%, 112% -13%, -12% 3%)';

  var tl = null;

  /* ── finish: hand the page back, intact ───────────────────────────────── */
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    CFG.running = false;
    removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    if (host.parentNode) host.parentNode.removeChild(host);
    disarm();
  }

  /* jump straight to the end — GSAP suppresses callbacks when you scrub, so
     release()/finish() are called directly rather than relied on to fire. */
  function skip() { if (tl) tl.progress(1, false); release(); finish(); }
  function onKey(e) { if (e.key === 'Escape') skip(); }                    // a11y escape hatch
  var startW = innerWidth;
  function onResize() { if (Math.abs(innerWidth - startW) > 60) skip(); }  // framing would jump
  addEventListener('keydown', onKey);
  addEventListener('resize', onResize);

  /* releases the portfolio underneath while the intro is still exiting */
  var released = false;
  function release() {
    if (released) return;
    released = true;
    ROOT.classList.remove('pi-hold');

    var g     = window.gsap;
    var nav   = document.getElementById('nav');
    var items = [].slice.call(document.querySelectorAll('.hero > *'));
    var all   = nav ? items.concat([nav]) : items;
    if (!g || !all.length) return;

    /* the site's own .reveal transition would fight GSAP frame-for-frame */
    all.forEach(function (el) { el.style.transition = 'none'; });
    var restore = function () { all.forEach(function (el) { el.style.transition = ''; }); };

    if (nav) g.from(nav, { y: -34, opacity: 0, duration: .62, ease: 'power3.out' });
    g.from(items, {
      y: 26, opacity: 0, duration: .78, ease: 'power3.out',
      stagger: .055, onComplete: restore
    });
  }

  /* ── no GSAP (script failed to load): reveal immediately ─────────────── */
  var gsap = window.gsap;
  if (!gsap) { release(); finish(); return; }

  gsap.set(host, { clipPath: CLIP_OPEN, webkitClipPath: CLIP_OPEN });

  /* ── reduced motion: hold the lockup briefly, then fade ───────────────── */
  if (reduced) {
    gsap.set(subIn, { yPercent: 0 });
    host.className = '';
    tl = gsap.timeline({ onComplete: finish });
    tl.timeScale(SPEED);
    CFG.timeline = tl; CFG.running = true;
    tl.from([word, sub], { opacity: 0, duration: .26, ease: 'power2.out', stagger: .06 })
      .add(release, .34)
      .to(host, { opacity: 0, duration: .30, ease: 'power2.inOut' }, .34);
    return;
  }

  /* ── measure the wordmark, then derive the whole camera ladder ────────── */
  function build() {
    var W  = word.offsetWidth  || 1;                       // layout size, untransformed
    var H  = word.offsetHeight || 1;
    var fs = parseFloat(getComputedStyle(word).fontSize) || 100;

    /* Three rungs of the ladder, all read off the viewport so the framing
       survives any screen:
         S0     opening scale — the H's stem lands as a slab ~34% of the
                viewport wide, the proportion the reference opens on
         SMID   end of the long zoom — wordmark ~1.55 viewports wide, so the
                counter fills the frame and both stems crop off the edges
         SPLAT  the plateau — ~1.25 viewports, one leg and the comma held  */
    var stem  = fs * 0.13;
    var S0    = Math.max(8, Math.min(60, (0.34 * innerWidth) / stem));
    var SMID  = Math.min(Math.max(3,   (1.55 * innerWidth) / W), S0 * 0.70);
    var SPLAT = Math.min(Math.max(2.4, (1.25 * innerWidth) / W), SMID * 0.85);

    var cam = { s: S0 * 1.30, fx: -0.60, fy: -0.30, rot: -40 };

    /* The camera drives .pi-word, never the full-bleed .pi-stage: scaling a
       viewport-sized box by 25x hands the compositor a ~40000px layer. The
       wordmark's own box is a few hundred pixels, so the move stays cheap. */
    function applyCam() {
      var a = cam.rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
      var dx = cam.fx * W, dy = cam.fy * H;                // offset in wordmark space
      gsap.set(word, {                                     // …rotated & scaled to screen space
        x: -(dx * cos - dy * sin) * cam.s,
        y: -(dx * sin + dy * cos) * cam.s,
        rotation: cam.rot, scale: cam.s,
        force3D: false                                     // repaint, don't upscale a bitmap
      });
    }

    /* opening state ---------------------------------------------------- */
    applyCam();
    gsap.set(comma, { x: W * 1.9, rotation: -18 });        // satellite waits off-screen right
    gsap.set(subIn, { yPercent: 112 });
    gsap.set(blurL, { filter: bl(11) });
    gsap.set(seam,  { y: innerHeight * 1.1, rotation: -6, opacity: 0 });
    host.className = '';                                   /* opening frame is posed */

    tl = gsap.timeline({ onComplete: finish });
    tl.timeScale(SPEED);
    CFG.running  = true;    /* stands the boot failsafe down */
    CFG.timeline = tl;      /* dev handle: PORTFOLIO_INTRO.timeline.pause().seek(1.4, false) */

    /* ① 0.10–0.46 — SWEEP-IN.  The oversized stem crosses the frame and
          wipes the ground clear; the giant type is the transition itself. */
    tl.to(cam, { s: S0, fx: -0.415, fy: -0.02, rot: -33,
                 duration: .36, ease: 'power3.out', onUpdate: applyCam }, .10)
      .to(blurL, { filter: bl(0), duration: .42, ease: 'power2.out' }, .10)
      .set(blurL, { filter: 'none' }, .52)
      .to(grid,  { opacity: 0, duration: .34, ease: 'power1.out' }, .10)

    /* ② 0.42–1.64 — THE LONG ZOOM-OUT.  Scale and reframing ride different
          curves, so the wordmark drifts rather than simply shrinking:
          stem → crossbar → counter → right leg. */
      .to(cam, { s: SMID, duration: 1.22, ease: 'power2.out', onUpdate: applyCam }, .42)
      .to(cam, { onUpdate: applyCam, keyframes: [
            { fx: -0.170, fy: .075, rot: -21, duration: .70, ease: 'power1.inOut' },
            { fx: -0.060, fy: .028, rot: -11, duration: .52, ease: 'sine.inOut'  }
         ] }, .42)

    /* ③ 1.10–1.96 — the comma arrives from outside the frame, oversized,
          and shrinks in lock-step with the camera. */
      .to(comma, { x: 0, rotation: 0, duration: .86, ease: 'power3.out' }, 1.10)

    /* ④ 1.64–1.92 — DECELERATION PLATEAU: motion almost stops, one leg and
          the comma held in frame. */
      .to(cam, { s: SPLAT, fx: .030, fy: .012, rot: -8,
                 duration: .28, ease: 'sine.out', onUpdate: applyCam }, 1.64)

    /* ⑤ 1.92–2.38 — COLLAPSE.  Everything rushes together into the lockup. */
      .to(cam, { s: 1, fx: 0, fy: 0, rot: 0,
                 duration: .46, ease: 'power3.inOut', onUpdate: applyCam }, 1.92)
      .to(blurL, { filter: bl(3.5), duration: .14, ease: 'sine.out' }, 1.92)
      .to(blurL, { filter: bl(0),   duration: .18, ease: 'sine.in'  }, 2.06)
      .set(blurL, { filter: 'none' }, 2.24)
      .to(glow,  { scale: 1.25, opacity: .55, duration: .50, ease: 'power2.out' }, 1.92)

    /* ⑥ 2.30–2.86 — "I'm Ayush." rises out of its mask. */
      .to(subIn, { yPercent: 0, duration: .56, ease: 'power3.out' }, 2.30)

    /* ⑦ 2.60–3.02 — HAND-OFF.  The camera keeps going, now inward: the
          lockup pushes past the lens and out through the viewport edges
          while the intro ground is lifted away as an angled curtain,
          uncovering the portfolio underneath. */
      .add(release, 2.64)
      .to(cam,   { s: 7, fy: -.10, duration: .34, ease: 'power2.in', onUpdate: applyCam }, 2.60)
      .to(blurL, { filter: bl(9), duration: .32, ease: 'power2.in' }, 2.62)
      .to(sub,   { y: '-=34', opacity: 0, duration: .28, ease: 'power2.in' }, 2.62)
      .to(word,  { opacity: 0, duration: .22, ease: 'power1.in' }, 2.68)
      .to(seam,  { y: -innerHeight * .16, opacity: 1,
                   duration: .34, ease: 'power3.inOut' }, 2.66)
      .to(seam,  { opacity: 0, duration: .12, ease: 'power1.in' }, 2.90)
      .to(host,  { clipPath: CLIP_LIFTED, webkitClipPath: CLIP_LIFTED,
                   duration: .34, ease: 'power3.inOut' }, 2.66)
      .set({}, {}, 3.02);                                   /* total run time */
  }

  /* Space Grotesk has to be resolved before the wordmark is measured,
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
