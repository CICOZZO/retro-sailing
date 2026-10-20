/**
 * SAILING (1982 - WIND PRODUCTIONS) - ENTRADA E LOOP PRINCIPAL
 *
 * Teclado numérico (ou a fileira de números):
 *   4/5/6 leme  7/8/9 folgar 2/5/10°  1/2/3 caçar 2/5/10°
 *   E motor  S som  P pausa  Q encerra  X sai
 * Alternativas sem teclado numérico: setas ←/→ (leme), ↑ caça, ↓ folga.
 *
 * O leme é de mola: só fica virado enquanto a tecla (ou a barra horizontal) é
 * segurada e volta ao meio ao soltar. A barra vertical da escota fica no último ajuste.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('v1GameCanvas');
  if (!canvas) return;

  const game = new V1Game();
  const renderer = new V1Renderer(canvas);
  window.v1Game = game;
  window.v1Renderer = renderer;

  const unlock = () => { if (window.v1Audio) window.v1Audio.resume(); };

  /** Aplica um comando de jogo, vindo do teclado ou dos botões na tela. */
  function press(k) {
    const s = game.state;

    if (s === 'TITLE') { game.anyKey(); return; }

    if (s === 'MENU') {
      switch (k) {
        case 'B': game.startGame(false); break;
        case 'P': game.startGame(true); break;
        case 'X': game.state = 'TITLE'; break;
        case 'A': case 'O': case 'C': case 'S': case 'H': case 'G': game.openInstructions(k); break;
      }
      return;
    }

    if (s === 'INSTRUCTIONS') {
      if (k === ' ' || k === 'ENTER') game.nextInstructionPage();
      return;
    }

    if (s === 'LEG_INTRO') {
      if (k === ' ' || k === 'ENTER') game.beginSailing();
      else if (k === 'Q') game.quit();
      return;
    }

    if (s === 'LEG_DONE') {
      if (k === ' ' || k === 'ENTER') game.nextLeg();
      return;
    }

    if (s === 'GAMEOVER') {
      if (k === ' ' || k === 'ENTER') game.state = 'MENU';
      return;
    }

    if (s === 'PLAYING') {
      switch (k) {
        case '7': game.sheetCmd(2); break;
        case '8': case 'ARROWDOWN': game.sheetCmd(5); break;
        case '9': game.sheetCmd(10); break;
        case '1': game.sheetCmd(-2); break;
        case '2': case 'ARROWUP': game.sheetCmd(-5); break;
        case '3': game.sheetCmd(-10); break;
        case 'E': game.toggleEngine(); break;
        case 'S': game.toggleSound(); break;
        case 'P': game.togglePause(); break;
        case 'Q': game.quit(); break;
        case 'X': game.state = 'TITLE'; break;
      }
    }
  }

  // ---------------------------------------------------------------- leme de mola
  // Fontes de comando: teclas seguradas e a barra horizontal. Soltando tudo, volta ao meio.
  const RUDDER_KEYS = { '4': -1, 'ARROWLEFT': -1, '6': 1, 'ARROWRIGHT': 1 };
  const heldRudderKeys = new Set();
  let sliderRudder = null;      // -1..+1 enquanto a barra horizontal está sendo arrastada

  function applyRudder() {
    if (sliderRudder !== null) { game.setRudder(sliderRudder); return; }
    let v = 0;
    for (const k of heldRudderKeys) v += RUDDER_KEYS[k];
    game.setRudder(Math.max(-1, Math.min(1, v)));
  }

  const keyName = (e) => {
    const k = (e.key || '').toUpperCase();
    return k === 'SPACEBAR' ? ' ' : k;
  };

  window.addEventListener('keydown', (e) => {
    unlock();
    const k = keyName(e);
    if (e.key && e.key.startsWith('Arrow')) e.preventDefault();
    if (k === ' ') e.preventDefault();
    if (k in RUDDER_KEYS) { heldRudderKeys.add(k); applyRudder(); return; }
    if (k === '5') { heldRudderKeys.clear(); applyRudder(); return; }
    press(k);
  });

  window.addEventListener('keyup', (e) => {
    const k = keyName(e);
    if (k in RUDDER_KEYS) { heldRudderKeys.delete(k); applyRudder(); }
  });

  window.addEventListener('blur', () => { heldRudderKeys.clear(); applyRudder(); });

  // ---------------------------------------------------------------- barras deslizantes
  /** Liga arrastar (mouse/toque) a uma barra; onValue recebe a fração 0..1 ao longo dela. */
  function dragBar(el, vertical, onValue, onRelease) {
    if (!el) return () => false;
    let dragging = false;
    const frac = (e) => {
      const r = el.getBoundingClientRect();
      const f = vertical ? (r.bottom - e.clientY) / r.height : (e.clientX - r.left) / r.width;
      return Math.max(0, Math.min(1, f));
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      unlock();
      dragging = true;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
      onValue(frac(e));
    });
    el.addEventListener('pointermove', (e) => { if (dragging) onValue(frac(e)); });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      if (onRelease) onRelease();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    return () => dragging;
  }

  // leme: barra horizontal, centro = leme a meio; solta -> volta ao meio
  const rudderBar = document.getElementById('v1RudderBar');
  const rudderThumb = document.getElementById('v1RudderThumb');
  const rudderLabel = document.getElementById('v1RudderLabel');
  const rudderDragging = dragBar(rudderBar, false,
    (f) => { sliderRudder = f * 2 - 1; applyRudder(); },
    () => { sliderRudder = null; applyRudder(); });

  // escota: barra vertical, embaixo 0° (toda caçada), em cima 90° (toda solta); fica onde parou
  const sheetBar = document.getElementById('v1SheetBar');
  const sheetThumb = document.getElementById('v1SheetThumb');
  const sheetFill = document.getElementById('v1SheetFill');
  const sheetLabel = document.getElementById('v1SheetLabel');
  dragBar(sheetBar, true, (f) => game.setSheet(V1_MIN_SHEET + f * (V1_MAX_SHEET - V1_MIN_SHEET)));

  /** Mostra nas barras o estado real do barco (teclado também mexe nelas). */
  function syncBars() {
    const b = game.boat;
    if (rudderThumb) {
      // arrastando: o polegar segue o dedo; solto: mostra a pá voltando ao meio
      const v = rudderDragging() && sliderRudder !== null ? sliderRudder : b.rudder / V1_MAX_RUDDER;
      rudderThumb.style.left = ((v + 1) / 2 * 100).toFixed(2) + '%';
      const deg = Math.round(b.rudder);
      rudderLabel.textContent = deg === 0 ? 'LEME 0°' : `LEME ${Math.abs(deg)}° ${deg < 0 ? 'BB' : 'BE'}`;
    }
    if (sheetThumb) {
      const f = (b.sheet - V1_MIN_SHEET) / (V1_MAX_SHEET - V1_MIN_SHEET);
      sheetThumb.style.bottom = (f * 100).toFixed(2) + '%';
      sheetFill.style.height = (f * 100).toFixed(2) + '%';
      sheetLabel.textContent = Math.round(b.sheet) + '°';
    }
  }

  // botões da barra rápida e do controle na tela
  const wire = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => { e.preventDefault(); unlock(); press(key); });
  };
  wire('btnV1Begin', 'B');
  wire('btnV1Practice', 'P');
  wire('btnV1Obj', 'O');
  wire('btnV1Controls', 'C');
  wire('btnV1Scoring', 'S');
  wire('btnV1Hazards', 'H');
  wire('btnV1Gauges', 'G');
  wire('btnV1Space', ' ');
  wire('v1PadEngine', 'E');

  // toque na tela avança menus
  canvas.addEventListener('pointerdown', () => {
    unlock();
    if (game.state === 'TITLE') press(' ');
    else if (['INSTRUCTIONS', 'LEG_INTRO', 'LEG_DONE', 'GAMEOVER'].includes(game.state)) press(' ');
  });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    game.update(dt);
    renderer.render(game);
    syncBars();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
