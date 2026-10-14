/**
 * SAILING (1983 - DYNETRON) - ENTRADA PRINCIPAL E CONTROLES (VERSÃO 1)
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('v1GameCanvas');
  if (!canvas) return;

  const game = new V1Game();
  window.v1Game = game;
  const renderer = new V1Renderer(canvas);

  const keys = {};

  // 1. Escuta de Teclado
  window.addEventListener('keydown', (e) => {
    if (window.v1Audio) window.v1Audio.resume();

    keys[e.code] = true;
    const keyUpper = (e.key || '').toUpperCase();
    const code = e.code;

    const isB = keyUpper === 'B' || code === 'KeyB';
    const isP = keyUpper === 'P' || code === 'KeyP';
    const isX = keyUpper === 'X' || code === 'KeyX';
    const isO = keyUpper === 'O' || code === 'KeyO';
    const isC = keyUpper === 'C' || code === 'KeyC';
    const isS = keyUpper === 'S' || code === 'KeyS';
    const isH = keyUpper === 'H' || code === 'KeyH';
    const isG = keyUpper === 'G' || code === 'KeyG';
    const isA = keyUpper === 'A' || code === 'KeyA';

    // Comandos de Menu (da Foto 5)
    if (game.state === 'TITLE') {
      if (isB) {
        game.startCampaign();
      } else if (isP) {
        game.startPractice();
      } else if (isX) {
        window.location.href = 'versao2.html';
      } else if (isA) {
        game.showInstructions('A');
      } else if (isO || isC || isS || isH || isG) {
        game.showInstructions(keyUpper);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        game.startCampaign();
      }
    } else if (game.state === 'INSTRUCTIONS') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape' || isB) {
        game.nextInstruction();
      }
    } else if (game.state === 'LEG_INTRO') {
      // Qualquer tecla avança imediatamente para jogar
      game.beginPlaying();
    } else if (game.state === 'LEG_COMPLETE') {
      if (e.code === 'Space' || e.code === 'Enter') {
        game.advanceToNextLeg();
      }
    } else if (game.state === 'VICTORY' || game.state === 'GAMEOVER') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        game.state = 'TITLE';
      }
    }

    if (e.code === 'KeyM') {
      if (window.v1Audio) window.v1Audio.toggleMute();
    }
  });

  // Mapeamento de cliques do mouse diretamente sobre a tela do jogo (Canvas)
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('click', (e) => {
    if (window.v1Audio) window.v1Audio.resume();
    const pt = getCanvasCoords(e);

    if (game.state === 'TITLE') {
      const opt = renderer.getMenuOptionAt(pt.x, pt.y);
      if (opt === 'B') {
        game.startCampaign();
      } else if (opt === 'P') {
        game.startPractice();
      } else if (opt === 'X') {
        window.location.href = 'versao2.html';
      } else if (opt === 'A') {
        game.showInstructions('A');
      } else if (opt) {
        game.showInstructions(opt);
      } else {
        // Se clicar em qualquer lugar do quadrante esquerdo, inicia a campanha
        if (pt.x <= 394) {
          game.startCampaign();
        }
      }
    } else if (game.state === 'INSTRUCTIONS') {
      game.nextInstruction();
    } else if (game.state === 'LEG_INTRO') {
      game.beginPlaying();
    } else if (game.state === 'LEG_COMPLETE') {
      game.advanceToNextLeg();
    } else if (game.state === 'VICTORY' || game.state === 'GAMEOVER') {
      game.state = 'TITLE';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const pt = getCanvasCoords(e);
    if (game.state === 'TITLE') {
      const opt = renderer.getMenuOptionAt(pt.x, pt.y);
      canvas.style.cursor = (opt || pt.x <= 394) ? 'pointer' : 'default';
      renderer.hoveredMenuOption = opt;
    } else if (game.state === 'LEG_INTRO' || game.state === 'INSTRUCTIONS' || game.state === 'LEG_COMPLETE') {
      canvas.style.cursor = 'pointer';
      renderer.hoveredMenuOption = null;
    } else {
      canvas.style.cursor = 'default';
      renderer.hoveredMenuOption = null;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    renderer.hoveredMenuOption = null;
    canvas.style.cursor = 'default';
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // 2. Controle Contínuo de Leme e Vela
  function processInputs(dt) {
    if (game.state !== 'PLAYING') return;

    const boat = game.boat;

    // Leme (Esquerda / Direita)
    if (keys['ArrowLeft'] || keys['KeyA']) {
      boat.rudderAngle = -1;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      boat.rudderAngle = 1;
    } else {
      boat.rudderAngle = 0;
    }

    // Regulagem da Vela (Caçar / Filar)
    const trimSpeed = 45.0 * dt;
    if (keys['ArrowUp'] || keys['KeyW']) {
      boat.sailTrim = Math.max(8, boat.sailTrim - trimSpeed);
      if (Math.random() < 0.2 && window.v1Audio) window.v1Audio.beepClick();
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      boat.sailTrim = Math.min(85, boat.sailTrim + trimSpeed);
      if (Math.random() < 0.2 && window.v1Audio) window.v1Audio.beepClick();
    }
  }

  // 3. Controles On-Screen / Touch para facilitar
  function setupKeyBtn(btnId, code, keyChar) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.v1Audio) window.v1Audio.resume();

      if (keyChar === 'B') {
        if (game.state === 'TITLE' || game.state === 'INSTRUCTIONS') {
          game.startCampaign();
        } else if (game.state === 'LEG_INTRO') {
          game.beginPlaying();
        } else if (game.state === 'VICTORY' || game.state === 'GAMEOVER') {
          game.startCampaign();
        }
      } else if (keyChar === 'P') {
        if (game.state === 'TITLE' || game.state === 'INSTRUCTIONS') {
          game.startPractice();
        } else if (game.state === 'LEG_INTRO') {
          game.beginPlaying();
        }
      } else if (keyChar) {
        game.showInstructions(keyChar);
      } else if (code === 'Space') {
        if (game.state === 'TITLE') game.startCampaign();
        else if (game.state === 'INSTRUCTIONS') game.nextInstruction();
        else if (game.state === 'LEG_INTRO') game.beginPlaying();
        else if (game.state === 'LEG_COMPLETE') game.advanceToNextLeg();
        else if (game.state === 'VICTORY' || game.state === 'GAMEOVER') game.state = 'TITLE';
      }
    });
  }

  setupKeyBtn('btnV1Begin', null, 'B');
  setupKeyBtn('btnV1Practice', null, 'P');
  setupKeyBtn('btnV1Obj', null, 'O');
  setupKeyBtn('btnV1Hazards', null, 'H');
  setupKeyBtn('btnV1Controls', null, 'C');
  setupKeyBtn('btnV1Space', 'Space', null);

  // Botões de D-Pad de toque
  function setupTouchDpad(id, pressCode) {
    const el = document.getElementById(id);
    if (!el) return;

    const onStart = (e) => {
      e.preventDefault();
      if (window.v1Audio) window.v1Audio.resume();
      keys[pressCode] = true;
    };
    const onEnd = (e) => {
      e.preventDefault();
      keys[pressCode] = false;
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('mousedown', onStart);
    el.addEventListener('mouseup', onEnd);
    el.addEventListener('mouseleave', onEnd);
  }

  setupTouchDpad('v1PadLeft', 'ArrowLeft');
  setupTouchDpad('v1PadRight', 'ArrowRight');
  setupTouchDpad('v1PadUp', 'ArrowUp');
  setupTouchDpad('v1PadDown', 'ArrowDown');

  // 4. Loop Principal
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000.0);
    lastTime = now;

    processInputs(dt);
    game.update(dt);
    renderer.render(game);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});
