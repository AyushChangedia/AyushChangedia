/* Per-card background animations. Each canvas starts only once its card is
   (nearly) fully in view, and stops again when it leaves — nothing runs on load. */
(function () {
  'use strict';
  var VIS = 0.85;                       // fraction of the card that must be visible
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dpr = Math.min(devicePixelRatio || 1, 2);
  var cards = [], running = false;

  function fit(c) {
    var r = c.cvs.getBoundingClientRect();
    c.w = r.width; c.h = r.height;
    var W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (c.cvs.width !== W || c.cvs.height !== H) { c.cvs.width = W; c.cvs.height = H; }
  }
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  /* ── 1. Résumé Roaster — fire ─────────────────────────────── */
  function fire(c, dt, ctx) {
    var p = c.s;
    p.acc = (p.acc || 0) + dt * 80;
    while (p.acc >= 1 && p.a.length < 150) {
      p.acc--;
      p.a.push({ x: rnd(-10, c.w + 10), y: c.h + 6, vx: rnd(-7, 7), vy: rnd(-46, -92),
                 t: 0, life: rnd(1.0, 1.9), r: rnd(5, 15) });
    }
    ctx.globalCompositeOperation = 'lighter';
    for (var i = p.a.length - 1; i >= 0; i--) {
      var q = p.a[i]; q.t += dt;
      if (q.t >= q.life) { p.a.splice(i, 1); continue; }
      q.x += q.vx * dt + Math.sin((q.t + q.r) * 2.2) * 9 * dt;
      q.y += q.vy * dt; q.vy *= (1 - 0.32 * dt);
      var k = q.t / q.life, col;
      if (k < 0.18)      col = '255,248,214';
      else if (k < 0.42) col = '255,206,84';
      else if (k < 0.70) col = '249,146,38';
      else               col = '214,62,30';
      var rr = q.r * (1 + k * 1.5), a = (1 - k) * 0.30;
      var g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rr);
      g.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g; ctx.fillRect(q.x - rr, q.y - rr, rr * 2, rr * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── 2. ORB Backtester — candles + price line ─────────────── */
  function stocks(c, dt, ctx) {
    var p = c.s;
    if (!p.bars) {
      p.bars = []; p.px = c.h * 0.55; p.t = 0; p.step = 0;
      for (var i = 0; i < 46; i++) p.bars.push(mkBar(p, c));
    }
    p.t += dt;
    if (p.t > 0.42) { p.t = 0; p.bars.push(mkBar(p, c)); if (p.bars.length > 46) p.bars.shift(); }
    var bw = c.w / 30, off = -(p.t / 0.42) * bw;
    ctx.lineWidth = 1;
    for (var j = 0; j < p.bars.length; j++) {
      var b = p.bars[j], x = j * bw + off, up = b.c <= b.o;
      ctx.globalAlpha = 0.20;
      ctx.strokeStyle = ctx.fillStyle = up ? '#34d399' : '#f87171';
      ctx.beginPath(); ctx.moveTo(x + bw * 0.5, b.hi); ctx.lineTo(x + bw * 0.5, b.lo); ctx.stroke();
      ctx.fillRect(x + bw * 0.22, Math.min(b.o, b.c), bw * 0.56, Math.max(2, Math.abs(b.c - b.o)));
    }
    ctx.globalAlpha = 0.34; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (var k = 0; k < p.bars.length; k++) ctx[k ? 'lineTo' : 'moveTo'](k * bw + off + bw * 0.5, p.bars[k].c);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function mkBar(p, c) {
    p.px += rnd(-1, 1) * c.h * 0.05;
    p.px = Math.max(c.h * 0.18, Math.min(c.h * 0.86, p.px));
    var o = p.px, cl = p.px + rnd(-1, 1) * c.h * 0.04;
    return { o: o, c: cl, hi: Math.min(o, cl) - rnd(2, c.h * 0.05), lo: Math.max(o, cl) + rnd(2, c.h * 0.05) };
  }

  /* ── 3. Commerce APIs — bots peeking from the bottom ──────── */
  function bots(c, dt, ctx) {
    var p = c.s;
    if (!p.b) {
      p.b = []; var n = 6;
      for (var i = 0; i < n; i++)
        p.b.push({ x: (i + 0.5) * (c.w / n) + rnd(-14, 14), up: 0, dir: 0,
                   wait: rnd(0.05, 1.1), hold: rnd(0.9, 2.2), s: rnd(15, 22), blink: 0 });
    }
    for (var j = 0; j < p.b.length; j++) {
      var b = p.b[j];
      if (b.dir === 0) { b.wait -= dt; if (b.wait <= 0) b.dir = 1; }
      else if (b.dir === 1) { b.up += dt * 1.7; if (b.up >= 1) { b.up = 1; b.dir = 2; } }
      else if (b.dir === 2) { b.hold -= dt; if (b.hold <= 0) b.dir = 3; }
      else { b.up -= dt * 1.5; if (b.up <= 0) { b.up = 0; b.dir = 0; b.wait = rnd(0.5, 2.4); b.hold = rnd(.7, 1.8); } }
      if (b.up <= 0) continue;
      b.blink += dt;
      var e = b.up < 1 ? 1 - Math.pow(1 - b.up, 3) : 1;
      var s = b.s, y = c.h + s * 1.2 - e * s * 2.75;
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#6366f1';
      ctx.beginPath(); ctx.roundRect(b.x - s / 2, y, s, s * 1.1, s * 0.3); ctx.fill();
      ctx.fillStyle = '#a5b4fc'; ctx.fillRect(b.x - 1, y - s * 0.36, 2, s * 0.36);
      ctx.beginPath(); ctx.arc(b.x, y - s * 0.42, 2.2, 0, 7); ctx.fill();
      var open = (b.blink % 3.1) > 0.12;
      ctx.fillStyle = '#22d3ee'; ctx.globalAlpha = open ? 0.55 : 0.12;
      ctx.fillRect(b.x - s * 0.26, y + s * 0.3, s * 0.18, s * 0.2);
      ctx.fillRect(b.x + s * 0.08, y + s * 0.3, s * 0.18, s * 0.2);
      ctx.globalAlpha = 1;
    }
  }

  /* ── 4. Git City — skyline builds up ──────────────────────── */
  function city(c, dt, ctx) {
    var p = c.s;
    if (!p.t) {
      p.t = 0.0001; p.b = []; var x = -6;
      while (x < c.w + 20) { var w = rnd(14, 30);
        p.b.push({ x: x, w: w, h: rnd(c.h * 0.13, c.h * 0.44), d: rnd(0, 1.9), lit: Math.random() < 0.7 });
        x += w + rnd(4, 10); }
    }
    p.t += dt;
    for (var i = 0; i < p.b.length; i++) {
      var b = p.b[i], k = Math.max(0, Math.min(1, (p.t - b.d) / 1.1));
      if (k <= 0) continue;
      var e = 1 - Math.pow(1 - k, 3), h = b.h * e, y = c.h - h;
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#3730a3';
      ctx.fillRect(b.x, y, b.w, h);
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#22d3ee';
      ctx.fillRect(b.x, y, b.w, 1.4);
      if (b.lit && e > 0.5) {
        ctx.globalAlpha = 0.3; ctx.fillStyle = '#a5b4fc';
        for (var wy = y + 7; wy < c.h - 5; wy += 9)
          for (var wx = b.x + 4; wx < b.x + b.w - 4; wx += 8)
            if (((wx + wy) * 7 % 11) > 4) ctx.fillRect(wx, wy, 2.6, 3.2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ── 5. AI Agent Arena — two duelling bots, sparks on clash ─ */
  function arena(c, dt, ctx) {
    var p = c.s;
    if (!p.sp) { p.sp = []; p.t = 0; }
    p.t += dt;
    var cy = c.h * 0.84, swing = Math.sin(p.t * 3.1), clash = Math.abs(swing) > 0.93;
    var ax = c.w * 0.32, bx = c.w * 0.68, mx = (ax + bx) / 2, my = cy - 16;
    // bodies
    ctx.globalAlpha = 0.3;
    [[ax, '#6366f1'], [bx, '#a855f7']].forEach(function (d) {
      ctx.fillStyle = d[1];
      ctx.beginPath(); ctx.roundRect(d[0] - 8, cy - 10, 16, 22, 5); ctx.fill();
      ctx.beginPath(); ctx.arc(d[0], cy - 17, 6.5, 0, 7); ctx.fill();
    });
    // blades meeting at the midpoint
    ctx.lineCap = 'round';
    [[ax, '#22d3ee'], [bx, '#f0abfc']].forEach(function (d, i) {
      var sx = d[0] + (i ? -7 : 7), sy = cy - 6;
      var tx = mx + (i ? 3 : -3) * swing, ty = my + swing * 5;
      ctx.globalAlpha = 0.18; ctx.strokeStyle = d[1]; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.globalAlpha = 0.8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    });
    if (clash && p.sp.length < 70 && Math.random() < 0.8)
      for (var i = 0; i < 4; i++)
        p.sp.push({ x: mx, y: my, vx: rnd(-90, 90), vy: rnd(-80, 20), t: 0, life: rnd(0.3, 0.7) });
    ctx.globalCompositeOperation = 'lighter';
    for (var j = p.sp.length - 1; j >= 0; j--) {
      var s = p.sp[j]; s.t += dt;
      if (s.t >= s.life) { p.sp.splice(j, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 150 * dt;
      ctx.globalAlpha = (1 - s.t / s.life) * 0.9;
      ctx.fillStyle = '#fdf4ff';
      ctx.fillRect(s.x, s.y, 1.8, 1.8);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  /* ── 6. FluxFin — coins rising ────────────────────────────── */
  function money(c, dt, ctx) {
    var p = c.s;
    if (!p.a) p.a = [];
    p.acc = (p.acc || 0) + dt * 3.4;
    while (p.acc >= 1 && p.a.length < 26) {
      p.acc--;
      p.a.push({ x: rnd(8, c.w - 8), y: c.h + 12, vy: rnd(-26, -46), t: 0,
                 life: rnd(2.6, 4.4), r: rnd(6, 11), sp: rnd(1.6, 3.4), ph: rnd(0, 6) });
    }
    for (var i = p.a.length - 1; i >= 0; i--) {
      var q = p.a[i]; q.t += dt;
      if (q.t >= q.life) { p.a.splice(i, 1); continue; }
      q.y += q.vy * dt; q.x += Math.sin(q.t * 1.3 + q.ph) * 11 * dt;
      var k = q.t / q.life, a = Math.sin(Math.PI * Math.min(1, k * 1.6)) * 0.38;
      var sx = Math.abs(Math.cos(q.t * q.sp));           // spin, edge-on at 0
      ctx.globalAlpha = a;
      ctx.fillStyle = '#34d399';
      ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(0.8, q.r * sx), q.r, 0, 0, 7); ctx.fill();
      if (sx > 0.45) {
        ctx.globalAlpha = a * 0.85; ctx.fillStyle = '#064e3b';
        ctx.font = 'bold ' + (q.r * 1.15).toFixed(0) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('₹', q.x, q.y + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  var FX = { roaster: fire, orb: stocks, api: bots, city: city, arena: arena, flux: money };

  /* ── wiring ───────────────────────────────────────────────── */
  [].forEach.call(document.querySelectorAll('.proj canvas.pfx'), function (cvs) {
    var fn = FX[cvs.dataset.fx]; if (!fn) return;
    cards.push({ cvs: cvs, ctx: cvs.getContext('2d'), fn: fn, on: false, s: { a: [] }, w: 0, h: 0 });
  });
  if (!cards.length) return;

  if (reduce) {                           // one static frame, then stop
    cards.forEach(function (c) { fit(c); c.ctx.setTransform(dpr,0,0,dpr,0,0); c.fn(c, 0.016, c.ctx); });
    return;
  }

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var c = cards.find(function (x) { return x.cvs === e.target; }); if (!c) return;
      var want = e.isIntersecting && e.intersectionRatio >= VIS;
      if (want === c.on) return;
      c.on = want;
      if (want) { fit(c); c.s = { a: [] }; }      // restart cleanly each time it comes into view
      if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    });
  }, { threshold: [0, VIS, 1] });
  cards.forEach(function (c) { io.observe(c.cvs); });
  addEventListener('resize', function () { cards.forEach(function (c) { if (c.on) fit(c); }); }, { passive: true });

  var last = 0;
  function tick(now) {
    var dt = Math.min(now - last, 50) / 1000; last = now;
    var any = false;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i]; if (!c.on) continue;
      any = true;
      if (!c.w) fit(c);
      var x = c.ctx;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, c.w, c.h);
      c.fn(c, dt, x);
    }
    if (any) requestAnimationFrame(tick); else running = false;
  }
})();
