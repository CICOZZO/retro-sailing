/**
 * SAILING (1986) - RENDERIZADOR VETORIAL ("PONTOS E TRAÇOS")
 * Renderiza a visão 3D em perspectiva aramada e o console/radar tático alfanumérico.
 */

class RetroRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = new Camera3D();
    this.palette = 'green';
    this.cameraMode = 0; // 0 = 3ª Pessoa (Atrás do veleiro), 1 = 1ª Pessoa (No leme/proa)
    this.layoutMode = 'split'; // 'split' (Painel Duplo) ou 'fullscreen' (3D Total)
    this.sweepAngle = 0;

    // Estrelas fixas no céu
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * (Math.PI * 0.45);
      const r = 280;
      this.stars.push(new Vec3(
        r * Math.cos(phi) * Math.sin(theta),
        r * Math.sin(phi) + 10,
        r * Math.cos(phi) * Math.cos(theta)
      ));
    }
  }

  setPalette(palette) {
    this.palette = palette;
  }

  getColors() {
    switch (this.palette) {
      case 'amber':
        return {
          bg: '#0c0601',
          fg: '#ffb000',
          dim: '#855900',
          accent: '#ffd266',
          glow: 'rgba(255, 176, 0, 0.45)'
        };
      case 'white':
        return {
          bg: '#080a0d',
          fg: '#d4e3f0',
          dim: '#5d6e7c',
          accent: '#ffffff',
          glow: 'rgba(212, 227, 240, 0.4)'
        };
      case 'cga':
        return {
          bg: '#000000',
          fg: '#55ffff',
          dim: '#00aaaa',
          accent: '#ff55ff',
          glow: 'rgba(85, 255, 255, 0.4)'
        };
      case 'green':
      default:
        return {
          bg: '#020904',
          fg: '#33ff66',
          dim: '#156128',
          accent: '#88ffaa',
          glow: 'rgba(51, 255, 102, 0.45)'
        };
    }
  }

  /**
   * Renderiza a cena completa
   */
  render(game) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const colors = this.getColors();

    // 1. Limpeza da tela com fundo preto de fósforo
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    if (this.layoutMode === 'fullscreen') {
      // Modo 3D Tela Cheia: Toda a tela é dedicada à visão 3D e ao mar
      this.render3DView(ctx, w, h, game, colors);
      this.renderFullscreenHUD(ctx, w, h, game, colors);
    } else {
      // Modo Dividido Clássico: 70% Esquerda para a Janela 3D e 30% Direita para o Radar
      const view3dWidth = Math.floor(w * 0.70);
      const view3dHeight = h;
      const consoleX = view3dWidth;
      const consoleWidth = w - view3dWidth;

      // 2. Renderização da Visão 3D
      this.render3DView(ctx, view3dWidth, view3dHeight, game, colors);

      // 3. Moldura divisória de fósforo
      ctx.strokeStyle = colors.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(consoleX, 0);
      ctx.lineTo(consoleX, h);
      ctx.stroke();

      // 4. Renderização do Console Tático (Radar + Alfanuméricos)
      this.renderTacticalConsole(ctx, consoleX, consoleWidth, h, game, colors);
    }
  }

  /**
   * Renderiza a janela 3D em perspectiva com wireframe
   */
  render3DView(ctx, viewW, viewH, game, colors) {
    ctx.save();
    // Limita o desenho à área da janela 3D
    ctx.beginPath();
    ctx.rect(0, 0, viewW, viewH);
    ctx.clip();

    // Configuração de Câmera 3D
    const boat = game.player;
    const boatPos = new Vec3(boat.x, 0, boat.z);
    const headingRad = boat.heading * (Math.PI / 180);

    if (this.cameraMode === 0) {
      // 3ª Pessoa: Atrás e acima do barco, acompanhando o rumo
      const camDist = 16.0;
      const camHeight = 5.2;
      const camOffsetX = -Math.sin(headingRad) * camDist;
      const camOffsetZ = -Math.cos(headingRad) * camDist;

      this.camera.pos = new Vec3(boat.x + camOffsetX, camHeight, boat.z + camOffsetZ);
      this.camera.target = new Vec3(
        boat.x + Math.sin(headingRad) * 12.0,
        2.2,
        boat.z + Math.cos(headingRad) * 12.0
      );
    } else {
      // 1ª Pessoa: Na proa olhando para frente
      this.camera.pos = new Vec3(
        boat.x + Math.sin(headingRad) * 1.5,
        1.8,
        boat.z + Math.cos(headingRad) * 1.5
      );
      this.camera.target = new Vec3(
        boat.x + Math.sin(headingRad) * 35.0,
        1.6,
        boat.z + Math.cos(headingRad) * 35.0
      );
    }

    // Brilho de fósforo verde/âmbar
    ctx.shadowBlur = 4;
    ctx.shadowColor = colors.glow;

    // A. Céu e Estrelas no infinito
    ctx.fillStyle = colors.fg;
    this.stars.forEach(star => {
      // Estrelas relativas ao barco
      const starWorld = star.add(boatPos);
      const pCam = this.camera.worldToCamera(starWorld);
      if (pCam.z > this.camera.near) {
        const pScr = this.camera.project(pCam, viewW, viewH);
        if (pScr && pScr.visible && pScr.y < viewH * 0.55) {
          ctx.fillRect(pScr.x, pScr.y, 1.5, 1.5);
        }
      }
    });

    // B. Linha do Horizonte e Bússola no Horizonte
    this.drawHorizon(ctx, viewW, viewH, boat.heading, colors);

    // C. Malha do Mar (Linhas e Pontos do Oceano 3D)
    this.drawOceanGrid(ctx, viewW, viewH, boat, colors, game.time);

    // D. Bóias do Percurso (se houver)
    if (game.buoys) {
      game.buoys.forEach((buoy, idx) => {
        this.drawWorldObject(
          ctx, viewW, viewH,
          WireframeMeshes.createBuoy(),
          new Vec3(buoy.x, 0, buoy.z),
          0, 0, 0,
          idx === game.currentBuoyIndex ? colors.accent : colors.fg,
          colors
        );

        // Rótulo alfanumérico da bóia no mundo 3D
        this.drawWorldLabel(ctx, viewW, viewH, `[BÓIA ${idx + 1}]`, new Vec3(buoy.x, 4.0, buoy.z), colors.accent);
      });
    }

    // E. Náufragos e Balsas (Modo Bermudas)
    if (game.survivors) {
      game.survivors.forEach(s => {
        if (!s.rescued) {
          this.drawWorldObject(
            ctx, viewW, viewH,
            WireframeMeshes.createRaft(game.time),
            new Vec3(s.x, 0, s.z),
            0, 0, 0,
            colors.accent,
            colors
          );
          this.drawWorldLabel(ctx, viewW, viewH, "[SOS]", new Vec3(s.x, 2.8, s.z), colors.accent);
        }
      });
    }

    // F. Barco Rival / Fantasma (Modo Regata)
    if (game.rival && game.mode === 'regatta') {
      const rivalHeadingRad = game.rival.heading * (Math.PI / 180);
      const rivalMesh = WireframeMeshes.createSailboat(
        game.rival.sailAngle,
        false,
        game.time
      );
      this.drawWorldObject(
        ctx, viewW, viewH,
        rivalMesh,
        new Vec3(game.rival.x, 0, game.rival.z),
        rivalHeadingRad, 0, 0,
        colors.dim,
        colors,
        true // Linha tracejada para indicar fantasma/rival
      );
      this.drawWorldLabel(ctx, viewW, viewH, "[AUSTRALIA II]", new Vec3(game.rival.x, 9.0, game.rival.z), colors.dim);
    }

    // G. O Veleiro do Jogador (Apenas se em 3ª pessoa)
    if (this.cameraMode === 0) {
      // Ângulo da retranca (Boom) no espaço do barco
      const windRelInfo = game.windInfo || { windSide: 1 };
      const boomAngleRad = -windRelInfo.windSide * (boat.sailTrim * (Math.PI / 180));

      const playerMesh = WireframeMeshes.createSailboat(
        boomAngleRad,
        boat.isLuffing,
        game.time
      );

      this.drawWorldObject(
        ctx, viewW, viewH,
        playerMesh,
        boatPos,
        headingRad,
        boat.heelAngle,
        boat.pitchAngle,
        colors.fg,
        colors
      );
    }

    // H. Biruta no Topo da Tela (Indicador de Vento 3D)
    this.drawWindPennant(ctx, viewW, viewH, game, colors);

    ctx.restore();
  }

  /**
   * Desenha a linha do horizonte e as graduações de bússola
   */
  drawHorizon(ctx, viewW, viewH, heading, colors) {
    const horizonY = viewH * 0.48;

    ctx.strokeStyle = colors.dim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(viewW, horizonY);
    ctx.stroke();

    // Graduações da rosa-dos-ventos deslizando no horizonte
    const fovDegrees = 60;
    const pixelsPerDegree = viewW / fovDegrees;

    ctx.font = '14px VT323, monospace';
    ctx.fillStyle = colors.dim;
    ctx.textAlign = 'center';

    const cardinalPoints = [
      { deg: 0, text: 'N' },
      { deg: 45, text: 'NE' },
      { deg: 90, text: 'E' },
      { deg: 135, text: 'SE' },
      { deg: 180, text: 'S' },
      { deg: 225, text: 'SW' },
      { deg: 270, text: 'W' },
      { deg: 315, text: 'NW' }
    ];

    cardinalPoints.forEach(cp => {
      let diff = cp.deg - heading;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;

      if (Math.abs(diff) < fovDegrees * 0.6) {
        const x = (viewW / 2) + diff * pixelsPerDegree;
        ctx.beginPath();
        ctx.moveTo(x, horizonY - 6);
        ctx.lineTo(x, horizonY + 6);
        ctx.stroke();
        ctx.fillText(cp.text, x, horizonY - 10);
      }
    });
  }

  /**
   * Malha 3D do Mar com ondas oscilantes
   */
  drawOceanGrid(ctx, viewW, viewH, boat, colors, time) {
    ctx.strokeStyle = colors.dim;
    ctx.lineWidth = 1;

    const gridSize = 16;
    const step = 8;
    const offsetX = Math.floor(boat.x / step) * step;
    const offsetZ = Math.floor(boat.z / step) * step;

    // Linhas transversais (ao longo de Z)
    for (let x = -gridSize * step; x <= gridSize * step; x += step * 2) {
      let prevPt = null;
      for (let z = -gridSize * step; z <= gridSize * step; z += step) {
        const worldX = offsetX + x;
        const worldZ = offsetZ + z;
        const waveY = Math.sin(worldX * 0.08 + time * 2) * 0.35 +
                      Math.cos(worldZ * 0.08 + time * 1.5) * 0.35;

        const worldPt = new Vec3(worldX, waveY, worldZ);
        const pCam = this.camera.worldToCamera(worldPt);

        if (pCam.z > this.camera.near) {
          const pScr = this.camera.project(pCam, viewW, viewH);
          if (pScr && pScr.visible) {
            if (prevPt) {
              ctx.beginPath();
              ctx.moveTo(prevPt.x, prevPt.y);
              ctx.lineTo(pScr.x, pScr.y);
              ctx.stroke();
            }
            prevPt = pScr;
          } else {
            prevPt = null;
          }
        } else {
          prevPt = null;
        }
      }
    }

    // Linhas longitudinais (ao longo de X)
    for (let z = -gridSize * step; z <= gridSize * step; z += step * 2) {
      let prevPt = null;
      for (let x = -gridSize * step; x <= gridSize * step; x += step) {
        const worldX = offsetX + x;
        const worldZ = offsetZ + z;
        const waveY = Math.sin(worldX * 0.08 + time * 2) * 0.35 +
                      Math.cos(worldZ * 0.08 + time * 1.5) * 0.35;

        const worldPt = new Vec3(worldX, waveY, worldZ);
        const pCam = this.camera.worldToCamera(worldPt);

        if (pCam.z > this.camera.near) {
          const pScr = this.camera.project(pCam, viewW, viewH);
          if (pScr && pScr.visible) {
            if (prevPt) {
              ctx.beginPath();
              ctx.moveTo(prevPt.x, prevPt.y);
              ctx.lineTo(pScr.x, pScr.y);
              ctx.stroke();
            }
            prevPt = pScr;
          } else {
            prevPt = null;
          }
        } else {
          prevPt = null;
        }
      }
    }
  }

  /**
   * Transforma e desenha um objeto wireframe no mundo 3D
   */
  drawWorldObject(ctx, viewW, viewH, mesh, worldPos, rotY = 0, rotZ = 0, rotX = 0, strokeColor, colors, dashed = false) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    if (dashed) {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }

    // Transforma vértices locais para o mundo
    const transformVertex = (v) => {
      let p = v.clone();
      if (rotZ !== 0) p = p.rotateZ(rotZ);
      if (rotX !== 0) p = p.rotateX(rotX);
      if (rotY !== 0) p = p.rotateY(rotY);
      return p.add(worldPos);
    };

    // Desenha linhas
    mesh.lines.forEach(line => {
      const w1 = transformVertex(line[0]);
      const w2 = transformVertex(line[1]);

      const c1 = this.camera.worldToCamera(w1);
      const c2 = this.camera.worldToCamera(w2);

      const clipped = this.camera.clipLineToNearPlane(c1, c2);
      if (clipped) {
        const s1 = this.camera.project(clipped[0], viewW, viewH);
        const s2 = this.camera.project(clipped[1], viewW, viewH);
        if (s1 && s2 && (s1.visible || s2.visible)) {
          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
          ctx.stroke();
        }
      }
    });

    // Desenha pontos luminosos (vértices notáveis)
    ctx.fillStyle = colors.accent;
    mesh.points.forEach(pt => {
      const w = transformVertex(pt);
      const c = this.camera.worldToCamera(w);
      if (c.z > this.camera.near) {
        const s = this.camera.project(c, viewW, viewH);
        if (s && s.visible) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    ctx.setLineDash([]);
  }

  /**
   * Rótulo de texto flutuante em 3D
   */
  drawWorldLabel(ctx, viewW, viewH, text, worldPos, color) {
    const c = this.camera.worldToCamera(worldPos);
    if (c.z > this.camera.near && c.z < 250) {
      const s = this.camera.project(c, viewW, viewH);
      if (s && s.visible) {
        ctx.font = '16px VT323, monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(text, s.x, s.y - 8);
      }
    }
  }

  /**
   * Biruta de vento no canto superior da janela 3D
   */
  drawWindPennant(ctx, viewW, viewH, game, colors) {
    ctx.save();
    const px = 70;
    const py = 60;
    const r = 35;

    ctx.strokeStyle = colors.dim;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '14px VT323, monospace';
    ctx.fillStyle = colors.dim;
    ctx.textAlign = 'center';
    ctx.fillText('N', px, py - r + 12);
    ctx.fillText('S', px, py + r - 4);
    ctx.fillText('W', px - r + 10, py + 4);
    ctx.fillText('E', px + r - 10, py + 4);

    // Seta do Vento Verdadeiro
    const windRad = game.windDir * (Math.PI / 180);
    const wx = px + Math.sin(windRad) * (r - 6);
    const wy = py - Math.cos(windRad) * (r - 6);

    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(wx, wy);
    ctx.stroke();

    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(wx, wy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '15px VT323, monospace';
    ctx.fillText(`VENTO: ${Math.round(game.windSpeed)} KTS`, px, py + r + 18);
    ctx.restore();
  }

  /**
   * Renderiza o Console Tático (Radar Circular e Computador Alfanumérico)
   */
  renderTacticalConsole(ctx, x, w, h, game, colors) {
    ctx.save();
    ctx.translate(x, 0);

    // Fundo do console
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Cabeçalho Retrô
    ctx.font = '20px VT323, monospace';
    ctx.fillStyle = colors.fg;
    ctx.textAlign = 'center';
    ctx.fillText('=== RADAR TÁTICO ===', w / 2, 28);

    // 1. O Radar PPI (Plan Position Indicator)
    const radarCenterX = w / 2;
    const radarCenterY = 160;
    const radarRadius = 110;

    // Círculos de alcance
    ctx.strokeStyle = colors.dim;
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach(ratio => {
      ctx.beginPath();
      ctx.arc(radarCenterX, radarCenterY, radarRadius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Linhas cruzadas de mira
    ctx.beginPath();
    ctx.moveTo(radarCenterX - radarRadius, radarCenterY);
    ctx.lineTo(radarCenterX + radarRadius, radarCenterY);
    ctx.moveTo(radarCenterX, radarCenterY - radarRadius);
    ctx.lineTo(radarCenterX, radarCenterY + radarRadius);
    ctx.stroke();

    // Varredura de radar rotativa
    this.sweepAngle = (this.sweepAngle + 0.035) % (Math.PI * 2);
    const sweepX = radarCenterX + Math.cos(this.sweepAngle) * radarRadius;
    const sweepY = radarCenterY + Math.sin(this.sweepAngle) * radarRadius;

    ctx.strokeStyle = colors.dim;
    ctx.beginPath();
    ctx.moveTo(radarCenterX, radarCenterY);
    ctx.lineTo(sweepX, sweepY);
    ctx.stroke();

    // Rastro histórico do barco no radar
    const radarScale = 0.65; // metros para pixels no radar
    const boat = game.player;

    if (boat.trackHistory && boat.trackHistory.length > 1) {
      ctx.strokeStyle = colors.dim;
      ctx.beginPath();
      boat.trackHistory.forEach((pt, i) => {
        const dx = (pt.x - boat.x) * radarScale;
        const dz = (pt.z - boat.z) * radarScale;
        const rx = radarCenterX + dx;
        const ry = radarCenterY - dz; // +Z é para cima no radar (Norte)
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      });
      ctx.stroke();
    }

    // Alvos no Radar: Bóias
    if (game.buoys) {
      game.buoys.forEach((b, idx) => {
        const dx = (b.x - boat.x) * radarScale;
        const dz = (b.z - boat.z) * radarScale;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= radarRadius) {
          const rx = radarCenterX + dx;
          const ry = radarCenterY - dz;
          ctx.fillStyle = idx === game.currentBuoyIndex ? colors.accent : colors.fg;
          ctx.beginPath();
          ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '13px VT323, monospace';
          ctx.fillText(`B${idx + 1}`, rx + 6, ry + 4);
        }
      });
    }

    // Alvos no Radar: Náufragos
    if (game.survivors) {
      game.survivors.forEach((s, idx) => {
        if (!s.rescued) {
          const dx = (s.x - boat.x) * radarScale;
          const dz = (s.z - boat.z) * radarScale;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= radarRadius) {
            const rx = radarCenterX + dx;
            const ry = radarCenterY - dz;
            ctx.fillStyle = colors.accent;
            ctx.beginPath();
            ctx.arc(rx, ry, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '12px VT323, monospace';
            ctx.fillText('SOS', rx + 5, ry + 3);
          }
        }
      });
    }

    // Barco do jogador no centro do radar (ícone triangular)
    const boatHdgRad = boat.heading * (Math.PI / 180);
    ctx.save();
    ctx.translate(radarCenterX, radarCenterY);
    ctx.rotate(boatHdgRad);

    ctx.strokeStyle = colors.accent;
    ctx.fillStyle = colors.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(5, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 2. Instrumentos Alfanuméricos Estilo PC DOS
    const startY = 300;
    const lineHeight = 26;
    let curY = startY;

    ctx.textAlign = 'left';
    ctx.font = '18px VT323, monospace';

    // Rumo
    const hdgStr = String(Math.round(boat.heading)).padStart(3, '0');
    const cardinalStr = this.getCardinalName(boat.heading);
    this.drawConsoleLine(ctx, 20, curY, 'RUMO (HDG):', `${hdgStr}° [${cardinalStr}]`, colors);
    curY += lineHeight;

    // Velocidade
    const spdStr = boat.speed.toFixed(1);
    this.drawConsoleLine(ctx, 20, curY, 'VELOCIDADE:', `${spdStr} NÓS`, colors);
    curY += lineHeight;

    // Vento Verdadeiro
    const windStr = `${Math.round(game.windSpeed)} KTS @ ${String(Math.round(game.windDir)).padStart(3, '0')}°`;
    this.drawConsoleLine(ctx, 20, curY, 'VENTO REAL:', windStr, colors);
    curY += lineHeight;

    // Vento Aparente e Ângulo
    const relAngle = game.windInfo ? Math.round(game.windInfo.absRelAngle) : 0;
    const sailPointName = this.getPointOfSailName(relAngle);
    this.drawConsoleLine(ctx, 20, curY, 'VENTO APAR:', `${relAngle}° [${sailPointName}]`, colors);
    curY += lineHeight;

    // Trim da Vela
    const trimStr = `${Math.round(boat.sailTrim)}°`;
    this.drawConsoleLine(ctx, 20, curY, 'REG. VELA :', trimStr, colors);
    curY += lineHeight;

    // Barra de Eficiência da Vela
    const effPct = Math.round(boat.efficiency * 100);
    const barsTotal = 12;
    const barsFilled = Math.round(boat.efficiency * barsTotal);
    const barGraph = '[' + '|'.repeat(barsFilled) + ' '.repeat(barsTotal - barsFilled) + ']';
    this.drawConsoleLine(ctx, 20, curY, 'EFICIÊNCIA:', `${barGraph} ${effPct}%`, colors);
    curY += lineHeight + 6;

    // Status da Embarcação (Alerta se em ferro)
    ctx.font = '20px VT323, monospace';
    if (boat.isLuffing) {
      ctx.fillStyle = colors.accent;
      ctx.fillText('! ALERTA: EM FERRO !', 20, curY);
      ctx.font = '15px VT323, monospace';
      ctx.fillText('(VIRE O LEME P/ SAIR DO VENTO)', 20, curY + 18);
    } else {
      ctx.fillStyle = colors.dim;
      ctx.fillText('STATUS: NAVEGANDO BEM', 20, curY);
    }
    curY += 40;

    // Dados da Missão Atual
    ctx.font = '18px VT323, monospace';
    ctx.fillStyle = colors.fg;
    ctx.fillText('----------------------------', 20, curY);
    curY += 18;

    if (game.mode === 'regatta') {
      ctx.fillText(`ETAPA: BÓIA ${game.currentBuoyIndex + 1} DE ${game.buoys.length}`, 20, curY);
      curY += 22;
      const elapsed = Math.floor(game.elapsedTime);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      ctx.fillText(`CRONÔMETRO: ${mins}:${secs}`, 20, curY);
    } else {
      const rescued = game.survivors ? game.survivors.filter(s => s.rescued).length : 0;
      const total = game.survivors ? game.survivors.length : 0;
      ctx.fillText(`RESGATADOS: ${rescued} DE ${total}`, 20, curY);
      curY += 22;
      ctx.fillText(`PONTOS: ${game.score}`, 20, curY);
    }

    ctx.restore();
  }

  drawConsoleLine(ctx, x, y, label, val, colors) {
    ctx.fillStyle = colors.dim;
    ctx.fillText(label, x, y);
    ctx.fillStyle = colors.fg;
    ctx.fillText(val, x + 110, y);
  }

  getCardinalName(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return directions[idx];
  }

  getPointOfSailName(angle) {
    if (angle < 36) return 'NO-GO';
    if (angle < 70) return 'BOLINA';
    if (angle < 115) return 'TRAVÉS';
    if (angle < 155) return 'ALHETA';
    return 'POPA';
  }

  toggleLayoutMode() {
    this.layoutMode = this.layoutMode === 'split' ? 'fullscreen' : 'split';
    return this.layoutMode;
  }

  /**
   * HUD limpo e flutuante para o modo 3D Tela Cheia
   */
  renderFullscreenHUD(ctx, w, h, game, colors) {
    ctx.save();
    const boat = game.player;

    // 1. Barra Superior Translúcida de Instrumentos
    ctx.fillStyle = 'rgba(2, 9, 4, 0.7)';
    ctx.fillRect(10, 10, w - 20, 36);
    ctx.strokeStyle = colors.dim;
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, w - 20, 36);

    ctx.font = '18px VT323, monospace';
    ctx.fillStyle = colors.fg;
    ctx.textAlign = 'left';

    const hdgStr = String(Math.round(boat.heading)).padStart(3, '0');
    const cardStr = this.getCardinalName(boat.heading);
    const spdStr = boat.speed.toFixed(1);
    const windStr = `${Math.round(game.windSpeed)} KTS @ ${String(Math.round(game.windDir)).padStart(3, '0')}°`;
    const trimStr = `${Math.round(boat.sailTrim)}°`;
    const effPct = Math.round(boat.efficiency * 100);

    const hudText = `RUMO: ${hdgStr}° [${cardStr}]  |  VEL: ${spdStr} NÓS  |  VENTO: ${windStr}  |  VELA: ${trimStr}  |  EFIC: ${effPct}%`;
    ctx.fillText(hudText, 25, 34);

    // Alerta no Centro se "Em Ferro"
    if (boat.isLuffing) {
      ctx.font = '22px VT323, monospace';
      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'center';
      ctx.fillText('! ALERTA: EM FERRO (NO-GO) - VIRE O LEME !', w / 2, 80);
    }

    // 2. Mini-Radar Inset no Canto Superior Direito
    const mrX = w - 85;
    const mrY = 120;
    const mrR = 55;

    ctx.fillStyle = 'rgba(2, 9, 4, 0.75)';
    ctx.beginPath();
    ctx.arc(mrX, mrY, mrR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.dim;
    ctx.stroke();

    // Varredura
    const sweepX = mrX + Math.cos(this.sweepAngle) * mrR;
    const sweepY = mrY + Math.sin(this.sweepAngle) * mrR;
    ctx.beginPath();
    ctx.moveTo(mrX, mrY);
    ctx.lineTo(sweepX, sweepY);
    ctx.stroke();

    // Alvos no mini-radar
    const rScale = 0.38;
    if (game.buoys) {
      game.buoys.forEach((b, idx) => {
        const dx = (b.x - boat.x) * rScale;
        const dz = (b.z - boat.z) * rScale;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= mrR) {
          ctx.fillStyle = idx === game.currentBuoyIndex ? colors.accent : colors.fg;
          ctx.beginPath();
          ctx.arc(mrX + dx, mrY - dz, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    if (game.survivors) {
      game.survivors.forEach(s => {
        if (!s.rescued) {
          const dx = (s.x - boat.x) * rScale;
          const dz = (s.z - boat.z) * rScale;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= mrR) {
            ctx.fillStyle = colors.accent;
            ctx.beginPath();
            ctx.arc(mrX + dx, mrY - dz, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    // Barco no centro do mini-radar
    ctx.save();
    ctx.translate(mrX, mrY);
    ctx.rotate(boat.heading * (Math.PI / 180));
    ctx.strokeStyle = colors.accent;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 3. Status da Missão no Canto Inferior
    ctx.font = '18px VT323, monospace';
    ctx.fillStyle = colors.fg;
    ctx.textAlign = 'right';
    if (game.mode === 'regatta') {
      const elapsed = Math.floor(game.elapsedTime);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      ctx.fillText(`BÓIA ${game.currentBuoyIndex + 1} DE ${game.buoys.length}  |  TEMPO: ${m}:${s}`, w - 25, h - 20);
    } else {
      const rescued = game.survivors ? game.survivors.filter(sv => sv.rescued).length : 0;
      ctx.fillText(`RESGATADOS: ${rescued} DE ${game.survivors.length}  |  PTS: ${game.score}`, w - 25, h - 20);
    }

    ctx.restore();
  }
}
