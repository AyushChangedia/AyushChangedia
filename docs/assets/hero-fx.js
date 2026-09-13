/* Fires the venom takeover once the intro animation has cleared the hero. */
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
  function go() { btn.classList.add('venom-go'); }

  (function wait() {
    // fall through after 12s so a stalled intro can never withhold the effect
    if (!introBusy() || Date.now() - started > 12000) setTimeout(go, 1500);
    else setTimeout(wait, 200);
  })();
})();
