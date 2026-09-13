/* Symbiote takeover: waits for the intro to clear the hero, pauses, then
   runs once. Also feeds cursor position to the hover ripple. */
(function () {
  var btn = document.querySelector('.fx-venom');
  if (!btn) return;

  var root = document.documentElement;
  var PI = ['pi-armed', 'pi-prep', 'pi-hold', 'pi-dim', 'pi-fly'];
  var started = Date.now();

  function introBusy() {
    for (var i = 0; i < PI.length; i++) if (root.classList.contains(PI[i])) return true;
    return false;
  }

  function run() {
    btn.classList.add('vn-go');
    // main crawl 2.1s + a short settle before the gloss lands
    setTimeout(function () { btn.classList.add('vn-done'); }, 2400);
  }

  (function wait() {
    // 12s failsafe so a stalled intro can never withhold the effect
    if (!introBusy() || Date.now() - started > 12000) setTimeout(run, 3200);
    else setTimeout(wait, 200);
  })();

  // ripple follows the cursor; rAF-throttled, writes two custom properties only
  var pending = false, mx = 0, my = 0;
  btn.addEventListener('mousemove', function (e) {
    var r = btn.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      btn.style.setProperty('--mx', mx + 'px');
      btn.style.setProperty('--my', my + 'px');
      pending = false;
    });
  });
})();
