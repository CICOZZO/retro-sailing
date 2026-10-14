/**
 * SAILING (1983 - DYNETRON COMPANY)
 * Input Handling, Main Loop & Responsive Canvas (Versão 1)
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('v1GameCanvas');
  if (!canvas) return;

  // Set internal resolution to exact 320x200 CGA
  canvas.width = 320;
  canvas.height = 200;

  const game = new V1Game();
  window.v1Game = game;
  const renderer = new V1Renderer(canvas);
  window.v1Renderer = renderer;

  const keys = {};

  // Audio activation helper on first interaction
  function unlockAudio() {
    if (window.v1Audio) window.v1Audio.resume();
  }

  // 1. Keyboard Input Handling
  window.addEventListener('keydown', (e) => {
    unlockAudio();
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
    const isT = keyUpper === 'T' || code === 'KeyT';
    const isM = keyUpper === 'M' || code === 'KeyM';

    // Telemetry HUD Toggle
    if (isT) {
      const active = renderer.toggleTelemetry();
      if (window.v1Audio) window.v1Audio.beepClick();
      return;
    }

    // Audio Mute Toggle
    if (isM) {
      if (window.v1Audio) window.v1Audio.toggleMute();
      return;
    }

    // State-specific actions
    if (game.state === 'TITLE') {
      if (isB || code === 'Space' || code === 'Enter') {
        game.startCampaign();
      } else if (isP) {
        game.startPractice();
      } else if (isX) {
        window.location.href = 'versao2.html';
      } else if (isA) {
        game.showInstructions('A');
      } else if (isO || isC || isS || isH || isG) {
        game.showInstructions(keyUpper);
      }
    } else if (game.state === 'INSTRUCTIONS') {
      if (code === 'Space' || code === 'Enter' || code === 'Escape' || isB) {
        game.nextInstruction();
      }
    } else if (game.state === 'LEG_INTRO') {
      game.beginPlaying();
    } else if (game.state === 'LEG_COMPLETE') {
      if (code === 'Space' || code === 'Enter') {
        game.advanceToNextLeg();
      }
    } else if (game.state === 'VICTORY' || game.state === 'GAMEOVER') {
      if (code === 'Space' || code === 'Enter' || code === 'Escape') {
        game.state = 'TITLE';
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // 2. Mouse / Touch on Canvas
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 320 / rect.width;
    const scaleY = 200 / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  canvas.addEventListener('click', (e) => {
    unlockAudio();
    const pt = getCanvasCoords(e);

    if (game.state === 'TITLE') {
      const opt = renderer.getMenuOptionAt(pt.x, pt.y);
      if (opt === 'B') game.startCampaign();
      else if (opt === 'P') game.startPractice();
      else if (opt === 'T') renderer.toggleTelemetry();
      else if (opt === 'A') game.showInstructions('A');
      else if (opt) game.showInstructions(opt);
      else if (pt.x <= 192) game.startCampaign();
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
      canvas.style.cursor = (opt || pt.x <= 192) ? 'pointer' : 'default';
      renderer.hoveredMenuOption = opt;
    } else if (game.state !== 'PLAYING') {
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

  // 3. Continuous Rudder & Sheet Control
  function processInputs(dt) {
    if (game.state !== 'PLAYING') return;

    const boat = game.boat;

    // Rudder (Port / Starboard)
    if (keys['ArrowLeft'] || keys['KeyA']) {
      boat.rudderAngle = -1;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
      boat.rudderAngle = 1;
    } else {
      boat.rudderAngle = 0;
    }

    // Sail Sheet (Trim in / Ease out)
    const sheetSpeed = 38.0 * dt;
    if (keys['ArrowUp'] || keys['KeyW']) {
      const old = boat.sheetAngle;
      boat.sheetAngle = Math.max(10, boat.sheetAngle - sheetSpeed);
      if (Math.abs(old - boat.sheetAngle) > 1.2 && Math.random() < 0.25 && window.v1Audio) {
        window.v1Audio.sheetClick();
      }
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      const old = boat.sheetAngle;
      boat.sheetAngle = Math.min(85, boat.sheetAngle + sheetSpeed);
      if (Math.abs(old - boat.sheetAngle) > 1.2 && Math.random() < 0.25 && window.v1Audio) {
        window.v1Audio.sheetClick();
      }
    }
  }

  // 4. Quick Action Bar Buttons in DOM
  function setupKeyBtn(btnId, code, keyChar) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      unlockAudio();

      if (keyChar === 'B') {
        if (game.state === 'TITLE' || game.state === 'INSTRUCTIONS') game.startCampaign();
        else if (game.state === 'LEG_INTRO') game.beginPlaying();
        else if (game.state === 'VICTORY' || game.state === 'GAMEOVER') game.startCampaign();
      } else if (keyChar === 'P') {
        if (game.state === 'TITLE' || game.state === 'INSTRUCTIONS') game.startPractice();
        else if (game.state === 'LEG_INTRO') game.beginPlaying();
      } else if (keyChar === 'T') {
        renderer.toggleTelemetry();
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
  setupKeyBtn('btnV1Telemetry', null, 'T');
  setupKeyBtn('btnV1Space', 'Space', null);

  // 5. Touch / D-Pad Buttons in DOM
  function setupTouchDpad(id, pressCode) {
    const el = document.getElementById(id);
    if (!el) return;

    const onStart = (e) => {
      e.preventDefault();
      unlockAudio();
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

  // 6. Main Game Loop
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000.0);
    lastTime = now;

    processInputs(dt);
    game.update(dt);
    renderer.render(game, dt);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});
