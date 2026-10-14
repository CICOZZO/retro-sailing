/**
 * SAILING (1983 - DYNETRON) - LÓGICA DE JOGO, ETAPAS E STORYTELLING EXPANDIDO
 * Gerenciador de missões, diálogos de rádio, etapas e pontuação.
 */

class V1Game {
  constructor() {
    this.map = new V1Map();
    this.boat = new V1Boat();

    this.state = 'TITLE'; // 'TITLE', 'INSTRUCTIONS', 'LEG_INTRO', 'PLAYING', 'LEG_COMPLETE', 'GAMEOVER', 'VICTORY'
    this.currentInstruction = 'O'; // 'O', 'C', 'S', 'H', 'G', 'A'
    this.instructionPage = 0;

    this.leg = 1;
    this.isPractice = false;
    this.lives = 4;
    this.score = 0;
    this.elapsedTime = 0;

    // Vento da etapa (0° = sopra para o Norte / Cima)
    this.windDir = 20;
    this.windSpeed = 16;
    this.windShiftTimer = 0;

    // Mensagem de rádio temporária na tela (para os resgates narrativos)
    this.radioMessage = "";
    this.radioTimer = 0;
  }

  startCampaign() {
    this.isPractice = false;
    this.lives = 4;
    this.score = 0;
    this.leg = 1;
    this.startLeg(1);
  }

  startPractice() {
    this.isPractice = true;
    this.lives = 99;
    this.score = 0;
    this.leg = 1;
    this.startLeg(1);
  }

  showInstructions(key) {
    this.state = 'INSTRUCTIONS';
    if (key === 'A') {
      this.allInstructionsMode = true;
      this.currentInstruction = 'O';
    } else {
      this.allInstructionsMode = false;
      this.currentInstruction = key || 'O';
    }
    if (window.v1Audio) window.v1Audio.beepClick();
  }

  nextInstruction() {
    if (this.allInstructionsMode) {
      const order = ['O', 'C', 'S', 'H', 'G'];
      const idx = order.indexOf(this.currentInstruction);
      if (idx >= 0 && idx < order.length - 1) {
        this.currentInstruction = order[idx + 1];
        if (window.v1Audio) window.v1Audio.beepClick();
        return;
      }
    }
    this.state = 'TITLE';
    this.allInstructionsMode = false;
    if (window.v1Audio) window.v1Audio.beepClick();
  }

  startLeg(legNum) {
    this.leg = legNum;
    this.state = 'LEG_INTRO';
    this.elapsedTime = 0;
    this.radioMessage = "";
    this.map.setupLeg(legNum);

    // Posições de largada de cada etapa e ventos favoráveis da rota
    if (legNum === 1) {
      // Largada na costa de Miami rumo a Nordeste (60°)
      // Vento alísio de Sudeste (140°) - Través perfeito com vento forte!
      this.boat.reset(270, 430, 60);
      this.boat.speed = 2.4;
      this.boat.sailTrim = 42;
      this.windDir = 140;
      this.windSpeed = 18;
    } else if (legNum === 2) {
      // Largada em Hamilton (Bermudas) rumo ao Sul (190°)
      // Vento de Leste (85°) - Través com velocidade máxima!
      this.boat.reset(1300, 260, 190);
      this.boat.speed = 2.6;
      this.boat.sailTrim = 48;
      this.windDir = 85;
      this.windSpeed = 20;
    } else {
      // Largada em San Juan rumo a Noroeste (310°)
      // Vento de Leste-Sudeste (120°) - Alheta veloz!
      this.boat.reset(1120, 910, 310);
      this.boat.speed = 2.8;
      this.boat.sailTrim = 62;
      this.windDir = 120;
      this.windSpeed = 22;
    }

    if (window.v1Audio) window.v1Audio.legStart();
  }

  beginPlaying() {
    this.state = 'PLAYING';
    if (window.v1Audio) window.v1Audio.resume();
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.elapsedTime += dt;

    // Atualiza partículas de vento na água
    if (this.map.updateWindParticles) {
      this.map.updateWindParticles(dt, this.windDir, this.windSpeed);
    }

    // Atualiza som ambiente do vento e da água
    if (window.v1Audio && window.v1Audio.updateWind) {
      window.v1Audio.updateWind(this.windSpeed, this.boat.speed, this.boat.isLuffing);
    }

    // Temporizador de mensagem de rádio
    if (this.radioTimer > 0) {
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) this.radioMessage = "";
    }

    // Variação de vento
    this.windShiftTimer += dt;
    if (this.windShiftTimer > 15) {
      this.windShiftTimer = 0;
      this.windDir = (this.windDir + (Math.random() * 20 - 10) + 360) % 360;
    }

    // 1. Atualizar física do barco
    this.boat.update(dt, this.windDir, this.windSpeed);

    // 2. Atualizar perigos do mapa
    this.map.updateHazards(dt);

    // 3. Checagem de resgate de náufragos
    for (const s of this.map.swimmers) {
      if (!s.rescued) {
        const dx = s.x - this.boat.x;
        const dy = s.y - this.boat.y;
        if (dx * dx + dy * dy < 28 * 28) {
          s.rescued = true;
          this.score += 500;
          this.radioMessage = `SOS RESGATADO: "${s.lore}"`;
          this.radioTimer = 4.5;
          if (window.v1Audio) window.v1Audio.rescueDing();
        }
      }
    }

    // 4. Checagem de colisões com terra firme e recifes
    if (this.map.checkLandCollision(this.boat.x, this.boat.y)) {
      this.boat.damage = Math.min(100, this.boat.damage + 15 * dt);
      this.boat.speed = Math.max(0, this.boat.speed - 3 * dt);
      if (Math.random() < 0.2 && window.v1Audio) window.v1Audio.crashThud();
    }

    if (this.map.checkReefCollision(this.boat.x, this.boat.y)) {
      this.boat.damage = Math.min(100, this.boat.damage + 25 * dt);
      if (Math.random() < 0.15 && window.v1Audio) window.v1Audio.crashThud();
    }

    // 5. Checagem com perigos dinâmicos
    for (const h of this.map.hazards) {
      const dx = h.x - this.boat.x;
      const dy = h.y - this.boat.y;
      const distSq = dx * dx + dy * dy;

      if (h.type === 'shark' && distSq < 22 * 22) {
        this.boat.damage = Math.min(100, this.boat.damage + 12);
        this.radioMessage = "! ALERTA: ATAQUE DE TUBARÃO NO CASCO !";
        this.radioTimer = 2.5;
        if (window.v1Audio) window.v1Audio.crashThud();
      } else if (h.type === 'speedboat' && distSq < 30 * 30) {
        this.boat.damage = Math.min(100, this.boat.damage + 30);
        this.radioMessage = "! COLISÃO COM LANCHA DESGOVERNADA !";
        this.radioTimer = 2.5;
        if (window.v1Audio) window.v1Audio.crashThud();
      } else if (h.type === 'whirlwind' && distSq < h.r * h.r) {
        // Redemoinho dimensional: teletransporte!
        this.boat.x = 400 + Math.random() * 800;
        this.boat.y = 300 + Math.random() * 500;
        this.radioMessage = "*** SALTO ESPACIAL: ENGOLIDO PELO REDEMOINHO! ***";
        this.radioTimer = 4.0;
        if (window.v1Audio) window.v1Audio.whirlwindWarp();
      } else if (h.type === 'alien_anomaly' && distSq < h.r * h.r) {
        // Entidade cristalina: distorção eletromagnética
        this.score += 10;
        this.radioMessage = "☯ ENTIDADE CRISTALINA DETECTADA: SINAL TELEPÁTICO ☯";
        this.radioTimer = 2.0;
        if (Math.random() < 0.08 && window.v1Audio) window.v1Audio.alienChime();
      }
    }

    // Se dano chegar a 100%, perde uma vida
    if (this.boat.damage >= 100) {
      this.lives--;
      if (this.lives <= 0) {
        this.state = 'GAMEOVER';
        return;
      } else {
        // Reinicia a etapa
        this.startLeg(this.leg);
        return;
      }
    }

    // 6. Checagem de entrada no porto de chegada
    const currentPort = this.map.ports[this.leg];
    const pdx = (currentPort.x + currentPort.w / 2) - this.boat.x;
    const pdy = (currentPort.y + currentPort.h / 2) - this.boat.y;

    if (Math.abs(pdx) < currentPort.w && Math.abs(pdy) < currentPort.h) {
      // Chegou ao porto!
      const unrescued = this.map.swimmers.filter(s => !s.rescued).length;
      if (unrescued === 0 || this.isPractice) {
        this.completeLeg();
      } else {
        this.radioMessage = `AINDA RESTAM ${unrescued} NÁUFRAGOS NO MAR!`;
        this.radioTimer = 2.5;
      }
    }
  }

  completeLeg() {
    this.state = 'LEG_COMPLETE';
    // Bônus de tempo
    const timeBonus = Math.max(0, 300 - Math.floor(this.elapsedTime)) * 10;
    this.score += 2000 + timeBonus;

    if (window.v1Audio) window.v1Audio.portVictory();

    if (this.leg >= 3) {
      this.state = 'VICTORY';
    }
  }

  advanceToNextLeg() {
    if (this.leg < 3) {
      this.startLeg(this.leg + 1);
    } else {
      this.state = 'TITLE';
    }
  }
}

window.V1Game = V1Game;
