/**
 * SAILING (1982) - CONTROLES MOBILE
 * Liga os botões do menu, os dois controles deslizantes verticais
 * (leme à esquerda, escota da vela à direita) e o botão do motor.
 * Depende de v1-main.js (window.v1Game, window.v1Press).
 */

document.addEventListener('DOMContentLoaded', () => {
  const game = window.v1Game;
  if (!game) return;

  const unlock = () => { if (window.v1Audio) window.v1Audio.resume(); };

  // ---------------------------------------------------------- botões de tecla
  document.querySelectorAll('[data-key]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      unlock();
      window.v1Press(btn.dataset.key);
    });
  });

  // ---------------------------------------------------------- sliders
  /** Slider vertical. `topValue` é o valor no topo, `bottomValue` no fundo. */
  function makeSlider(el, topValue, bottomValue, onInput, snap) {
    const thumb = el.querySelector('.thumb');
    let dragging = false;
    let value = (topValue + bottomValue) / 2;

    const place = (v) => {
      const frac = (v - topValue) / (bottomValue - topValue);
      thumb.style.top = (Math.max(0, Math.min(1, frac)) * 100) + '%';
    };

    const fromPointer = (e) => {
      const r = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      let v = topValue + frac * (bottomValue - topValue);
      if (snap) v = snap(v);
      value = v;
      place(v);
      onInput(v);
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlock();
      dragging = true;
      el.setPointerCapture(e.pointerId);
      fromPointer(e);
    });
    el.addEventListener('pointermove', (e) => { if (dragging) { e.preventDefault(); fromPointer(e); } });
    const end = () => { dragging = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    place(value);
    return {
      set(v) { if (!dragging) { value = v; place(v); } },
      get value() { return value; },
      get dragging() { return dragging; }
    };
  }

  const rudder = makeSlider(
    document.getElementById('sliderRudder'), V1_MAX_RUDDER, -V1_MAX_RUDDER,
    (v) => game.setRudderAngle(v),
    (v) => (Math.abs(v) < 3 ? 0 : Math.round(v))
  );
  const sheet = makeSlider(
    document.getElementById('sliderSheet'), 0, 90,
    (v) => game.setSheetAngle(v),
    (v) => Math.round(v)
  );

  document.getElementById('btnCenter').addEventListener('click', (e) => {
    e.preventDefault();
    game.centerRudderCmd();
    rudder.set(0);
  });

  const engineBtn = document.getElementById('btnEngine');
  engineBtn.addEventListener('click', (e) => {
    e.preventDefault();
    unlock();
    game.toggleEngine();
  });

  // ---------------------------------------------------------- modo e sincronização
  const MODE = {
    TITLE: 'title', MENU: 'menu', INSTRUCTIONS: 'tap', LEG_INTRO: 'tap',
    PLAYING: 'play', LEG_DONE: 'tap', GAMEOVER: 'tap'
  };

  let lastState = null;
  function sync() {
    if (game.state !== lastState) {
      lastState = game.state;
      document.body.dataset.mode = MODE[game.state] || 'title';
      if (game.state === 'LEG_INTRO') { rudder.set(0); sheet.set(0); }
    }
    if (game.state === 'PLAYING') {
      rudder.set(game.reversed ? -game.boat.rudder : game.boat.rudder);
      sheet.set(game.boat.sheet);
      engineBtn.classList.toggle('on', game.boat.engine);
    }
    requestAnimationFrame(sync);
  }
  requestAnimationFrame(sync);

  // impede o zoom por gesto e o scroll elástico do iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
});
