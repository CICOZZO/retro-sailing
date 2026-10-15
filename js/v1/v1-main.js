/**
 * SAILING (1982 - WIND PRODUCTIONS) - ENTRADA E LOOP PRINCIPAL
 *
 * Teclado numérico (ou a fileira de números):
 *   4/5/6 leme  7/8/9 folgar 2/5/10°  1/2/3 caçar 2/5/10°
 *   E motor  S som  P pausa  Q encerra  X sai
 * Alternativas sem teclado numérico: setas ←/→ (leme), ↑ caça, ↓ folga.
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
        case '4': case 'ARROWLEFT': game.rudderCmd(-1); break;
        case '6': case 'ARROWRIGHT': game.rudderCmd(1); break;
        case '5': game.centerRudderCmd(); break;
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

  window.addEventListener('keydown', (e) => {
    unlock();
    let k = (e.key || '').toUpperCase();
    if (k === 'SPACEBAR') k = ' ';
    if (e.key && e.key.startsWith('Arrow')) e.preventDefault();
    if (k === ' ') e.preventDefault();
    press(k);
  });

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
  wire('v1PadLeft', '4');
  wire('v1PadCenter', '5');
  wire('v1PadRight', '6');
  wire('v1PadIn', '2');
  wire('v1PadOut', '8');
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
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});
