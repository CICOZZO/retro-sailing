/**
 * SAILING (1986) - LÓGICA DE JOGO E MISSÕES
 * Gerencia a Regata da Taça e o Resgate no Triângulo das Bermudas.
 */

class SailingGame {
  constructor() {
    this.player = new BoatPhysics();
    this.mode = 'regatta'; // 'regatta' ou 'bermuda'
    this.state = 'TITLE';  // 'TITLE', 'PLAYING', 'HELP', 'ENDED'
    this.time = 0;
    this.elapsedTime = 0;
    this.score = 0;

    // Condições Meteorológicas
    this.windDir = 0;      // 0° = Vento soprando do Norte
    this.windSpeed = 16.0; // 16 nós de vento constante
    this.windShiftTimer = 0;

    // Elementos da Regata
    this.buoys = [];
    this.currentBuoyIndex = 0;
    this.rival = null;

    // Elementos do Resgate
    this.survivors = [];
  }

  /**
   * Inicializa uma nova partida no modo selecionado
   */
  startMode(modeName) {
    this.mode = modeName;
    this.state = 'PLAYING';
    this.time = 0;
    this.elapsedTime = 0;
    this.score = 0;
    this.player.reset();

    // Vento padrão: Soprando do Norte (0°) a 16 nós
    this.windDir = 0;
    this.windSpeed = 16.0;

    if (this.mode === 'regatta') {
      this.initRegattaCourse();
    } else {
      this.initBermudaCourse();
    }

    if (window.retroAudio) {
      window.retroAudio.resume();
      window.retroAudio.beep(587.33, 0.15, 'square'); // D5 início
    }
  }

  /**
   * Configura o percurso olímpico da Regata (America's Cup)
   */
  initRegattaCourse() {
    // Barco começa voltado para Nordeste (45°)
    this.player.heading = 45;
    this.player.x = 0;
    this.player.z = -20;
    this.player.sailTrim = 35;

    // 4 Bóias compondo um percurso náutico real:
    // Bóia 1: Ao Norte (contravento direto - exige zigue-zague/bordos)
    // Bóia 2: A Sudeste (través veloz)
    // Bóia 3: Ao Sul (popa/alheta)
    // Bóia 4: Perto da largada (chegada)
    this.buoys = [
      { x: 0, z: 120 },     // Bóia 1 (Contravento)
      { x: 90, z: 40 },     // Bóia 2 (Través)
      { x: 30, z: -80 },    // Bóia 3 (Alheta/Popa)
      { x: -10, z: -10 }    // Bóia 4 (Linha de Chegada)
    ];
    this.currentBuoyIndex = 0;

    // Barco Rival (Austrália II)
    this.rival = {
      x: 15,
      z: -25,
      heading: 40,
      speed: 0,
      sailAngle: -0.6,
      targetBuoyIndex: 0
    };
  }

  /**
   * Configura o cenário de resgate do Triângulo das Bermudas
   */
  initBermudaCourse() {
    this.player.heading = 90;
    this.player.x = 0;
    this.player.z = 0;
    this.player.sailTrim = 45;

    this.buoys = null;
    this.rival = null;

    // 6 Náufragos em balsas espalhados pela região
    this.survivors = [
      { x: -60, z: 70, rescued: false },
      { x: 80, z: 110, rescued: false },
      { x: 120, z: -40, rescued: false },
      { x: -90, z: -80, rescued: false },
      { x: 20, z: 160, rescued: false },
      { x: -120, z: 30, rescued: false }
    ];
  }

  /**
   * Atualização frame-a-frame da lógica
   */
  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.time += dt;
    this.elapsedTime += dt;

    // Mudança sutil e gradual no vento a cada ~20 segundos
    this.windShiftTimer += dt;
    if (this.windShiftTimer > 18) {
      this.windShiftTimer = 0;
      // Variação de até +- 10 graus
      this.windDir = (this.windDir + (Math.random() * 16 - 8) + 360) % 360;
    }

    // Atualização da física do barco do jogador
    this.windInfo = this.player.update(dt, this.windDir, this.windSpeed);

    // Efeitos sonoros contínuos (vento e alerta de "em ferro")
    if (window.retroAudio) {
      window.retroAudio.updateWindSound(this.player.speed / 16.0);
      if (this.player.isLuffing) {
        window.retroAudio.startInIronsAlarm();
      } else {
        window.retroAudio.stopInIronsAlarm();
      }
    }

    // Lógica do Modo Regata
    if (this.mode === 'regatta') {
      this.updateRegatta(dt);
    } else {
      this.updateBermuda(dt);
    }
  }

  /**
   * Atualiza as checagens da Regata
   */
  updateRegatta(dt) {
    // 1. Checagem de passagem na bóia atual do jogador
    const targetBuoy = this.buoys[this.currentBuoyIndex];
    const dx = targetBuoy.x - this.player.x;
    const dz = targetBuoy.z - this.player.z;
    const distToBuoy = Math.sqrt(dx * dx + dz * dz);

    if (distToBuoy < 14.0) {
      // Contornou a bóia com sucesso!
      if (window.retroAudio) window.retroAudio.buoyRoundSound();
      this.currentBuoyIndex++;

      if (this.currentBuoyIndex >= this.buoys.length) {
        // Concluiu todas as bóias da regata!
        this.endGame(true, `VOCÊ VENCEU A REGATA DA TAÇA!\nTEMPO TOTAL: ${this.formatTime(this.elapsedTime)}`);
        return;
      }
    }

    // 2. IA do Barco Rival
    if (this.rival) {
      const rivalTarget = this.buoys[this.rival.targetBuoyIndex];
      const rdx = rivalTarget.x - this.rival.x;
      const rdz = rivalTarget.z - this.rival.z;
      const rdist = Math.sqrt(rdx * rdx + rdz * rdz);

      // Ângulo para a bóia
      let desiredHeading = (Math.atan2(rdx, rdz) * (180 / Math.PI) + 360) % 360;

      // Se a bóia estiver contra o vento, a IA faz bordo (tack) em 45°
      let angleToWind = Math.abs(desiredHeading - this.windDir);
      while (angleToWind > 180) angleToWind -= 360;
      if (Math.abs(angleToWind) < 40) {
        desiredHeading = (this.windDir + (this.time % 12 > 6 ? 45 : -45) + 360) % 360;
      }

      // Vira suavemente em direção ao rumo desejado
      let diff = desiredHeading - this.rival.heading;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      this.rival.heading = (this.rival.heading + Math.sign(diff) * Math.min(Math.abs(diff), 25 * dt) + 360) % 360;

      // Velocidade moderada do rival
      this.rival.speed = Math.min(10.5, this.rival.speed + 1.2 * dt);
      const rHeadRad = this.rival.heading * (Math.PI / 180);
      this.rival.x += Math.sin(rHeadRad) * (this.rival.speed * 0.8) * dt;
      this.rival.z += Math.cos(rHeadRad) * (this.rival.speed * 0.8) * dt;

      if (rdist < 14.0) {
        this.rival.targetBuoyIndex++;
        if (this.rival.targetBuoyIndex >= this.buoys.length) {
          // Rival cruzou a linha antes!
          this.endGame(false, `O BARCO RIVAL VENCEU A REGATA!\nTEMPO DO ADVERSÁRIO: ${this.formatTime(this.elapsedTime)}`);
        }
      }
    }
  }

  /**
   * Atualiza as checagens do Triângulo das Bermudas
   */
  updateBermuda(dt) {
    let allRescued = true;

    this.survivors.forEach(s => {
      if (!s.rescued) {
        allRescued = false;
        const dx = s.x - this.player.x;
        const dz = s.z - this.player.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Se chegar a menos de 10 metros da balsa, resgata o náufrago!
        if (dist < 10.0) {
          s.rescued = true;
          this.score += 500;
          if (window.retroAudio) window.retroAudio.rescueSound();
        }
      }
    });

    if (allRescued) {
      this.endGame(true, `TODOS OS NÁUFRAGOS FORAM RESGATADOS!\nPONTUAÇÃO TOTAL: ${this.score} PONTOS`);
    }
  }

  formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  endGame(isVictory, message) {
    this.state = 'ENDED';
    if (window.retroAudio) {
      window.retroAudio.stopInIronsAlarm();
      if (isVictory) {
        window.retroAudio.rescueSound();
      } else {
        window.retroAudio.beep(160, 0.4, 'sawtooth');
      }
    }

    const modal = document.getElementById('endGameModal');
    const title = document.getElementById('endGameTitle');
    const msg = document.getElementById('endGameMessage');
    const stats = document.getElementById('endGameStats');

    if (modal && title && msg && stats) {
      title.innerText = isVictory ? "=== VITÓRIA NÁUTICA ===" : "=== FIM DE PROVA ===";
      msg.innerText = message;
      stats.innerHTML = `TEMPO DE NAVEGAÇÃO: ${this.formatTime(this.elapsedTime)}<br>VELOCIDADE MÁXIMA REGISTRADA: ${this.player.speed.toFixed(1)} NÓS`;
      modal.classList.remove('hidden');
    }
  }
}
