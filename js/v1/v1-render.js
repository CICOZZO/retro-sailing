/**
 * SAILING (1982 - WIND PRODUCTIONS) - RENDERIZADOR CGA 320x200 (PALETA 0)
 *
 * Layout (medido no vídeo de referência):
 *   mar          x 8..191   y 8..191     (184 x 184, um setor do mundo)
 *   barco/leme   x 200..311 y 8..119     (visto de cima, gira com o rumo)
 *   velocidade   x 200..311 y 121..126
 *   radar/mapa   x 200..311 y 128..191   (112 x 64)
 *   D (dano)     x 194..196,  F (combustível) x 313..315
 *   rodapé       y 192..199  (tempo, barcos, pontuação)
 * Cores: 0 preto, 1 verde, 2 vermelho, 3 marrom.
 */

const V1_SKULL = [0x3C, 0x7E, 0xDB, 0xFF, 0xE7, 0x7E, 0x5A, 0x00];
const V1_SAIL_SPRITE = [
  '...B....',
  '...BG...',
  '...BGG..',
  '...BGGG.',
  '...B....',
  '.RRRRRR.'
];
const V1_CASTAWAY_SPRITE = ['.BBBB.', 'BRBBRB', 'BBRRBB', 'BRBBRB', '.BBBB.'];
const V1_SPEEDBOAT_SPRITE = ['...RR...', '.GGGGGGG.', '..GGGGG..'];
const V1_HULL = [0, 3, 6, 8.5, 10, 11, 11, 10.5, 9.5, 8, 6, 4, 2];

class V1Renderer {
  constructor(canvas) {
    this.cga = new V1CGA(canvas);
  }

  // ------------------------------------------------------------ helpers
  sprite(rows, cx, cy, flip = false) {
    const cga = this.cga;
    const h = rows.length, w = rows[0].length;
    const ox = Math.round(cx - w / 2), oy = Math.round(cy - h / 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][flip ? w - 1 - x : x];
        if (ch === 'G') cga.pset(ox + x, oy + y, 1);
        else if (ch === 'R') cga.pset(ox + x, oy + y, 2);
        else if (ch === 'B') cga.pset(ox + x, oy + y, 3);
      }
    }
  }

  fillPoly(pts, c) {
    const cga = this.cga;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) {
          xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) cga.pset(x, y, c);
      }
    }
  }

  bigText(str, x, y, scale, c) {
    const cga = this.cga;
    str = String(str).toUpperCase();
    for (let i = 0; i < str.length; i++) {
      const g = cga.glyphs[str.charCodeAt(i)];
      if (!g) continue;
      for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
        if (g[gy * 8 + gx]) cga.fill(x + (i * 8 + gx) * scale, y + gy * scale, scale, scale, c);
      }
    }
  }

  skull(x, y) {
    const cga = this.cga;
    for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
      if ((V1_SKULL[gy] >> (7 - gx)) & 1) cga.pset(x + gx, y + gy, 3);
    }
  }

  mmss(t) {
    t = Math.max(0, Math.floor(t));
    const m = Math.floor(t / 60), s = t % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // ------------------------------------------------------------ frame
  render(game) {
    const cga = this.cga;
    cga.resetClip();

    if (game.state === 'TITLE') {
      this.renderTitle(game);
      cga.present();
      return;
    }

    cga.clear(3);
    cga.fill(8, 8, 184, 184, 0);       // mar
    cga.fill(200, 8, 112, 112, 0);     // barco
    cga.fill(200, 128, 112, 64, 0);    // radar

    this.renderCloseUp(game);
    this.renderSpeed(game);
    this.renderRadar(game);
    this.renderGauges(game);
    this.renderFooter(game);

    switch (game.state) {
      case 'MENU': this.renderMenu(); break;
      case 'INSTRUCTIONS': this.renderInstructions(game); break;
      case 'LEG_INTRO': this.renderLegIntro(game); break;
      case 'PLAYING': this.renderSea(game); break;
      case 'LEG_DONE': this.renderLegDone(game); break;
      case 'GAMEOVER': this.renderGameOver(game); break;
    }
    cga.present();
  }

  // ------------------------------------------------------------ título
  renderTitle(game) {
    const cga = this.cga;
    cga.clear(0);
    cga.rect(0, 0, 320, 200, 1);
    cga.rect(1, 1, 318, 198, 1);
    cga.text('Wind Productions', 16, 8, 3);
    cga.text('(C)opyright 1982', 192, 8, 3);
    cga.text('presents', 24, 16, 3);

    this.bigText('Sailing', 74, 42, 5, 1);
    this.bigText('Sailing', 72, 40, 5, 2);

    cga.text('...an adventure in the', 72, 108, 3);
    cga.text('Bermuda Triangle', 96, 120, 3);
    cga.text('by', 152, 140, 3);
    cga.text('Blackbeard....', 104, 152, 3);

    this.drawMist(36, 176, 18, 10, game.clock);
    this.sprite(V1_SAIL_SPRITE, 70, 178);
    if (Math.floor(game.clock * 2) % 2 === 0) cga.text('(any key to start  )', 80, 184, 3);
  }

  // ------------------------------------------------------------ painel esquerdo
  textPane(lines, bottom) {
    const cga = this.cga;
    cga.fill(8, 8, 184, 184, 0);
    const first = lines[0] || '';
    cga.text(first, 8 + Math.floor((184 - first.length * 8) / 2), 12, 3);
    for (let i = 1; i < lines.length; i++) cga.text(lines[i], 12, 12 + i * 10, 3);
    if (bottom) cga.text(bottom, 8 + Math.floor((184 - bottom.length * 8) / 2), 180, 3);
  }

  renderMenu() {
    const cga = this.cga;
    cga.fill(8, 8, 184, 184, 0);
    cga.text('SAILING', 8 + Math.floor((184 - 56) / 2), 12, 3);
    const lines = [
      'Before playing, you', 'may wish to review', 'some or all of the',
      'instruction screens.', 'Select option.', '',
      '(B) to begin game', '(P) for practice leg', '(X) exit to system', '',
      '(A)ll instructions', '(O)bject of the game', '(C)ontrols', '(S)coring',
      '(H)azards', '(G)auges'
    ];
    lines.forEach((l, i) => cga.text(l, 12, 26 + i * 10, 3));
    cga.text('TYPE OPTION', 8 + Math.floor((184 - 88) / 2), 182, 3);
  }

  renderInstructions(game) {
    const pages = V1Game.PAGES[game.instrKey];
    const lines = pages[game.instrPage] || pages[0];
    this.textPane(lines, 'Hit SPACE to continue');
    if (game.instrKey === 'H') {
      const cga = this.cga, cx = 100, cy = 56;
      if (game.instrPage === 0) this.drawMist(cx, cy, 14, 10, game.clock);
      if (game.instrPage === 1) this.drawVortex(cx, cy, 22);
      if (game.instrPage === 2) this.sprite(V1_SPEEDBOAT_SPRITE, cx, cy);
      if (game.instrPage === 3) for (let x = 20; x < 180; x += 3) cga.pset(x, cy + (x % 2), 1);
    }
  }

  renderLegIntro(game) {
    const m = game.map;
    this.renderSea(game);
    const cga = this.cga;
    cga.fill(24, 60, 152, 72, 0);
    cga.rect(24, 60, 152, 72, 3);
    cga.textCenter(game.practice ? 'PRACTICE LEG' : 'LEG ' + game.leg + ' OF 3', 24, 152, 68, 3);
    cga.textCenter(m.ports[m.legs[game.leg].from].name, 24, 152, 84, 2);
    cga.textCenter('TO', 24, 152, 94, 3);
    cga.textCenter(m.ports[m.legs[game.leg].to].name, 24, 152, 104, 2);
    cga.textCenter('Hit SPACE to sail', 24, 152, 118, 3);
  }

  renderLegDone(game) {
    this.renderSea(game);
    const cga = this.cga;
    cga.fill(16, 40, 168, 112, 0);
    cga.rect(16, 40, 168, 112, 3);
    cga.textCenter('LEG ' + game.leg + ' COMPLETE', 16, 168, 48, 3);
    cga.text('TIME   ' + this.mmss(game.time), 28, 70, 3);
    cga.text('SAVED  ' + game.rescued + '/7', 28, 82, 3);
    cga.text('BONUS  ' + game.lastBonus, 28, 94, 3);
    cga.text('SCORE  ' + game.score, 28, 106, 2);
    cga.textCenter('Hit SPACE', 16, 168, 130, 3);
  }

  renderGameOver(game) {
    const cga = this.cga;
    cga.fill(8, 8, 184, 184, 0);
    cga.textCenter('GAME OVER', 8, 184, 50, 2);
    cga.textCenter('FINAL SCORE', 8, 184, 84, 3);
    cga.textCenter(String(game.score), 8, 184, 98, 2);
    cga.textCenter('Hit SPACE', 8, 184, 150, 3);
  }

  // ------------------------------------------------------------ mar
  renderSea(game) {
    const cga = this.cga, m = game.map, b = game.boat;
    const sx = Math.floor(b.x / m.SEC), sy = Math.floor(b.y / m.SEC);
    const wx0 = sx * m.SEC, wy0 = sy * m.SEC;
    const ox = 8 - wx0, oy = 8 - wy0;
    cga.setClip(8, 8, 184, 184);
    cga.fill(8, 8, 184, 184, 0);

    // terra e caveiras
    const c0 = sx * 23, r0 = sy * 23;
    for (let r = 0; r < 23; r++) {
      for (let c = 0; c < 23; c++) {
        const cx = c0 + c, cy = r0 + r;
        const px = 8 + c * 8, py = 8 + r * 8;
        if (m.isWallCell(cx, cy)) this.skull(px, py);
        else if (m.isLandCell(cx, cy)) cga.fill(px, py, 8, 8, 1);
      }
    }

    // porto de chegada
    const p = m.endPort;
    if (Math.floor(p.x / m.SEC) === sx && Math.floor(p.y / m.SEC) === sy &&
        Math.floor(game.clock * 2) % 2 === 0) {
      cga.fill(p.x + ox - 4, p.y + oy - 4, 8, 8, 3);
      cga.fill(p.x + ox - 2, p.y + oy - 2, 4, 4, 0);
    }

    // tempestade
    if (Math.floor(m.storm.y / m.SEC) === sy) {
      const y = Math.round(m.storm.y + oy);
      for (let x = 8; x < 192; x += 2) cga.pset(x, y, 1);
    }

    for (const v of m.vortices) {
      if (this.inSector(v, sx, sy, m)) this.drawVortex(v.x + ox, v.y + oy, v.r);
    }
    for (const mist of m.mists) {
      if (this.inSector(mist, sx, sy, m)) this.drawMist(mist.x + ox, mist.y + oy, 13, 9, game.clock);
    }
    for (const c of m.castaways) {
      if (!c.got && this.inSector(c, sx, sy, m)) this.sprite(V1_CASTAWAY_SPRITE, c.x + ox, c.y + oy);
    }
    for (const s of m.speedboats) {
      if (this.inSector(s, sx, sy, m)) this.sprite(V1_SPEEDBOAT_SPRITE, s.x + ox, s.y + oy, s.vx < 0);
    }

    this.sprite(V1_SAIL_SPRITE, b.x + ox, b.y + oy);
    cga.resetClip();

    if (game.messageTimer > 0 && game.state === 'PLAYING') {
      cga.fill(8, 8, 184, 10, 0);
      cga.textCenter(game.message, 8, 184, 9, 3);
    }
    if (game.paused) {
      cga.fill(48, 88, 96, 16, 0);
      cga.rect(48, 88, 96, 16, 3);
      cga.textCenter('PAUSED', 48, 96, 92, 3);
    }
  }

  inSector(o, sx, sy, m) {
    return Math.floor(o.x / m.SEC) === sx && Math.floor(o.y / m.SEC) === sy;
  }

  drawVortex(x, y, r) {
    const cga = this.cga;
    let c = 3;
    for (let rr = 2; rr <= r; rr += 2) { cga.circle(Math.round(x), Math.round(y), rr, c); c = c === 3 ? 2 : 3; }
  }

  drawMist(x, y, rx, ry, t) {
    const cga = this.cga;
    let s = Math.floor(t * 8) * 2654435761 >>> 0;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (let i = 0; i < 120; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      cga.pset(Math.round(x + Math.cos(a) * rx * d), Math.round(y + Math.sin(a) * ry * d), 1 + Math.floor(rnd() * 3));
    }
  }

  // ------------------------------------------------------------ painel direito
  renderCloseUp(game) {
    const cga = this.cga, b = game.boat;
    cga.setClip(200, 8, 112, 112);
    const cx = 256, cy = 64, L = 62;
    const hr = b.heading * Math.PI / 180;
    const f = [Math.sin(hr), -Math.cos(hr)];
    const rt = [Math.cos(hr), Math.sin(hr)];

    const left = [], right = [];
    for (let i = 0; i < V1_HULL.length; i++) {
      const t = i / (V1_HULL.length - 1);
      const px = cx + f[0] * (L / 2 - t * L), py = cy + f[1] * (L / 2 - t * L);
      left.push([px - rt[0] * V1_HULL[i], py - rt[1] * V1_HULL[i]]);
      right.push([px + rt[0] * V1_HULL[i], py + rt[1] * V1_HULL[i]]);
    }
    this.fillPoly(left.concat(right.reverse()), 2);

    const bow = [cx + f[0] * L / 2, cy + f[1] * L / 2];
    const stern = [cx - f[0] * L / 2, cy - f[1] * L / 2];

    // flâmula indicadora de vento na proa (verde, aponta de forma firme na direção do vento)
    const windDeg = typeof b.windTo === 'function' ? b.windTo() : ((V1_WIND_FROM + 180) % 360);
    const wr = windDeg * Math.PI / 180;
    const wLen = 10;
    const wx = Math.sin(wr), wy = -Math.cos(wr);
    const tipX = Math.round(bow[0] + wx * wLen), tipY = Math.round(bow[1] + wy * wLen);
    cga.line(Math.round(bow[0]), Math.round(bow[1]), tipX, tipY, 1);

    // retranca (laranja) a partir do mastro a ~20% do casco
    const mast = [cx + f[0] * (L / 2 - L * 0.2), cy + f[1] * (L / 2 - L * 0.2)];
    const bb = b.boomBearing() * Math.PI / 180;
    cga.line(Math.round(mast[0]), Math.round(mast[1]),
             Math.round(mast[0] + Math.sin(bb) * 42), Math.round(mast[1] - Math.cos(bb) * 42), 3);

    // pá do leme (verde)
    const rb = b.rudderBearing() * Math.PI / 180;
    cga.line(Math.round(stern[0]), Math.round(stern[1]),
             Math.round(stern[0] + Math.sin(rb) * 14), Math.round(stern[1] - Math.cos(rb) * 14), 1);
    cga.resetClip();
  }

  renderSpeed(game) {
    const cga = this.cga, b = game.boat;
    cga.fill(200, 120, 112, 8, 3);
    cga.fill(200, 122, 112, 1, 2);
    for (let x = 200; x < 312; x += 8) cga.fill(x, 120, 1, 5, 2);
    const w = Math.round(112 * Math.min(1, b.speed / V1_MAX_SPEED));
    cga.fill(200, 121, w, 3, 2);
  }

  renderRadar(game) {
    const cga = this.cga, m = game.map, b = game.boat;
    const X = 200, Y = 128, W = 112, H = 64;
    for (let my = 0; my < H; my++) {
      const cy = Math.floor(my * m.CH / H);
      for (let mx = 0; mx < W; mx++) {
        const cx = Math.floor(mx * m.CW / W);
        if (m.land[cy * m.CW + cx]) cga.pset(X + mx, Y + my, 1);
      }
    }
    const toX = v => X + Math.min(W - 1, Math.floor(v * W / m.W));
    const toY = v => Y + Math.min(H - 1, Math.floor(v * H / m.H));
    for (const c of m.castaways) if (!c.got) cga.pset(toX(c.x), toY(c.y), 3);
    const p = m.endPort;
    if (Math.floor(game.clock * 3) % 2 === 0) cga.fill(toX(p.x), toY(p.y), 2, 2, 3);
    if (game.state === 'PLAYING' || game.state === 'LEG_INTRO') {
      if (Math.floor(game.clock * 4) % 2 === 0) cga.fill(toX(b.x), toY(b.y), 2, 2, 2);
    }
  }

  renderGauges(game) {
    const cga = this.cga, b = game.boat;
    // D (dano) à esquerda, F (combustível) à direita do radar
    const bar = (x, frac, c) => {
      cga.fill(x + 1, 130, 1, 60, 2);
      for (let y = 130; y <= 190; y += 8) cga.fill(x, y, 3, 1, 2);
      const h = Math.round(60 * frac);
      cga.fill(x, 190 - h, 3, h, c);
    };
    cga.fill(193, 126, 6, 66, 3);
    cga.fill(313, 126, 6, 66, 3);
    bar(194, b.damage / 100, 2);
    bar(313, b.fuel / 100, 1);
    cga.text('D', 192, 120, 2);
    cga.text('F', 312, 120, 2);

    // setas de vento (apontam para onde o vento sopra)
    const windDeg = typeof b.windTo === 'function' ? b.windTo() : ((V1_WIND_FROM + 180) % 360);
    const wr = windDeg * Math.PI / 180;
    for (const x of [197, 311]) {
      const y = 40, dx = Math.sin(wr) * 12, dy = -Math.cos(wr) * 12;
      cga.line(Math.round(x - dx), Math.round(y - dy), Math.round(x + dx), Math.round(y + dy), 2);
      cga.fill(Math.round(x + dx) - 1, Math.round(y + dy) - 1, 3, 3, 2);
    }
  }

  renderFooter(game) {
    const cga = this.cga;
    cga.fill(200, 192, 120, 8, 3);
    cga.text(this.mmss(game.time), 200, 192, 2);
    for (let i = 0; i < game.boats; i++) this.sprite(V1_SAIL_SPRITE, 240 + i * 9, 196);
    cga.text(String(Math.max(0, game.score)).padStart(5, '0'), 276, 192, 2);
  }
}

if (typeof window !== 'undefined') window.V1Renderer = V1Renderer;
