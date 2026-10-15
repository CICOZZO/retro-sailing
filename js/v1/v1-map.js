/**
 * SAILING (1982 - WIND PRODUCTIONS) - MUNDO, PORTOS E PERIGOS
 *
 * O mundo é uma grade de 7 x 4 "setores" de 184 x 184 px (o tamanho da tela
 * do mar). A tela troca de setor quando o barco cruza a borda. A moldura mais
 * externa do mundo é uma parede de caveiras. O mapa pequeno (radar) mostra o
 * mundo inteiro: costa dos EUA, Cuba, Hispaniola, Bahamas, Bermuda e Porto Rico.
 */

class V1Map {
  constructor() {
    this.CELL = 8;
    this.CW = 161;           // células de 8 px (7 setores x 23)
    this.CH = 92;            // 4 setores x 23
    this.SEC = 184;          // lado de um setor em px
    this.W = this.CW * this.CELL;
    this.H = this.CH * this.CELL;

    this.land = new Uint8Array(this.CW * this.CH);
    this.buildLand();

    // Portos (px do mundo). Pernas: Miami -> Bermuda -> San Juan -> Miami
    this.ports = [
      null,
      { name: 'MIAMI',    x: 21 * 8 + 4,  y: 52 * 8 + 4 },
      { name: 'BERMUDA',  x: 137 * 8 + 4, y: 15 * 8 + 4 },
      { name: 'SAN JUAN', x: 101 * 8 + 4, y: 76 * 8 + 4 }
    ];
    this.legs = [
      null,
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 1 }
    ];

    this.castaways = [];
    this.mists = [];
    this.vortices = [];
    this.speedboats = [];
    this.storm = { y: 300, dir: 1 };
  }

  // ------------------------------------------------------------ terra
  buildLand() {
    const polys = [
      // costa leste dos EUA + Florida
      [[0,0],[6,0],[7,9],[6,20],[9,30],[13,38],[16,48],[18,58],[15,61],[11,52],[8,44],[0,44]],
      // Cuba
      [[0,70],[10,64],[26,66],[44,72],[60,78],[58,82],[40,80],[20,76],[0,80]],
      // Hispaniola
      [[62,78],[74,76],[82,80],[76,86],[64,84]],
      // Porto Rico
      [[96,80],[106,79],[106,83],[96,83]],
      // Bermuda
      [[132,8],[140,6],[144,8],[138,11],[132,10]]
    ];
    for (const p of polys) this.fillPolyCells(p);

    // Bahamas e ilhotas
    const bah = [[30,40,3,2],[36,44,2,3],[40,36,3,2],[44,52,2,3],[48,46,3,2],
                 [52,56,2,2],[58,50,3,2],[62,60,2,3],[34,52,2,2],[26,48,2,3],
                 [70,58,3,2],[66,66,2,2],[84,50,2,2],[90,60,3,2],[110,40,2,2]];
    for (const [x, y, w, h] of bah) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setLand(x + i, y + j);
    }
  }

  setLand(cx, cy) {
    if (cx >= 0 && cy >= 0 && cx < this.CW && cy < this.CH) this.land[cy * this.CW + cx] = 1;
  }

  fillPolyCells(pts) {
    for (let cy = 0; cy < this.CH; cy++) {
      const y = cy + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let cx = Math.ceil(xs[k] - 0.5); cx < xs[k + 1] - 0.5; cx++) this.setLand(cx, cy);
      }
    }
  }

  isLandCell(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.CW || cy >= this.CH) return true;
    return this.land[cy * this.CW + cx] === 1;
  }

  isWallCell(cx, cy) {
    return cx <= 0 || cy <= 0 || cx >= this.CW - 1 || cy >= this.CH - 1;
  }

  /** Ponto (px) dentro de terra ou da parede de caveiras? */
  blocked(x, y) {
    const cx = Math.floor(x / this.CELL), cy = Math.floor(y / this.CELL);
    return this.isWallCell(cx, cy) || this.isLandCell(cx, cy);
  }

  /** Raio r em volta do ponto livre? */
  clear(x, y, r) {
    return !(this.blocked(x - r, y - r) || this.blocked(x + r, y - r) ||
             this.blocked(x - r, y + r) || this.blocked(x + r, y + r));
  }

  // ------------------------------------------------------------ perna
  setupLeg(legNum) {
    const leg = this.legs[legNum];
    this.startPort = this.ports[leg.from];
    this.endPort = this.ports[leg.to];

    let seed = legNum * 7919 + 17;
    const rnd = () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.rnd = rnd;

    const freeSpot = (minFromStart = 0) => {
      for (let n = 0; n < 400; n++) {
        const x = 24 + rnd() * (this.W - 48), y = 24 + rnd() * (this.H - 48);
        if (!this.clear(x, y, 14)) continue;
        if (Math.hypot(x - this.startPort.x, y - this.startPort.y) < minFromStart) continue;
        return { x, y };
      }
      return { x: this.startPort.x + 60, y: this.startPort.y };
    };

    this.castaways = [];
    for (let i = 0; i < 7; i++) this.castaways.push({ ...freeSpot(140), got: false });

    this.mists = [];
    for (let i = 0; i < 6; i++) {
      const p = freeSpot(160);
      const a = rnd() * Math.PI * 2;
      this.mists.push({ x: p.x, y: p.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, r: 12 });
    }

    this.vortices = [];
    for (let i = 0; i < 5; i++) { const p = freeSpot(160); this.vortices.push({ x: p.x, y: p.y, r: 22 }); }

    this.speedboats = [];
    for (let i = 0; i < 4; i++) {
      const p = freeSpot(200);
      const dir = rnd() < 0.5 ? -1 : 1;
      this.speedboats.push({ x: p.x, y: p.y, vx: dir * (14 + rnd() * 6), vy: (rnd() - 0.5) * 6 });
    }

    this.storm = { y: 120 + rnd() * 450, dir: rnd() < 0.5 ? -1 : 1 };
  }

  update(dt) {
    for (const m of this.mists) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (!this.clear(m.x, m.y, 8)) { m.vx = -m.vx; m.vy = -m.vy; m.x += m.vx * dt * 2; m.y += m.vy * dt * 2; }
    }
    for (const s of this.speedboats) {
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
      if (this.clear(nx, ny, 5)) { s.x = nx; s.y = ny; }
      else { s.vx = -s.vx; s.vy = (this.rnd() - 0.5) * 8; }
    }
    this.storm.y += this.storm.dir * 5 * dt;
    if (this.storm.y < 40 || this.storm.y > this.H - 40) this.storm.dir = -this.storm.dir;
  }
}

if (typeof window !== 'undefined') window.V1Map = V1Map;
