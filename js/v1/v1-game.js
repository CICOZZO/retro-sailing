/**
 * SAILING (1983 - DYNETRON COMPANY)
 * State Management, 3 Historical Legs & Storytelling (Versão 1)
 *
 * Implements:
 * - 3 authentic legs with realistic trade winds:
 *   Leg 1: Miami -> Bermuda (Headwind from 060°: requires authentic tacking / zig-zag!)
 *   Leg 2: Bermuda -> Puerto Rico (Crosswind from 090°: fast beam reach)
 *   Leg 3: Puerto Rico -> Miami (Tailwind from 115°: broad reach through anomalies)
 * - Sector flip transitions with PC speaker tick
 * - Swimmer rescue, collision physics, hazard interaction, score and lives tracking
 */

class V1Game {
  constructor() {
    this.map = new V1Map();
    this.boat = new V1Boat();

    this.state = 'TITLE'; // 'TITLE', 'INSTRUCTIONS', 'LEG_INTRO', 'PLAYING', 'LEG_COMPLETE', 'GAMEOVER', 'VICTORY'
    this.currentInstruction = 'O';
    this.allInstructionsMode = false;

    this.leg = 1;
    this.isPractice = false;
    this.lives = 4;
    this.score = 0;
    this.elapsedTime = 0;

    // Wind direction (direction wind blows FROM: 0 = North, 90 = East, 180 = South, 270 = West)
    this.windDir = 60;
    this.windSpeed = 16;
    this.windShiftTimer = 0;

    // Sector tracking for flip-screen transitions
    this.lastSecX = 1;
    this.lastSecY = 2;

    // Radio message banner
    this.radioMessage = "";
    this.radioTimer = 0;
  }

  startCampaign() {
    this.isPractice = false;
    this.lives = 4;
    this.score = 0;
    this.startLeg(1);
  }

  startPractice() {
    this.isPractice = true;
    this.lives = 99;
    this.score = 0;
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

    if (legNum === 1) {
      // LEG 1: Miami (Sector 1,2) -> Bermuda (Sector 6,0)
      // Course is ~065° NE. Wind blows from 060° (Direct Headwind!).
      // Start close-hauled on port tack (018°), beating upwind!
      this.boat.reset(276, 450, 18);
      this.boat.speed = 3.6;
      this.boat.sheetAngle = 16;
      this.windDir = 60;
      this.windSpeed = 17;
    } else if (legNum === 2) {
      // LEG 2: Bermuda (Sector 6,0) -> Puerto Rico (Sector 5,4)
      // Course is ~170° S. Wind blows from 090° (Beam Reach!)
      this.boat.reset(1220, 150, 170);
      this.boat.speed = 4.2;
      this.boat.sheetAngle = 45;
      this.windDir = 90;
      this.windSpeed = 19;
    } else {
      // LEG 3: Puerto Rico (Sector 5,4) -> Miami (Sector 0,1)
      // Course is ~305° NW. Wind blows from 115° (Broad Reach!)
      this.boat.reset(1030, 840, 305);
      this.boat.speed = 4.5;
      this.boat.sheetAngle = 60;
      this.windDir = 115;
      this.windSpeed = 21;
    }

    this.lastSecX = Math.floor(this.boat.x / this.map.SECTOR_W);
    this.lastSecY = Math.floor(this.boat.y / this.map.SECTOR_H);

    if (window.v1Audio) window.v1Audio.legStart();
  }

  beginPlaying() {
    this.state = 'PLAYING';
    if (window.v1Audio) window.v1Audio.resume();
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    this.elapsedTime += dt;

    // Radio banner timer
    if (this.radioTimer > 0) {
      this.radioTimer -= dt;
      if (this.radioTimer <= 0) this.radioMessage = "";
    }

    // Gentle realistic wind oscillations (+-5°) every 18 seconds
    this.windShiftTimer += dt;
    if (this.windShiftTimer > 18) {
      this.windShiftTimer = 0;
      const shift = (Math.random() - 0.5) * 8;
      this.windDir = (this.windDir + shift + 360) % 360;
    }

    // 1. Update boat aerodynamics & motion
    this.boat.update(dt, this.windDir, this.windSpeed);

    // 2. Check sector flip transitions
    const curSecX = Math.floor(this.boat.x / this.map.SECTOR_W);
    const curSecY = Math.floor(this.boat.y / this.map.SECTOR_H);

    if (curSecX !== this.lastSecX || curSecY !== this.lastSecY) {
      this.lastSecX = curSecX;
      this.lastSecY = curSecY;
      if (window.v1Audio && window.v1Audio.sectorFlipTick) {
        window.v1Audio.sectorFlipTick();
      }
    }

    // 3. World bounds check
    if (this.boat.x < 10) { this.boat.x = 10; this.boat.speed *= 0.5; }
    if (this.boat.x > this.map.width - 10) { this.boat.x = this.map.width - 10; this.boat.speed *= 0.5; }
    if (this.boat.y < 10) { this.boat.y = 10; this.boat.speed *= 0.5; }
    if (this.boat.y > this.map.height - 10) { this.boat.y = this.map.height - 10; this.boat.speed *= 0.5; }

    // 4. Update dynamic hazards
    this.map.updateHazards(dt);

    // 5. Swimmer rescue check
    for (const s of this.map.swimmers) {
      if (!s.rescued) {
        const dx = s.x - this.boat.x;
        const dy = s.y - this.boat.y;
        if (dx * dx + dy * dy < 24 * 24) {
          s.rescued = true;
          this.score += 500;
          this.radioMessage = `SOS RESCUED: ${s.name}`;
          this.radioTimer = 4.0;
          if (window.v1Audio) window.v1Audio.rescueDing();
        }
      }
    }

    // 6. Island and reef collisions
    if (this.map.checkLandCollision(this.boat.x, this.boat.y)) {
      this.boat.damage = Math.min(100, this.boat.damage + 18 * dt);
      this.boat.speed = Math.max(0, this.boat.speed - 3.5 * dt);
      this.radioMessage = "WARNING: RUN AGROUND ON SHOAL!";
      this.radioTimer = 1.5;
      if (Math.random() < 0.15 && window.v1Audio) window.v1Audio.crashThud();
    }

    if (this.map.checkReefCollision(this.boat.x, this.boat.y)) {
      this.boat.damage = Math.min(100, this.boat.damage + 28 * dt);
      this.boat.speed = Math.max(0, this.boat.speed - 4.0 * dt);
      this.radioMessage = "ALERT: REEF IMPACT!";
      this.radioTimer = 1.5;
      if (Math.random() < 0.15 && window.v1Audio) window.v1Audio.crashThud();
    }

    // 7. Hazard interactions
    for (const haz of this.map.hazards) {
      const dx = haz.x - this.boat.x;
      const dy = haz.y - this.boat.y;
      const distSq = dx * dx + dy * dy;

      if (haz.type === 'shark' && distSq < 20 * 20) {
        this.boat.damage = Math.min(100, this.boat.damage + 10);
        this.radioMessage = "ALERT: SHARK STRIKE ON HULL!";
        this.radioTimer = 2.5;
        if (window.v1Audio) window.v1Audio.crashThud();
      } else if (haz.type === 'speedboat' && distSq < 26 * 26) {
        this.boat.damage = Math.min(100, this.boat.damage + 25);
        this.radioMessage = "ALERT: SPEEDBOAT COLLISION!";
        this.radioTimer = 2.5;
        if (window.v1Audio) window.v1Audio.crashThud();
      } else if (haz.type === 'whirlwind' && distSq < haz.r * haz.r) {
        // Spatial displacement
        this.boat.x = 200 + Math.random() * (this.map.width - 400);
        this.boat.y = 200 + Math.random() * (this.map.height - 400);
        this.radioMessage = "*** VORTEX TIME-SLIP WARP! ***";
        this.radioTimer = 4.0;
        if (window.v1Audio) window.v1Audio.whirlwindWarp();
      } else if (haz.type === 'anomaly' && distSq < haz.r * haz.r) {
        this.score += 20;
        this.radioMessage = "PSYCHIC ANOMALY PULSE DETECTED";
        this.radioTimer = 2.0;
        if (Math.random() < 0.08 && window.v1Audio) window.v1Audio.anomalyChime();
      }
    }

    // 8. Damage check / life loss
    if (this.boat.damage >= 100) {
      this.lives--;
      if (this.lives <= 0) {
        this.state = 'GAMEOVER';
        if (window.v1Audio) window.v1Audio.gameOver();
      } else {
        this.startLeg(this.leg);
      }
      return;
    }

    // 9. Check destination harbour entry
    const port = this.map.ports[this.leg];
    if (port) {
      const pdx = (port.x + port.w / 2) - this.boat.x;
      const pdy = (port.y + port.h / 2) - this.boat.y;
      if (Math.abs(pdx) < port.w && Math.abs(pdy) < port.h) {
        const unrescued = this.map.swimmers.filter(s => !s.rescued).length;
        if (unrescued === 0 || this.isPractice) {
          this.completeLeg();
        } else {
          this.radioMessage = `${unrescued} CASTAWAY(S) REMAIN IN WATER!`;
          this.radioTimer = 2.0;
        }
      }
    }
  }

  completeLeg() {
    this.state = 'LEG_COMPLETE';
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

if (typeof window !== 'undefined') window.V1Game = V1Game;
