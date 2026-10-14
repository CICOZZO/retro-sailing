/**
 * SAILING (1983 - DYNETRON) - RENDERIZADOR GRÁFICO CGA 320x200
 * Renderização pixel-perfect dos 3 quadrantes idêntica às fotos originais.
 */

class V1Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Paleta Oficial CGA IBM PC (Modo 4 / Gráficos de 1983)
    this.colors = {
      black: '#000000',
      green: '#00aa00',       // Verde clássico das ilhas
      brightGreen: '#55ff55',
      red: '#aa0000',         // Casco vermelho do veleiro
      brightRed: '#ff5555',
      orange: '#b85c00',      // Moldura e borda CGA (CGA Brown/Orange)
      yellow: '#ffaa00',      // Vela, bóias e náufragos
      white: '#ffffff'
    };

    this.blinkState = true;
    setInterval(() => { this.blinkState = !this.blinkState; }, 400);
  }

  render(game) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Limpa a tela inteira com a moldura marrom/laranja
    ctx.fillStyle = this.colors.orange;
    ctx.fillRect(0, 0, w, h);

    // Dimensões dos 3 Quadrantes (Exatamente conforme as fotos):
    // Quadrante Esquerdo (Mapa Principal): 60% de largura
    const q1X = 14;
    const q1Y = 14;
    const q1W = 380;
    const q1H = 372;

    // Quadrante Superior Direito (Close do Barco):
    const q2X = 404;
    const q2Y = 14;
    const q2W = 222;
    const q2H = 216;

    // Quadrante Inferior Direito (Radar Estratégico):
    const q3X = 404;
    const q3Y = 244;
    const q3W = 222;
    const q3H = 142;

    // 1. Renderiza Quadrante Superior Direito (Close do Veleiro)
    this.renderBoatCloseUp(ctx, q2X, q2Y, q2W, q2H, game);

    // 2. Renderiza Quadrante Inferior Direito (Radar Global do Triângulo)
    this.renderStrategicRadar(ctx, q3X, q3Y, q3W, q3H, game);

    // 3. Renderiza Quadrante Esquerdo de acordo com o estado do jogo
    if (game.state === 'TITLE') {
      this.renderTitleScreen(ctx, q1X, q1Y, q1W, q1H);
    } else if (game.state === 'INSTRUCTIONS') {
      this.renderInstructionScreen(ctx, q1X, q1Y, q1W, q1H, game);
    } else if (game.state === 'PLAYING' || game.state === 'LEG_INTRO' || game.state === 'LEG_COMPLETE') {
      this.renderMainMapView(ctx, q1X, q1Y, q1W, q1H, game);

      // Sobreposições de Etapa
      if (game.state === 'LEG_INTRO') {
        this.renderLegIntroModal(ctx, q1X, q1Y, q1W, q1H, game);
      } else if (game.state === 'LEG_COMPLETE') {
        this.renderLegCompleteModal(ctx, q1X, q1Y, q1W, q1H, game);
      }
    } else if (game.state === 'VICTORY') {
      this.renderVictoryScreen(ctx, q1X, q1Y, q1W, q1H, game);
    } else if (game.state === 'GAMEOVER') {
      this.renderGameOverScreen(ctx, q1X, q1Y, q1W, q1H, game);
    }
  }

  /**
   * QUADRANTE ESQUERDO: Mapa de Navegação Principal em tempo real
   */
  renderMainMapView(ctx, x, y, w, h, game) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Fundo do Mar Negro
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    // Câmera centrada no veleiro do jogador
    const camX = game.boat.x - w / 2;
    const camY = game.boat.y - h / 2;

    // 0. Efeito dinâmico de vento e marolas na água
    ctx.strokeStyle = '#005522'; // Verde escuro CGA para marolas
    ctx.lineWidth = 1;
    const blowRad = (((game.windDir || 0) + 180) % 360) * (Math.PI / 180);
    const wx = Math.sin(blowRad);
    const wy = -Math.cos(blowRad);

    for (const p of (game.map?.windParticles || [])) {
      const scrX = p.x - camX + x;
      const scrY = p.y - camY + y;
      if (scrX > x && scrX < x + w && scrY > y && scrY < y + h) {
        ctx.beginPath();
        ctx.moveTo(scrX, scrY);
        ctx.lineTo(scrX + wx * p.len, scrY + wy * p.len);
        ctx.stroke();
      }
    }

    // Rastro de espuma da popa do barco (Wake)
    ctx.fillStyle = this.colors.white;
    for (const wk of (game.boat?.wake || [])) {
      const sx = wk.x - camX + x;
      const sy = wk.y - camY + y;
      if (sx > x && sx < x + w && sy > y && sy < y + h) {
        const sz = Math.max(1, Math.round(wk.life * 3));
        ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
      }
    }

    // A. Ilhas e Litoral em blocos verdes CGA pixelados
    ctx.fillStyle = this.colors.green;
    for (const isl of (game.map?.islands || [])) {
      const scrX = isl.x - camX + x;
      const scrY = isl.y - camY + y;
      // Desenha com textura de blocos com degraus
      this.drawBlockyCoastline(ctx, scrX, scrY, isl.w, isl.h);
    }

    // B. Recifes de pedra
    ctx.fillStyle = this.colors.orange;
    for (const r of (game.map?.reefs || [])) {
      const rx = r.x - camX + x;
      const ry = r.y - camY + y;
      if (rx > x - 30 && rx < x + w + 30 && ry > y - 30 && ry < y + h + 30) {
        ctx.beginPath();
        ctx.arc(rx, ry, r.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.colors.black;
        ctx.fillRect(rx - 4, ry - 4, 8, 8);
        ctx.fillStyle = this.colors.orange;
      }
    }

    // C. Porto de Destino da Etapa
    const curPort = game.map?.ports?.[game.leg];
    if (curPort) {
      const px = curPort.x - camX + x;
      const py = curPort.y - camY + y;
      ctx.fillStyle = this.blinkState ? this.colors.yellow : this.colors.brightGreen;
      ctx.fillRect(px, py, curPort.w, curPort.h);
      ctx.fillStyle = this.colors.black;
      ctx.font = 'bold 12px monospace';
      ctx.fillText("PORTO", px + 6, py + 28);
    }

    // D. Náufragos e Balsas de Sobreviventes
    for (const s of (game.map?.swimmers || [])) {
      if (!s.rescued) {
        const sx = s.x - camX + x;
        const sy = s.y - camY + y;
        if (sx > x - 20 && sx < x + w + 20 && sy > y - 20 && sy < y + h + 20) {
          // Ícone da balsa laranja / náufrago
          ctx.fillStyle = this.colors.yellow;
          ctx.fillRect(sx - 7, sy - 7, 14, 14);
          ctx.fillStyle = this.colors.red;
          ctx.fillRect(sx - 3, sy - 3, 6, 6);
          // Braços acenando
          if (this.blinkState) {
            ctx.fillStyle = this.colors.white;
            ctx.fillRect(sx - 9, sy - 9, 3, 3);
            ctx.fillRect(sx + 6, sy - 9, 3, 3);
          }
        }
      }
    }

    // E. Perigos Ativos
    for (const hzd of (game.map?.hazards || [])) {
      const hx = hzd.x - camX + x;
      const hy = hzd.y - camY + y;

      if (hzd.type === 'shark') {
        // Barbatana de tubarão
        ctx.fillStyle = this.colors.brightRed;
        ctx.beginPath();
        ctx.moveTo(hx, hy - 8);
        ctx.lineTo(hx + 8, hy + 6);
        ctx.lineTo(hx - 8, hy + 6);
        ctx.closePath();
        ctx.fill();
      } else if (hzd.type === 'speedboat') {
        // Lancha veloz
        ctx.fillStyle = this.colors.white;
        ctx.fillRect(hx - 12, hy - 5, 24, 10);
        ctx.fillStyle = this.colors.red;
        ctx.fillRect(hx + (hzd.vx > 0 ? 8 : -12), hy - 3, 6, 6);
      } else if (hzd.type === 'whirlwind') {
        // Redemoinho dimensional rotativo
        ctx.strokeStyle = this.blinkState ? this.colors.yellow : this.colors.brightGreen;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(hx, hy, hzd.r, hzd.rot, hzd.rot + Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx, hy, hzd.r * 0.5, -hzd.rot, -hzd.rot + Math.PI * 1.5);
        ctx.stroke();
      } else if (hzd.type === 'mist') {
        // Névoa rastejante em pontilhado dither
        ctx.fillStyle = 'rgba(0, 170, 0, 0.28)';
        ctx.fillRect(hx, hy, hzd.w, hzd.h);
      } else if (hzd.type === 'alien_anomaly') {
        // Nuvem de Partículas da Entidade Cristalina (como na Foto 4!)
        for (const p of hzd.particles) {
          ctx.fillStyle = p.color;
          ctx.fillRect(hx + p.rx, hy + p.ry, 3, 3);
        }
      }
    }

    // F. O Veleiro do Jogador (Ícone no Mapa Principal)
    const boatScrX = w / 2 + x;
    const boatScrY = h / 2 + y;
    this.drawPlayerMapBoat(ctx, boatScrX, boatScrY, game.boat);

    // G. Faixa Ornamental Inferior de Perigo (da Foto 1)
    this.drawHazardBorderPattern(ctx, x, y + h - 22, w);

    // H. Mensagem de Rádio Narrativa (quando resgata sobrevivente)
    if (game.radioMessage) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(x + 10, y + 10, w - 20, 36);
      ctx.strokeStyle = this.colors.orange;
      ctx.strokeRect(x + 10, y + 10, w - 20, 36);

      ctx.fillStyle = this.colors.yellow;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(game.radioMessage, x + w / 2, y + 32);
    }

    ctx.restore();
  }

  getCompassDirName(deg) {
    const d = (((deg || 0) % 360) + 360) % 360;
    if (d >= 337.5 || d < 22.5) return 'N';
    if (d >= 22.5 && d < 67.5) return 'NE';
    if (d >= 67.5 && d < 112.5) return 'E';
    if (d >= 112.5 && d < 157.5) return 'SE';
    if (d >= 157.5 && d < 202.5) return 'S';
    if (d >= 202.5 && d < 247.5) return 'SW';
    if (d >= 247.5 && d < 292.5) return 'W';
    return 'NW';
  }

  /**
   * QUADRANTE SUPERIOR DIREITO: Close do Veleiro, Regulagem da Vela e Indicador de Vento
   */
  renderBoatCloseUp(ctx, x, y, w, h, game) {
    ctx.save();
    // Borda preta interna
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    const centerX = x + w / 2;
    const centerY = y + h / 2 - 8;

    // Cabeçalho: Leitura do Vento e Direção
    const dirName = this.getCompassDirName(game.windDir);
    ctx.fillStyle = this.colors.yellow;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`VENTO: ${Math.round(game.windSpeed)} NÓS [${dirName}]`, centerX, y + 16);

    // A. Setas Verticais de Vento nas laterais (Vermelhas animadas - da Foto 1)
    ctx.fillStyle = this.colors.red;
    ctx.strokeStyle = this.colors.red;
    ctx.lineWidth = 3;

    // Se o vento sopra para o Norte (metade superior) ou Sul
    const isBlowingNorth = Math.cos((game.windDir + 180) * (Math.PI / 180)) >= 0;
    const arrowFlow = (Date.now() * 0.04 * (game.windSpeed / 12.0)) % 40;

    // Seta da Esquerda
    ctx.beginPath();
    ctx.moveTo(x + 8, centerY + 50);
    ctx.lineTo(x + 8, centerY - 50);
    ctx.stroke();

    // Seta da Direita
    ctx.beginPath();
    ctx.moveTo(x + w - 8, centerY + 50);
    ctx.lineTo(x + w - 8, centerY - 50);
    ctx.stroke();

    // Pontas das setas
    ctx.beginPath();
    if (isBlowingNorth) {
      ctx.moveTo(x + 8, centerY - 58);
      ctx.lineTo(x + 14, centerY - 48);
      ctx.lineTo(x + 2, centerY - 48);
      ctx.moveTo(x + w - 8, centerY - 58);
      ctx.lineTo(x + w - 2, centerY - 48);
      ctx.lineTo(x + w - 14, centerY - 48);
    } else {
      ctx.moveTo(x + 8, centerY + 58);
      ctx.lineTo(x + 14, centerY + 48);
      ctx.lineTo(x + 2, centerY + 48);
      ctx.moveTo(x + w - 8, centerY + 58);
      ctx.lineTo(x + w - 2, centerY + 48);
      ctx.lineTo(x + w - 14, centerY + 48);
    }
    ctx.closePath();
    ctx.fill();

    // Chevrons animados de vento fluindo ao longo das setas
    ctx.strokeStyle = this.blinkState ? this.colors.brightRed : this.colors.red;
    ctx.lineWidth = 2;
    for (let offset = -40; offset <= 40; offset += 20) {
      const cy = centerY + ((offset + (isBlowingNorth ? -arrowFlow : arrowFlow) + 80) % 80) - 40;
      // Esquerda
      ctx.beginPath();
      ctx.moveTo(x + 4, cy + (isBlowingNorth ? 4 : -4));
      ctx.lineTo(x + 8, cy);
      ctx.lineTo(x + 12, cy + (isBlowingNorth ? 4 : -4));
      ctx.stroke();
      // Direita
      ctx.beginPath();
      ctx.moveTo(x + w - 12, cy + (isBlowingNorth ? 4 : -4));
      ctx.lineTo(x + w - 8, cy);
      ctx.lineTo(x + w - 4, cy + (isBlowingNorth ? 4 : -4));
      ctx.stroke();
    }

    // B. Casco do Barco Visto de Cima (Amêndoa Vermelha sólida)
    ctx.save();
    ctx.translate(centerX, centerY);
    const headingRad = (game.boat.heading - 90) * (Math.PI / 180);
    ctx.rotate(headingRad);

    // Casco vermelho em elipse alongada
    ctx.fillStyle = this.colors.red;
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gurupés na proa (linha verde)
    ctx.strokeStyle = this.colors.brightGreen;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(58, 0);
    ctx.lineTo(80, 0);
    ctx.stroke();

    // Leme na popa (linha verde articulada com o leme)
    const rudderRad = game.boat.rudderAngle * 0.5 * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(-58, 0);
    ctx.lineTo(-58 - Math.cos(rudderRad) * 24, Math.sin(rudderRad) * 24);
    ctx.stroke();

    // Mastro no centro e retranca/vela articulada
    // Se em ferro (contra o vento), a vela trepida descontrolada
    let sailAngle = game.boat.sailTrim;
    if (game.boat.isLuffing) {
      sailAngle += Math.sin(Date.now() * 0.04) * 8;
    }
    ctx.strokeStyle = this.colors.yellow;
    ctx.lineWidth = 4;
    const boomAngle = sailAngle * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(10 - Math.cos(boomAngle) * 54, -Math.sin(boomAngle) * 54);
    ctx.stroke();

    ctx.restore();

    // Feedback de estado de vento e trim sob o barco
    ctx.textAlign = 'center';
    if (game.boat.isLuffing) {
      ctx.fillStyle = this.blinkState ? this.colors.brightRed : this.colors.yellow;
      ctx.font = 'bold 11px monospace';
      ctx.fillText("! EM FERRO (CONTRA O VENTO) !", centerX, centerY + 62);
      ctx.font = '10px monospace';
      ctx.fillText("VIRE O LEME P/ PEGAR VENTO", centerX, centerY + 74);
    } else {
      ctx.fillStyle = this.colors.brightGreen;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`VELOCIDADE: ${game.boat.speed.toFixed(1)} NÓS`, centerX, centerY + 62);
      ctx.fillStyle = this.colors.yellow;
      ctx.font = '10px monospace';
      ctx.fillText(`VELA: ${Math.round(game.boat.sailTrim)}° (IDEAL: ${game.boat.optTrim || 42}°)`, centerX, centerY + 74);
    }

    // C. Barra Horizontal de Medição com Tiques na base do quadrante (Fotos 1, 4 e 5)
    const barY = y + h - 16;
    ctx.strokeStyle = this.colors.red;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, barY);
    ctx.lineTo(x + w - 10, barY);
    ctx.stroke();

    // Marcas de graduação (tiques)
    const numTicks = 12;
    const tickStep = (w - 20) / numTicks;
    for (let i = 0; i <= numTicks; i++) {
      ctx.beginPath();
      ctx.moveTo(x + 10 + i * tickStep, barY - 4);
      ctx.lineTo(x + 10 + i * tickStep, barY + 4);
      ctx.stroke();
    }

    // Barra Vermelha de Intensidade do Vento (conforme Foto 1 e Foto 5)
    const windRatio = Math.min(1.0, game.windSpeed / 25.0);
    const windFillW = (w - 20) * windRatio;
    ctx.fillStyle = this.colors.red;
    ctx.fillRect(x + 10, barY - 6, windFillW, 4);

    // Cursor Amarelo da Velocidade Real do Veleiro
    const boatRatio = Math.min(1.0, game.boat.speed / game.boat.maxSpeed);
    const curX = x + 10 + boatRatio * (w - 20);
    ctx.fillStyle = this.colors.yellow;
    ctx.fillRect(curX - 3, barY - 8, 6, 16);

    ctx.restore();
  }

  /**
   * QUADRANTE INFERIOR DIREITO: Radar Estratégico Global e Status
   */
  renderStrategicRadar(ctx, x, y, w, h, game) {
    ctx.save();
    // Fundo preto
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    // Escala do radar (1600x1200 para ~220x110)
    const rScaleX = (w - 24) / game.map.width;
    const rScaleY = (h - 32) / game.map.height;
    const radarOffsetX = x + 14;
    const radarOffsetY = y + 8;

    // A. Miniatura das Ilhas Verdes
    ctx.fillStyle = this.colors.green;
    for (const isl of (game.map?.islands || [])) {
      const ix = radarOffsetX + isl.x * rScaleX;
      const iy = radarOffsetY + isl.y * rScaleY;
      const iw = Math.max(3, isl.w * rScaleX);
      const ih = Math.max(3, isl.h * rScaleY);
      ctx.fillRect(ix, iy, iw, ih);
    }

    // B. Náufragos como Pontos Laranjas (da Foto 1)
    ctx.fillStyle = this.colors.yellow;
    for (const s of (game.map?.swimmers || [])) {
      if (!s.rescued) {
        const sx = radarOffsetX + s.x * rScaleX;
        const sy = radarOffsetY + s.y * rScaleY;
        ctx.fillRect(sx, sy, 3, 3);
      }
    }

    // C. Ponto Piscante do Jogador
    if (this.blinkState) {
      ctx.fillStyle = this.colors.white;
      const bx = radarOffsetX + game.boat.x * rScaleX;
      const by = radarOffsetY + game.boat.y * rScaleY;
      ctx.fillRect(bx - 2, by - 2, 5, 5);
    }

    // D. Medidor Vertical Esquerdo 'D' a 'F' (Dano / Combustível)
    ctx.strokeStyle = this.colors.red;
    ctx.fillStyle = this.colors.red;
    ctx.font = 'bold 11px monospace';
    ctx.fillText("D", x + 3, y + 16);
    ctx.fillText("F", x + 3, y + h - 22);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 20);
    ctx.lineTo(x + 8, y + h - 26);
    ctx.stroke();

    // Nível do dano
    const dmgPct = (100 - game.boat.damage) / 100;
    const dmgH = (h - 46) * dmgPct;
    ctx.fillStyle = this.colors.brightGreen;
    ctx.fillRect(x + 6, y + h - 26 - dmgH, 5, dmgH);

    // E. Rodapé com Relógio Digital, Vidas e Pontuação (Exatamente como na Foto 1)
    const footerY = y + h - 8;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = this.colors.red;

    // Relógio 00:11
    const secs = Math.floor(game.elapsedTime);
    const minsStr = String(Math.floor(secs / 60)).padStart(2, '0');
    const secsStr = String(secs % 60).padStart(2, '0');
    ctx.fillText(`${minsStr}:${secsStr}`, x + 6, footerY);

    // Ícones de Vidas (Barquinhos Vermelhos)
    for (let i = 0; i < Math.min(5, game.lives); i++) {
      const lx = x + 85 + i * 16;
      ctx.beginPath();
      ctx.moveTo(lx, footerY - 10);
      ctx.lineTo(lx + 8, footerY - 2);
      ctx.lineTo(lx - 4, footerY - 2);
      ctx.closePath();
      ctx.fill();
    }

    // Pontuação 00000
    const scoreStr = String(game.score).padStart(5, '0');
    ctx.fillText(scoreStr, x + w - 50, footerY);

    ctx.restore();
  }

  /**
   * TELA DE TÍTULO ORIGINAL (Foto 5)
   */
  /**
   * Cálculo dos retângulos dos itens de menu da tela de título
   */
  getTitleMenuItems(x, y, w, h) {
    const startY = y + 112;
    const itemH = 18;
    const gap = 6;
    const items = [
      { key: 'B', text: '(B) to begin game', y: startY },
      { key: 'P', text: '(P) for practice leg', y: startY + itemH },
      { key: 'X', text: '(X) exit to system', y: startY + itemH * 2 },
      { key: 'A', text: '(A)ll instructions', y: startY + itemH * 3 + gap },
      { key: 'O', text: '(O)bject of the game', y: startY + itemH * 4 + gap },
      { key: 'C', text: '(C)ontrols', y: startY + itemH * 5 + gap },
      { key: 'S', text: '(S)coring', y: startY + itemH * 6 + gap },
      { key: 'H', text: '(H)azards', y: startY + itemH * 7 + gap },
      { key: 'G', text: '(G)auges', y: startY + itemH * 8 + gap }
    ];

    return items.map(it => ({
      ...it,
      x: x + 20,
      w: w - 40,
      h: itemH
    }));
  }

  /**
   * Identifica se as coordenadas do mouse (x, y) estão sobre uma opção do menu
   */
  getMenuOptionAt(x, y) {
    const q1X = 14;
    const q1Y = 14;
    const q1W = 380;
    const q1H = 372;
    const items = this.getTitleMenuItems(q1X, q1Y, q1W, q1H);

    for (const it of items) {
      if (x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h) {
        return it.key;
      }
    }
    return null;
  }

  /**
   * TELA DE TÍTULO ORIGINAL (Foto 5) - Com interatividade de clique e hover
   */
  renderTitleScreen(ctx, x, y, w, h) {
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    // Título Principal SAILING
    ctx.fillStyle = this.colors.yellow;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("SAILING", x + w / 2, y + 30);

    ctx.font = '12px monospace';
    ctx.fillStyle = this.colors.white;
    ctx.fillText("Before playing, you may wish to review", x + w / 2, y + 54);
    ctx.fillText("some or all of the instruction screens.", x + w / 2, y + 70);

    ctx.fillStyle = this.colors.brightGreen;
    ctx.fillText("Select option below or click on it:", x + w / 2, y + 88);

    // Lista de Itens do Menu
    const items = this.getTitleMenuItems(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px monospace';

    for (const it of items) {
      const isHovered = this.hoveredMenuOption === it.key;

      if (isHovered) {
        // Destaque visual retrô ao passar o mouse
        ctx.fillStyle = '#b85c00'; // Fundo laranja CGA
        ctx.fillRect(it.x - 4, it.y, it.w + 8, it.h);
        ctx.strokeStyle = this.colors.yellow;
        ctx.lineWidth = 1;
        ctx.strokeRect(it.x - 4, it.y, it.w + 8, it.h);

        ctx.fillStyle = this.colors.white;
        ctx.fillText(`► ${it.text}`, it.x + 4, it.y + 14);
      } else {
        ctx.fillStyle = this.colors.yellow;
        ctx.fillText(`  ${it.text}`, it.x + 4, it.y + 14);
      }
    }

    // Rodapé piscante orientando o jogador
    ctx.textAlign = 'center';
    ctx.fillStyle = this.blinkState ? this.colors.yellow : this.colors.white;
    ctx.font = 'bold 12px monospace';
    ctx.fillText("[ CLIQUE COM O MOUSE OU DIGITE A LETRA ]", x + w / 2, y + h - 28);
    ctx.font = '11px monospace';
    ctx.fillText("TYPE OPTION (B, P, O, C, S, H, G)", x + w / 2, y + h - 14);
  }

  /**
   * TELAS DE INSTRUÇÃO E STORYTELLING (Fotos 3 e 5)
   */
  renderInstructionScreen(ctx, x, y, w, h, game) {
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = this.colors.yellow;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';

    const t = game.currentInstruction;
    if (t === 'O') {
      // *MAIN OBJECTIVE* (Foto 3)
      ctx.fillText("*MAIN OBJECTIVE*", x + w / 2, y + 36);
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      const textX = x + 25;
      let ty = y + 70;
      const lh = 18;

      ctx.fillText("Sail 3 legs of the Bermuda Triangle", textX, ty); ty += lh;
      ctx.fillText("picking up all swimmers and rafters", textX, ty); ty += lh;
      ctx.fillText("stranded in the water. Then stop the", textX, ty); ty += lh;
      ctx.fillText("clock and collect bonus by sailing", textX, ty); ty += lh;
      ctx.fillText("into port at the end of the leg.", textX, ty); ty += lh * 2;

      ctx.fillStyle = this.colors.brightGreen;
      ctx.fillText("ETAPA 1: Flórida ➔ Bermudas", textX, ty); ty += lh;
      ctx.fillText("ETAPA 2: Bermudas ➔ Porto Rico", textX, ty); ty += lh;
      ctx.fillText("ETAPA 3: Porto Rico ➔ Miami", textX, ty);
    } else if (t === 'H') {
      // HAZARDS & O SOBRENATURAL
      ctx.fillText("*HAZARDS OF THE TRIANGLE*", x + w / 2, y + 36);
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      const textX = x + 25;
      let ty = y + 68;
      const lh = 17;

      ctx.fillStyle = this.colors.red;
      ctx.fillText("• TUBARÕES E LANCHAS:", textX, ty); ty += lh;
      ctx.fillStyle = this.colors.yellow;
      ctx.fillText("  Causam danos severos no casco.", textX, ty); ty += lh + 4;

      ctx.fillStyle = this.colors.brightGreen;
      ctx.fillText("• NÉVOA RASTEJANTE (MIST):", textX, ty); ty += lh;
      ctx.fillStyle = this.colors.yellow;
      ctx.fillText("  Bloqueia a visibilidade do radar.", textX, ty); ty += lh + 4;

      ctx.fillStyle = this.colors.white;
      ctx.fillText("• REDEMOINHOS (WHIRLWINDS):", textX, ty); ty += lh;
      ctx.fillStyle = this.colors.yellow;
      ctx.fillText("  Vórtices magnéticos que teletransportam!", textX, ty); ty += lh + 4;

      ctx.fillStyle = this.colors.brightRed;
      ctx.fillText("• ENTIDADES CRISTALINAS (ALIENS):", textX, ty); ty += lh;
      ctx.fillStyle = this.colors.yellow;
      ctx.fillText("  Campos de energia do Triângulo.", textX, ty);
    } else if (t === 'C') {
      // CONTROLS
      ctx.fillText("*CONTROLS*", x + w / 2, y + 36);
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      const textX = x + 25;
      let ty = y + 75;
      const lh = 22;

      ctx.fillText("SETA ESQ / DIR (A/D): Leme (virar proa)", textX, ty); ty += lh;
      ctx.fillText("SETA CIMA / BAIXO (W/S): Caçar / Filar vela", textX, ty); ty += lh;
      ctx.fillText("ESPAÇO / CLIQUE: Continuar / Iniciar", textX, ty); ty += lh;
      ctx.fillText("M: Ligar / Desligar Som do PC", textX, ty); ty += lh;
      ctx.fillText("ESC: Voltar ao Menu Principal", textX, ty);
    } else {
      // SCORING OU GAUGES
      ctx.fillText("*INSTRUMENT GAUGES & SCORE*", x + w / 2, y + 36);
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      const textX = x + 25;
      let ty = y + 75;
      const lh = 20;

      ctx.fillText("QUADRANTE TOP-DIR: Close da vela e vento", textX, ty); ty += lh;
      ctx.fillText("QUADRANTE INF-DIR: Radar tático e náufragos", textX, ty); ty += lh;
      ctx.fillText("INDICADOR 'D' - 'F': Integridade do casco", textX, ty); ty += lh;
      ctx.fillText("RESGATE: 500 PONTOS POR SOBREVIVENTE", textX, ty); ty += lh;
      ctx.fillText("PORTO: BÔNUS POR TEMPO RESTANTE", textX, ty);
    }

    ctx.fillStyle = this.blinkState ? this.colors.yellow : this.colors.white;
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    ctx.fillText("[ CLIQUE NA TELA OU ESPAÇO PARA VOLTAR ]", x + w / 2, y + h - 25);
    ctx.font = '11px monospace';
    ctx.fillText("Hit SPACE or CLICK to return", x + w / 2, y + h - 10);
  }

  /**
   * MODAL: LEG X <CR> TO BEGIN (Foto 2) - Bilingue e interativo com clique direto
   */
  renderLegIntroModal(ctx, x, y, w, h, game) {
    const mw = 270;
    const mh = 110;
    const mx = x + (w - mw) / 2;
    const my = y + (h - mh) / 2 - 30;

    ctx.fillStyle = this.colors.black;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = this.colors.orange;
    ctx.lineWidth = 3;
    ctx.strokeRect(mx, my, mw, mh);
    ctx.strokeRect(mx + 4, my + 4, mw - 8, mh - 8);

    ctx.fillStyle = this.colors.yellow;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ETAPA  ${game.leg} : LEG  ${game.leg}`, mx + mw / 2, my + 30);

    ctx.font = '12px monospace';
    ctx.fillStyle = this.colors.brightGreen;
    const dest = game.leg === 1 ? "MIAMI ➔ BERMUDAS" : game.leg === 2 ? "BERMUDAS ➔ PORTO RICO" : "PORTO RICO ➔ MIAMI";
    ctx.fillText(dest, mx + mw / 2, my + 50);

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = this.blinkState ? this.colors.yellow : this.colors.white;
    ctx.fillText("<CR> / [ CLIQUE AQUI ]", mx + mw / 2, my + 74);
    ctx.font = '11px monospace';
    ctx.fillText("PRESSIONE ENTER OU CLIQUE P/ INICIAR", mx + mw / 2, my + 94);
  }

  /**
   * MODAL: ETAPA CONCLUÍDA
   */
  renderLegCompleteModal(ctx, x, y, w, h, game) {
    const mw = 260;
    const mh = 120;
    const mx = x + (w - mw) / 2;
    const my = y + (h - mh) / 2 - 40;

    ctx.fillStyle = this.colors.black;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = this.colors.brightGreen;
    ctx.lineWidth = 3;
    ctx.strokeRect(mx, my, mw, mh);

    ctx.fillStyle = this.colors.brightGreen;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ETAPA ${game.leg} CONCLUÍDA!`, mx + mw / 2, my + 35);

    ctx.fillStyle = this.colors.yellow;
    ctx.font = '13px monospace';
    ctx.fillText("TODOS OS NÁUFRAGOS A SALVO", mx + mw / 2, my + 65);

    ctx.fillStyle = this.blinkState ? this.colors.white : this.colors.yellow;
    ctx.fillText("PRESSIONE ESPAÇO P/ PROSSEGUIR", mx + mw / 2, my + 95);
  }

  /**
   * TELA DE VITÓRIA FINAL (APÓS COMPLETAR AS 3 ETAPAS)
   */
  renderVictoryScreen(ctx, x, y, w, h, game) {
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = this.colors.brightGreen;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("★ VITÓRIA NO TRIÂNGULO DAS BERMUDAS ★", x + w / 2, y + 40);

    ctx.fillStyle = this.colors.yellow;
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    const textX = x + 25;
    let ty = y + 80;
    const lh = 20;

    ctx.fillText("Você cruzou os três vértices sagrados:", textX, ty); ty += lh;
    ctx.fillText("Flórida, Bermudas e Porto Rico!", textX, ty); ty += lh * 1.5;

    ctx.fillStyle = this.colors.white;
    ctx.fillText("Sobreviventes do Voo 19 e de várias eras", textX, ty); ty += lh;
    ctx.fillText("foram resgatados do bolsão dimensional.", textX, ty); ty += lh * 1.5;

    ctx.fillStyle = this.colors.brightGreen;
    ctx.fillText(`PONTUAÇÃO FINAL: ${game.score} PONTOS`, textX, ty); ty += lh * 2;

    ctx.textAlign = 'center';
    ctx.fillStyle = this.blinkState ? this.colors.yellow : this.colors.white;
    ctx.fillText("PRESSIONE ESPAÇO PARA O MENU", x + w / 2, y + h - 25);
  }

  renderGameOverScreen(ctx, x, y, w, h, game) {
    ctx.fillStyle = this.colors.black;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = this.colors.red;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("EMBARCAÇÃO PERDIDA NO MAR", x + w / 2, y + 90);

    ctx.fillStyle = this.colors.yellow;
    ctx.font = '14px monospace';
    ctx.fillText("O Triângulo das Bermudas cobrou seu preço.", x + w / 2, y + 140);
    ctx.fillText(`PONTOS ALCANÇADOS: ${game.score}`, x + w / 2, y + 180);

    ctx.fillStyle = this.blinkState ? this.colors.white : this.colors.yellow;
    ctx.fillText("PRESSIONE ESPAÇO PARA REINICIAR", x + w / 2, y + 250);
  }

  /**
   * Desenha costa com blocos pixelados (degrade em degraus da Foto 1)
   */
  drawBlockyCoastline(ctx, x, y, w, h) {
    const step = 16;
    for (let bx = 0; bx < w; bx += step) {
      for (let by = 0; by < h; by += step) {
        ctx.fillRect(x + bx, y + by, step, step);
      }
    }
  }

  /**
   * Barquinho do jogador no mapa principal (ícone vermelho e vela triangular)
   */
  drawPlayerMapBoat(ctx, cx, cy, boat) {
    ctx.save();
    ctx.translate(cx, cy);
    const rad = (boat.heading - 90) * (Math.PI / 180);
    ctx.rotate(rad);

    // Casco vermelho do barquinho
    ctx.fillStyle = this.colors.red;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();

    // Vela triangular amarela/verde
    ctx.fillStyle = this.colors.brightGreen;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Padrão de perigo ornamental no rodapé do mapa (exatamente como na Foto 1)
   */
  drawHazardBorderPattern(ctx, x, y, w) {
    ctx.fillStyle = this.colors.orange;
    const patW = 28;
    const num = Math.ceil(w / patW);
    for (let i = 0; i < num; i++) {
      const px = x + i * patW;
      ctx.fillRect(px + 4, y + 6, 8, 8);
      ctx.fillRect(px + 16, y + 6, 8, 8);
      ctx.fillRect(px + 10, y + 2, 8, 16);
    }
  }
}

window.V1Renderer = V1Renderer;
