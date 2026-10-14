/**
 * SAILING (1986) - ENTRADA PRINCIPAL, CONTROLES E LOOP DE ANIMAÇÃO
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new SailingGame();
  const renderer = new RetroRenderer(canvas);

  // Estado das teclas pressionadas
  const keys = {};

  // 1. Ouvintes de Teclado
  window.addEventListener('keydown', (e) => {
    // Inicia o contexto de áudio na primeira interação
    if (window.retroAudio) window.retroAudio.resume();

    keys[e.code] = true;

    // Atalhos globais
    if (e.code === 'Tab') {
      e.preventDefault();
      toggleLayout();
    }
    if (e.code === 'KeyV') {
      renderer.cameraMode = (renderer.cameraMode + 1) % 2;
      if (window.retroAudio) window.retroAudio.clickSound();
    }
    if (e.code === 'KeyR') {
      if (game.state === 'PLAYING') {
        game.startMode(game.mode);
      }
    }
    if (e.code === 'KeyM') {
      toggleAudio();
    }
    if (e.code === 'KeyC') {
      cyclePalette();
    }
    if (e.code === 'KeyH') {
      toggleHelp();
    }
    if (e.code === 'Digit1') {
      if (game.state === 'TITLE' || game.state === 'ENDED') {
        startGame('regatta');
      }
    }
    if (e.code === 'Digit2') {
      if (game.state === 'TITLE' || game.state === 'ENDED') {
        startGame('bermuda');
      }
    }
    if (e.code === 'Space') {
      if (game.state === 'TITLE') {
        startGame('regatta');
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // 2. Controle Contínuo de Leme e Vela
  function processInputs(dt) {
    if (game.state !== 'PLAYING') return;

    const boat = game.player;

    // Leme (Esquerda / Direita)
    let rudderInput = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) rudderInput -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) rudderInput += 1;
    boat.rudder = rudderInput;

    // Regulagem da Vela (Caçar / Filar)
    const trimSpeed = 38.0; // graus por segundo
    if (keys['ArrowUp'] || keys['KeyW']) {
      boat.sailTrim = Math.max(8.0, boat.sailTrim - trimSpeed * dt);
      if (Math.random() < 0.15 && window.retroAudio) window.retroAudio.clickSound();
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      boat.sailTrim = Math.min(85.0, boat.sailTrim + trimSpeed * dt);
      if (Math.random() < 0.15 && window.retroAudio) window.retroAudio.clickSound();
    }
  }

  // 3. Controles Touch na Tela
  function setupTouchBtn(btnId, keyCode) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const start = (e) => {
      e.preventDefault();
      if (window.retroAudio) window.retroAudio.resume();
      keys[keyCode] = true;
    };
    const end = (e) => {
      e.preventDefault();
      keys[keyCode] = false;
    };

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend', end, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }

  setupTouchBtn('tLeft', 'ArrowLeft');
  setupTouchBtn('tRight', 'ArrowRight');
  setupTouchBtn('tUp', 'ArrowUp');
  setupTouchBtn('tDown', 'ArrowDown');

  // 4. Interface e Botões de Gabinete
  const titleScreen = document.getElementById('titleScreen');
  const helpModal = document.getElementById('helpModal');
  const endGameModal = document.getElementById('endGameModal');

  function startGame(mode) {
    titleScreen.classList.add('hidden');
    helpModal.classList.add('hidden');
    endGameModal.classList.add('hidden');
    game.startMode(mode);
  }

  document.getElementById('btnModeRegatta').addEventListener('click', () => startGame('regatta'));
  document.getElementById('btnModeBermuda').addEventListener('click', () => startGame('bermuda'));

  document.getElementById('btnHelp').addEventListener('click', () => {
    helpModal.classList.remove('hidden');
    if (window.retroAudio) window.retroAudio.clickSound();
  });

  document.getElementById('btnCloseHelp').addEventListener('click', () => {
    helpModal.classList.add('hidden');
    if (window.retroAudio) window.retroAudio.clickSound();
  });

  document.getElementById('btnRestartGame').addEventListener('click', () => {
    endGameModal.classList.add('hidden');
    startGame(game.mode);
  });

  document.getElementById('btnMenuReturn').addEventListener('click', () => {
    endGameModal.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    game.state = 'TITLE';
    if (window.retroAudio) window.retroAudio.clickSound();
  });

  // Alternância de Paletas de Fósforo
  const palettes = ['green', 'amber', 'white', 'cga'];
  let currentPaletteIdx = 0;

  function setPalette(paletteName) {
    document.body.className = `palette-${paletteName} ${document.body.classList.contains('crt-active') ? 'crt-active' : ''}`;
    renderer.setPalette(paletteName);

    ['Green', 'Amber', 'White', 'Cga'].forEach(p => {
      const btn = document.getElementById(`palette${p}`);
      if (btn) {
        if (p.toLowerCase() === paletteName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    currentPaletteIdx = palettes.indexOf(paletteName);
    if (window.retroAudio) window.retroAudio.clickSound();
  }

  function cyclePalette() {
    currentPaletteIdx = (currentPaletteIdx + 1) % palettes.length;
    setPalette(palettes[currentPaletteIdx]);
  }

  document.getElementById('paletteGreen').addEventListener('click', () => setPalette('green'));
  document.getElementById('paletteAmber').addEventListener('click', () => setPalette('amber'));
  document.getElementById('paletteWhite').addEventListener('click', () => setPalette('white'));
  document.getElementById('paletteCga').addEventListener('click', () => setPalette('cga'));

  // Toggle de Scanlines
  const btnScanlines = document.getElementById('btnToggleScanlines');
  btnScanlines.addEventListener('click', () => {
    document.body.classList.toggle('crt-active');
    const isActive = document.body.classList.contains('crt-active');
    btnScanlines.innerText = `SCANLINES: ${isActive ? 'ON' : 'OFF'}`;
    if (window.retroAudio) window.retroAudio.clickSound();
  });

  // Toggle de Áudio
  const btnAudio = document.getElementById('btnToggleAudio');
  function toggleAudio() {
    if (window.retroAudio) {
      const enabled = window.retroAudio.toggleMute();
      btnAudio.innerText = `SOM: ${enabled ? 'ON' : 'OFF'}`;
      if (enabled) window.retroAudio.clickSound();
    }
  }
  btnAudio.addEventListener('click', toggleAudio);

  // Toggle de Layout (Painel Dividido / 3D Total)
  const btnLayout = document.getElementById('btnToggleLayout');
  function toggleLayout() {
    const mode = renderer.toggleLayoutMode();
    if (btnLayout) {
      btnLayout.innerText = mode === 'split' ? 'VISÃO: DIVIDIDA [TAB]' : 'VISÃO: 3D TOTAL [TAB]';
    }
    if (window.retroAudio) window.retroAudio.clickSound();
  }
  if (btnLayout) btnLayout.addEventListener('click', toggleLayout);

  // Toggle de Câmera
  document.getElementById('btnToggleCamera').addEventListener('click', () => {
    renderer.cameraMode = (renderer.cameraMode + 1) % 2;
    if (window.retroAudio) window.retroAudio.clickSound();
  });

  // Botão Reiniciar
  document.getElementById('btnResetCourse').addEventListener('click', () => {
    if (game.state === 'PLAYING') {
      game.startMode(game.mode);
    }
  });

  function toggleHelp() {
    helpModal.classList.toggle('hidden');
    if (window.retroAudio) window.retroAudio.clickSound();
  }

  // 5. Loop de Renderização Principal (60 FPS)
  let lastTime = performance.now();

  function gameLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000.0);
    lastTime = now;

    // Processamento de entrada do jogador
    processInputs(dt);

    // Atualização da física e missão
    game.update(dt);

    // Renderização vetorial dos pontos e traços
    renderer.render(game);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});
