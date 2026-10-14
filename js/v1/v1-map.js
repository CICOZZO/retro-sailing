/**
 * SAILING (1983 - DYNETRON) - MAPA DO TRIÂNGULO DAS BERMUDAS E ANOMALIAS
 * Geografia em blocos CGA verdes, náufragos, recifes e perigos sobrenaturais.
 */

class V1Map {
  constructor() {
    this.width = 1600;
    this.height = 1200;

    // Definição das Ilhas e Litoral em blocos verdes CGA (x, y, w, h)
    this.islands = [
      // 1. Costa da Flórida (Oeste / Esquerda)
      { x: 0, y: 0, w: 220, h: 500, name: "Flórida" },
      { x: 180, y: 400, w: 120, h: 180, name: "Miami Beach" },
      { x: 220, y: 520, w: 80, h: 140, name: "Florida Keys" },

      // 2. Arquipélago das Bahamas (Centro-Oeste)
      { x: 420, y: 460, w: 140, h: 80, name: "Grand Bahama" },
      { x: 520, y: 540, w: 90, h: 90, name: "Nassau / New Providence" },
      { x: 480, y: 650, w: 160, h: 70, name: "Andros Island" },
      { x: 620, y: 700, w: 130, h: 60, name: "Exuma Cays" },

      // 3. Arquipélago das Bermudas (Nordeste / Topo Direito)
      { x: 1320, y: 140, w: 160, h: 110, name: "Bermuda / St. George" },
      { x: 1300, y: 220, w: 110, h: 80, name: "Hamilton Island" },

      // 4. Cuba e Caribe (Sul / Centro-Inferior)
      { x: 260, y: 920, w: 580, h: 180, name: "Cuba" },

      // 5. Porto Rico / San Juan (Sudeste / Fossa das Bermudas)
      { x: 1120, y: 940, w: 260, h: 110, name: "Porto Rico (San Juan)" },
      { x: 1390, y: 960, w: 100, h: 70, name: "Ilhas Virgens" }
    ];

    // Recifes perigosos (pequenos blocos de pedra)
    this.reefs = [
      { x: 380, y: 320, r: 24 },
      { x: 680, y: 380, r: 20 },
      { x: 890, y: 280, r: 22 },
      { x: 1180, y: 420, r: 25 },
      { x: 940, y: 680, r: 28 },
      { x: 780, y: 840, r: 22 }
    ];

    // Portos de Destino de cada Etapa
    this.ports = {
      1: { x: 1310, y: 230, w: 50, h: 50, name: "Porto de Hamilton (Bermudas)" },
      2: { x: 1130, y: 930, w: 50, h: 50, name: "Porto de San Juan (Porto Rico)" },
      3: { x: 210, y: 460, w: 50, h: 50, name: "Porto de Miami (Flórida)" }
    };

    this.swimmers = [];
    this.hazards = [];
    this.initWindParticles();
    this.setupLeg(1);
  }

  initWindParticles() {
    this.windParticles = [];
    for (let i = 0; i < 65; i++) {
      this.windParticles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        len: 5 + Math.random() * 8,
        speedMult: 0.7 + Math.random() * 0.6
      });
    }
  }

  updateWindParticles(dt, windDir, windSpeed) {
    // Vento sopra DE windDir PARA (windDir + 180)
    const blowRad = ((windDir + 180) % 360) * (Math.PI / 180);
    const pSpeed = windSpeed * 2.8;
    const vx = Math.sin(blowRad) * pSpeed;
    const vy = -Math.cos(blowRad) * pSpeed;

    for (const p of this.windParticles) {
      p.x += vx * p.speedMult * dt;
      p.y += vy * p.speedMult * dt;

      if (p.x < 0) p.x += this.width;
      if (p.x > this.width) p.x -= this.width;
      if (p.y < 0) p.y += this.height;
      if (p.y > this.height) p.y -= this.height;
    }
  }

  /**
   * Inicializa náufragos e perigos específicos para a etapa atual
   */
  setupLeg(legNumber) {
    this.swimmers = [];
    this.hazards = [];

    if (legNumber === 1) {
      // ETAPA 1: Flórida ➔ Bermudas
      this.swimmers = [
        { id: 1, x: 490, y: 340, rescued: false, lore: "Sobrevivente do Veleiro 'Sea Star' (Miami)" },
        { id: 2, x: 740, y: 290, rescued: false, lore: "Pescador à deriva das Bahamas" },
        { id: 3, x: 980, y: 240, rescued: false, lore: "Balsa do Cargueiro 'Mar Caribe'" },
        { id: 4, x: 1160, y: 260, rescued: false, lore: "Turista náufrago perto das Bermudas" }
      ];

      // Perigos básicos da Etapa 1: Tubarões e lanchas velozes
      this.hazards = [
        { type: 'shark', x: 600, y: 310, vx: 0.8, vy: 0.4 },
        { type: 'shark', x: 880, y: 260, vx: -0.6, vy: 0.7 },
        { type: 'speedboat', x: 400, y: 220, vx: 2.8, vy: 0 },
        { type: 'speedboat', x: 1000, y: 350, vx: -2.5, vy: 0.5 }
      ];
    } else if (legNumber === 2) {
      // ETAPA 2: Bermudas ➔ Porto Rico (O Mar dos Sargaços & Névoas)
      this.swimmers = [
        { id: 1, x: 1280, y: 420, rescued: false, lore: "Marinheiro do navio a vapor 'Cyclops' (desaparecido em 1918!)" },
        { id: 2, x: 1180, y: 560, rescued: false, lore: "Náufrago em transe falando sobre 'Luzes no Abismo'" },
        { id: 3, x: 1050, y: 680, rescued: false, lore: "Tripulante com traje dos anos 1950!" },
        { id: 4, x: 1140, y: 810, rescued: false, lore: "Balsa salva-vidas de iate desaparecido" },
        { id: 5, x: 990, y: 870, rescued: false, lore: "Sobrevivente da Fossa de Porto Rico" }
      ];

      // Perigos: Névoa Rastejante, Tubarões e Redemoinhos Dimensionais!
      this.hazards = [
        { type: 'mist', x: 1150, y: 480, w: 220, h: 180, vx: 0.3, vy: 0.2 },
        { type: 'whirlwind', x: 1100, y: 640, r: 35, rot: 0 },
        { type: 'whirlwind', x: 1220, y: 760, r: 35, rot: 0 },
        { type: 'shark', x: 1120, y: 590, vx: 0.7, vy: -0.5 },
        { type: 'shark', x: 1040, y: 790, vx: -0.8, vy: 0.6 }
      ];
    } else {
      // ETAPA 3: Porto Rico ➔ Miami (O Clímax das Anomalias e Contato)
      this.swimmers = [
        { id: 1, x: 950, y: 850, rescued: false, lore: "Piloto do lendário VOO 19 (desaparecido em 1945!)" },
        { id: 2, x: 780, y: 720, rescued: false, lore: "Capitão do cargueiro 'Marine Sulphur Queen'" },
        { id: 3, x: 620, y: 610, rescued: false, lore: "Cientista que estudava as anomalias magnéticas" },
        { id: 4, x: 440, y: 530, rescued: false, lore: "Sobrevivente resgatado perto das Bahamas" },
        { id: 5, x: 310, y: 480, rescued: false, lore: "Último náufrago avistado na entrada de Miami" }
      ];

      // Perigos: Tempestade Cósmica / Entidade Cristalina (como na Foto 4!), Redemoinhos e Névoa
      this.hazards = [
        { type: 'alien_anomaly', x: 680, y: 680, r: 50, particles: this.createAnomalyParticles() },
        { type: 'alien_anomaly', x: 490, y: 560, r: 45, particles: this.createAnomalyParticles() },
        { type: 'whirlwind', x: 820, y: 760, r: 38, rot: 0 },
        { type: 'whirlwind', x: 380, y: 510, r: 38, rot: 0 },
        { type: 'mist', x: 550, y: 630, w: 260, h: 200, vx: -0.2, vy: 0.1 }
      ];
    }
  }

  createAnomalyParticles() {
    const pts = [];
    for (let i = 0; i < 90; i++) {
      pts.push({
        rx: (Math.random() - 0.5) * 60,
        ry: (Math.random() - 0.5) * 50,
        color: ['#ff0000', '#00aa00', '#ffaa00', '#ffffff'][Math.floor(Math.random() * 4)],
        speed: 0.5 + Math.random() * 1.5
      });
    }
    return pts;
  }

  /**
   * Verifica se coordenada colide com terra firme (blocos verdes)
   */
  checkLandCollision(x, y) {
    for (const isl of this.islands) {
      if (x >= isl.x && x <= isl.x + isl.w && y >= isl.y && y <= isl.y + isl.h) {
        return isl;
      }
    }
    return null;
  }

  /**
   * Verifica colisão com recifes
   */
  checkReefCollision(x, y) {
    for (const reef of this.reefs) {
      const dx = reef.x - x;
      const dy = reef.y - y;
      if (dx * dx + dy * dy < reef.r * reef.r) {
        return reef;
      }
    }
    return null;
  }

  /**
   * Atualiza posição e dinâmica dos perigos
   */
  updateHazards(dt) {
    for (const h of this.hazards) {
      if (h.type === 'shark') {
        h.x += h.vx;
        h.y += h.vy;
        // Bate e volta
        if (h.x < 300 || h.x > 1400) h.vx *= -1;
        if (h.y < 150 || h.y > 1050) h.vy *= -1;
      } else if (h.type === 'speedboat') {
        h.x += h.vx;
        if (h.x < 100) h.x = 1500;
        if (h.x > 1500) h.x = 100;
      } else if (h.type === 'whirlwind') {
        h.rot = (h.rot + 4 * dt) % (Math.PI * 2);
      } else if (h.type === 'mist') {
        h.x += h.vx;
        h.y += h.vy;
        if (h.x < 200 || h.x > 1300) h.vx *= -1;
      }
    }
  }
}

window.V1Map = V1Map;
