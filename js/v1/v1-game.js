/**
 * SAILING (1982 - WIND PRODUCTIONS) - ESTADO DO JOGO, REGRAS E PONTUAÇÃO
 *
 * Estados: TITLE, MENU, INSTRUCTIONS, LEG_INTRO, PLAYING, LEG_DONE, GAMEOVER.
 * Pontuação inferida (a tela de scoring não aparece no vídeo de referência):
 * náufrago/rafter +100, bônus de tempo ao chegar no porto, mist/vortex -25,
 * speed boat -50.
 */

class V1Game {
  constructor() {
    this.map = new V1Map();
    this.boat = new V1Boat();

    this.state = 'TITLE';
    this.instrKey = 'O';
    this.instrAll = false;

    this.leg = 1;
    this.practice = false;
    this.boats = 5;
    this.score = 0;
    this.time = 0;
    this.rescued = 0;
    this.paused = false;
    this.stormTimer = 0;
    this.hitCooldown = 0;
    this.message = '';
    this.messageTimer = 0;
    this.lastBonus = 0;
    this.clock = 0;

    // perna 1 já montada para que o menu possa desenhar o radar
    this.map.setupLeg(1);
    this.placeAtStart();
  }

  // ------------------------------------------------------------ menus
  anyKey() {
    if (this.state === 'TITLE') this.state = 'MENU';
    this.beep();
  }

  openInstructions(key) {
    this.state = 'INSTRUCTIONS';
    this.instrAll = key === 'A';
    this.instrKey = this.instrAll ? 'O' : key;
    this.instrPage = 0;
    this.beep();
  }

  nextInstructionPage() {
    const pages = V1Game.PAGES[this.instrKey];
    if (this.instrPage + 1 < pages.length) { this.instrPage++; this.beep(); return; }
    if (this.instrAll) {
      const order = ['O', 'C', 'S', 'G', 'H'];
      const i = order.indexOf(this.instrKey);
      if (i >= 0 && i + 1 < order.length) {
        this.instrKey = order[i + 1];
        this.instrPage = 0;
        this.beep();
        return;
      }
    }
    this.state = 'MENU';
    this.instrAll = false;
    this.beep();
  }

  beep() { if (window.v1Audio) window.v1Audio.beepClick(); }

  // ------------------------------------------------------------ partida
  startGame(practice) {
    this.practice = practice;
    this.boats = 5;
    this.score = 0;
    this.startLeg(1);
  }

  startLeg(n) {
    this.leg = n;
    this.map.setupLeg(n);
    this.time = 0;
    this.rescued = 0;
    this.stormTimer = 0;
    this.paused = false;
    this.message = '';
    this.placeAtStart();
    this.state = 'LEG_INTRO';
    if (window.v1Audio) window.v1Audio.legStart();
  }

  placeAtStart() {
    const p = this.map.startPort;
    this.boat.reset(p.x, p.y, 0);
  }

  beginSailing() {
    this.state = 'PLAYING';
  }

  say(text) {
    this.message = text;
    this.messageTimer = 3;
  }

  endGame() {
    this.state = 'GAMEOVER';
    if (window.v1Audio) window.v1Audio.gameOver();
  }

  // ------------------------------------------------------------ comandos
  get reversed() { return this.stormTimer > 0; }

  rudderCmd(dir) {         // dir: -1 bombordo (4), +1 boreste (6)
    if (this.state !== 'PLAYING' || this.paused) return;
    this.boat.steer((this.reversed ? -dir : dir) * 5);
  }

  centerRudderCmd() {
    if (this.state !== 'PLAYING' || this.paused) return;
    this.boat.centerRudder();
  }

  sheetCmd(deg) {          // deg > 0 folga (7/8/9), deg < 0 caça (1/2/3)
    if (this.state !== 'PLAYING' || this.paused) return;
    this.boat.trim(deg);
    if (window.v1Audio) window.v1Audio.sheetClick();
  }

  /** Controles deslizantes (mobile): ângulos absolutos. */
  setRudderAngle(deg) {
    if (this.state !== 'PLAYING' || this.paused) return;
    const d = Math.max(-V1_MAX_RUDDER, Math.min(V1_MAX_RUDDER, deg));
    this.boat.rudder = this.reversed ? -d : d;
  }

  setSheetAngle(deg) {
    if (this.state !== 'PLAYING' || this.paused) return;
    this.boat.sheet = Math.max(0, Math.min(90, deg));
  }

  toggleEngine() { if (this.state === 'PLAYING') this.boat.engine = !this.boat.engine; }
  togglePause() { if (this.state === 'PLAYING') this.paused = !this.paused; }
  toggleSound() { if (window.v1Audio) window.v1Audio.toggleMute(); }

  quit() {                 // Q
    if (this.state === 'PLAYING' || this.state === 'LEG_INTRO') {
      if (this.practice) this.state = 'MENU';
      else this.endGame();
    }
  }

  // ------------------------------------------------------------ simulação
  update(dt) {
    this.clock += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.state !== 'PLAYING' || this.paused) return;

    const m = this.map, b = this.boat;
    this.time += dt;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.stormTimer = Math.max(0, this.stormTimer - dt);

    m.update(dt);
    b.update(dt);

    // movimento com colisão contra terra/parede de caveiras
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    if (m.clear(nx, ny, 3)) {
      b.x = nx; b.y = ny;
    } else {
      b.speed *= 0.3;
      if (this.hitCooldown === 0) {
        this.damageBoat(4);
        this.hitCooldown = 0.6;
        if (window.v1Audio) window.v1Audio.crashThud();
      }
      // empurra um pouco para trás
      b.x -= b.vx * dt * 2; b.y -= b.vy * dt * 2;
    }

    // náufragos
    for (const c of m.castaways) {
      if (!c.got && Math.hypot(c.x - b.x, c.y - b.y) < 9) {
        c.got = true;
        this.rescued++;
        this.score += 100;
        this.say('SURVIVOR RESCUED +100');
        if (window.v1Audio) window.v1Audio.rescueDing();
      }
    }

    // mist: volta ao início da perna
    for (const mist of m.mists) {
      if (Math.hypot(mist.x - b.x, mist.y - b.y) < mist.r) {
        this.score -= 25;
        this.damageBoat(10);
        this.placeAtStart();
        this.say('CREEPING MIST! -25');
        if (window.v1Audio) window.v1Audio.anomalyChime();
        break;
      }
    }

    // vortex: teletransporta
    for (const v of m.vortices) {
      if (Math.hypot(v.x - b.x, v.y - b.y) < 12) {
        this.score -= 25;
        this.damageBoat(10);
        this.teleport();
        this.say('GRAVITATIONAL VORTEX! -25');
        if (window.v1Audio) window.v1Audio.whirlwindWarp();
        break;
      }
    }

    // speed boats: afundam o barco
    for (const s of m.speedboats) {
      if (Math.hypot(s.x - b.x, s.y - b.y) < 7) {
        this.score -= 50;
        this.sink('SPEED BOAT! -50');
        return;
      }
    }

    // tempestade demoníaca: faixa horizontal que cruza o mundo
    if (Math.abs(m.storm.y - b.y) < 7) {
      if (this.stormTimer <= 0) this.say('DEMONIC STORM! CONTROLS REVERSED');
      this.stormTimer = 5;
    }
    if (this.stormTimer > 0) this.damageBoat(0.8 * dt);

    // porto
    const port = m.endPort;
    if (Math.hypot(port.x - b.x, port.y - b.y) < 10) {
      this.completeLeg();
      return;
    }

    if (b.damage >= 100) this.sink('BOAT DESTROYED');
  }

  damageBoat(n) {
    this.boat.damage = Math.min(100, this.boat.damage + n);
  }

  teleport() {
    const m = this.map, b = this.boat;
    for (let n = 0; n < 200; n++) {
      const x = 24 + Math.random() * (m.W - 48), y = 24 + Math.random() * (m.H - 48);
      if (m.clear(x, y, 14) && Math.hypot(x - b.x, y - b.y) > 200) { b.x = x; b.y = y; return; }
    }
  }

  sink(text) {
    this.boats--;
    this.say(text);
    if (window.v1Audio) window.v1Audio.crashThud();
    if (this.boats <= 0) { this.endGame(); return; }
    this.placeAtStart();
    this.boat.damage = 0;
    this.stormTimer = 0;
  }

  completeLeg() {
    this.lastBonus = Math.max(0, 600 - Math.floor(this.time)) * 2;
    this.score += this.lastBonus;
    this.state = 'LEG_DONE';
    if (window.v1Audio) window.v1Audio.portVictory();
  }

  nextLeg() {
    if (this.practice || this.leg >= 3) { this.state = 'GAMEOVER'; return; }
    this.startLeg(this.leg + 1);
  }
}

// Texto das telas de instruções (23 colunas por linha)
V1Game.PAGES = {
  O: [[
    '*MAIN OBJECTIVE*', '',
    'Sail 3 legs of the', 'Bermuda Triangle', 'picking up all',
    'swimmers and rafters', 'stranded in the', 'water. Then stop the',
    'clock and collect', 'bonus by sailing', 'into port at the end', 'of the leg.'
  ]],
  C: [[
    '*NUMERIC KEY PAD*', '',
    'Rudder control:', ' 4:turn to port', '   (counter clockwise)',
    ' 5:center rudder', ' 6:turn to starboard', '   (clockwise)', '',
    'Sail controls:', ' 7:extend 2 deg.', ' 8:extend 5 deg.', ' 9:extend 10 deg.', '',
    ' 1:pull in 2 deg.', ' 2:pull in 5 deg.', ' 3:pull in 10 deg.'
  ], [
    '*ALPHABETIC KEYS*', '',
    ' E - engine on/off', ' S - sound on/off', ' P - pause on/off',
    ' Q - end practice leg', '     or end game and', '     save score', '',
    ' X - exit to system'
  ]],
  S: [[
    '*SCORING*', '',
    'Each swimmer or', 'rafter rescued:', '   100 points', '',
    'Time bonus for', 'reaching port.', '',
    'Penalties:', ' Creeping mist  -25', ' Vortex         -25', ' Speed boat     -50'
  ]],
  G: [[
    '*GAUGES*', '',
    'RADAR SCREEN:', ' lower right corner', ' -your position', ' -swimmer/rafter', ' -end of leg', '',
    'FUEL GAUGE:', ' right of radar', 'DAMAGE GAUGE:', ' left of radar', 'BOAT SPEED:', ' above radar'
  ], [
    '*GAUGES*', '',
    'BELOW RADAR FROM', 'RIGHT TO LEFT:', '',
    '* LEG TIME', '* BOATS REMAINING', '* SCORE', '',
    'WIND DIRECTION:', ' always south to', ' north'
  ]],
  H: [
    ['*HAZARDS*', '', 'CREEPING MIST:', '', '', '', '', 'Drags you back to', 'the beginning of', 'the leg and damages', 'your boat.', '25 point penalty.'],
    ['*HAZARDS*', '', 'GRAVITATIONAL VORTEX:', '', '', '', '', 'Transports you to', 'some other part of', 'the world and adds', 'damage to your boat.', '25 point penalty'],
    ['*HAZARDS*', '', 'SPEED BOATS:', '', '', '', '', 'Will sink your boat', 'if one comes in', 'contact with hull.', '', '50 point penalty.'],
    ['*HAZARDS*', '', 'DEMONIC STORM:', '', 'Cause confusion and', 'disorientation.', 'Controls work in', 'reverse.', 'Causes minor damage', 'to your boat as long', 'as you remain in', 'storm.']
  ]
};

if (typeof window !== 'undefined') window.V1Game = V1Game;
