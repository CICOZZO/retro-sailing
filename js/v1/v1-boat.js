/**
 * SAILING (1983 - DYNETRON COMPANY)
 * Authentic Sailboat Aerodynamics & Hydrodynamics Engine (Versão 1)
 *
 * Implements real physics for Bermuda sloop:
 * - Apparent wind vector (V_apparent = V_true - V_boat)
 * - Sail trim with boom physically constrained to leeward side
 * - Violent gybe clack when boom snaps across the centerline
 * - In-irons stall (No-Go zone < 38°) with luffing sail flutter
 * - Realistic polar speed curve (beam reach fastest, run slower, close-hauled demanding)
 * - Momentum & inertia (speed carries through tacks)
 * - Rudder turning rate proportional to water speed over the blade
 * - Leeway drift when beating upwind
 */

class V1Boat {
  constructor() {
    this.reset(184 * 1.5, 184 * 2.5, 60);
  }

  reset(x, y, heading = 60) {
    this.x = x;
    this.y = y;
    this.heading = (heading + 360) % 360; // 0 = North, 90 = East, 180 = South, 270 = West
    this.speed = 2.4;                    // Knots
    this.maxSpeed = 6.2;                 // Top hull speed in knots

    // Sheet: user controls the sheet line from 10° (tight) to 85° (fully eased)
    this.sheetAngle = 35;

    // Boom: actual boom angle relative to boat centerline (-85° to +85°)
    // Negative = boom to port (left), Positive = boom to starboard (right)
    this.boomAngle = -35;
    this.boomSide = -1;                  // -1 = port, +1 = stbd

    // Rudder / Tiller (-1 to +1)
    this.rudderAngle = 0;
    this.tillerDisplay = 0;              // Smoothly interpolated for UI gauge

    // Aerodynamics state
    this.apparentWindSpeed = 15;
    this.apparentWindAngle = 45;         // Relative to bow (-180 to +180)
    this.isLuffing = false;              // Sail flapping / in-irons
    this.optimalSheet = 35;
    this.pointOfSail = 'REACH';          // IRONS, BEAT, REACH, BROAD, RUN
    this.leeway = 0;

    // Hull integrity / damage (0 = Full 'F', 100 = Destroyed 'D')
    this.damage = 0;

    // Wake trail
    this.wake = [];
    this.wakeTimer = 0;

    // Gybe cooldown
    this.gybeCooldown = 0;
  }

  update(dt, trueWindDir, trueWindSpeed) {
    if (dt <= 0) return;

    // 1. Steering & Rudder Dynamics
    // Turning rate depends on boat speed (steerage way!)
    // In real boats, you cannot steer without water flowing past the rudder.
    const speedRatio = Math.max(0.18, Math.min(1.2, this.speed / 3.0));
    const maxTurnRate = 42.0; // Degrees per second at cruising speed
    if (this.rudderAngle !== 0) {
      this.heading = (this.heading + this.rudderAngle * maxTurnRate * speedRatio * dt + 360) % 360;
    }

    // Smooth tiller display (-1 = hard port, +1 = hard starboard)
    this.tillerDisplay += (this.rudderAngle - this.tillerDisplay) * Math.min(1, dt * 10);

    // 2. Apparent Wind Calculation
    // Boat velocity vector in Cartesian (X = East, Y = North)
    const boatRad = this.heading * (Math.PI / 180);
    const vBoatX = Math.sin(boatRad) * this.speed;
    const vBoatY = -Math.cos(boatRad) * this.speed;

    // True wind blows FROM trueWindDir.
    // Velocity vector of the wind relative to sea:
    const windRad = trueWindDir * (Math.PI / 180);
    // Wind vector points in the direction the air is moving:
    const vWindX = -Math.sin(windRad) * trueWindSpeed;
    const vWindY = Math.cos(windRad) * trueWindSpeed;

    // Apparent wind vector (relative to the moving boat):
    // V_apparent = V_true - V_boat
    const vAppX = vWindX - vBoatX;
    const vAppY = vWindY - vBoatY;
    this.apparentWindSpeed = Math.hypot(vAppX, vAppY);

    // Direction the apparent wind is BLOWING TO:
    const appBlowAngle = (Math.atan2(vAppX, -vAppY) * 180 / Math.PI + 360) % 360;
    // Direction the apparent wind is COMING FROM:
    const appComeFrom = (appBlowAngle + 180) % 360;

    // Apparent wind angle relative to boat heading (-180 to +180)
    // 0 = dead ahead, +90 = from starboard beam, -90 = from port beam, 180 = dead astern
    let relAppWind = appComeFrom - this.heading;
    while (relAppWind > 180) relAppWind -= 360;
    while (relAppWind < -180) relAppWind += 360;
    this.apparentWindAngle = relAppWind;

    const absAWA = Math.abs(relAppWind);
    const windSide = relAppWind >= 0 ? 1 : -1; // +1 = wind from stbd, -1 = wind from port

    // 3. Boom & Sail Physics
    // Wind pushes the sail away towards leeward (opposite side of where wind comes from).
    // If wind is from Starboard (+), boom is pushed to Port (-).
    // If wind is from Port (-), boom is pushed to Starboard (+).
    const targetBoomSide = windSide >= 0 ? -1 : 1;

    // Detect Gybe (passing dead downwind: relAppWind near +-180 switches sign)
    if (this.gybeCooldown > 0) this.gybeCooldown -= dt;
    if (absAWA > 140 && targetBoomSide !== this.boomSide && this.gybeCooldown <= 0) {
      this.boomSide = targetBoomSide;
      this.gybeCooldown = 0.5;
      if (window.v1Audio && window.v1Audio.gybeClack) {
        window.v1Audio.gybeClack();
      }
    } else if (absAWA <= 140) {
      this.boomSide = targetBoomSide;
    }

    // Actual boom angle is bounded by sheetAngle and settles to leeward
    const targetBoomAngle = this.boomSide * this.sheetAngle;
    // Boom moves smoothly towards target
    this.boomAngle += (targetBoomAngle - this.boomAngle) * Math.min(1, dt * 14);

    // 4. Point of Sail & Optimal Sheet Trim
    if (absAWA < 38) {
      this.pointOfSail = 'IRONS';
      this.optimalSheet = 14;
    } else if (absAWA < 60) {
      this.pointOfSail = 'BEAT';
      this.optimalSheet = Math.round(14 + (absAWA - 38) * 0.9);
    } else if (absAWA < 115) {
      this.pointOfSail = 'REACH';
      this.optimalSheet = Math.round(34 + (absAWA - 60) * 0.4);
    } else if (absAWA < 155) {
      this.pointOfSail = 'BROAD';
      this.optimalSheet = Math.round(56 + (absAWA - 115) * 0.45);
    } else {
      this.pointOfSail = 'RUN';
      this.optimalSheet = 82;
    }

    // 5. Sail Lift, Drag, and Forward Thrust
    if (absAWA < 38) {
      // IN-IRONS: No forward lift can be generated!
      this.isLuffing = true;
      // Boat slows down under water resistance
      const drag = 1.8 * dt;
      this.speed = Math.max(0, this.speed - drag);
      this.leeway = 0;
    } else {
      this.isLuffing = false;

      // Sail trim efficiency based on how close sheetAngle is to optimalSheet
      const trimDiff = Math.abs(this.sheetAngle - this.optimalSheet);
      let trimEfficiency = Math.max(0.25, 1.0 - (trimDiff / 38.0));

      // Polar speed factor based on point of sail
      let polarFactor = 0.85;
      if (this.pointOfSail === 'REACH') polarFactor = 1.05;      // Fastest
      else if (this.pointOfSail === 'BROAD') polarFactor = 0.95;
      else if (this.pointOfSail === 'BEAT') polarFactor = 0.78;
      else if (this.pointOfSail === 'RUN') polarFactor = 0.70;

      // Damage reduces max speed
      const damageFactor = Math.max(0.4, 1.0 - (this.damage / 100.0) * 0.6);

      const targetSpeed = this.maxSpeed * (trueWindSpeed / 16.0) * polarFactor * trimEfficiency * damageFactor;

      // Speed inertia: acceleration is gradual, deceleration is also gradual
      if (this.speed < targetSpeed) {
        this.speed += Math.min(targetSpeed - this.speed, 1.6 * dt);
      } else {
        this.speed = Math.max(targetSpeed, this.speed - 1.2 * dt);
      }

      // Leeway drift (sideways slip) - strongest when close-hauled
      if (this.pointOfSail === 'BEAT') {
        this.leeway = this.boomSide * -0.25 * (this.speed / this.maxSpeed);
      } else {
        this.leeway = 0;
      }
    }

    // 6. World Movement
    const travelAngle = (this.heading + this.leeway * 15 + 360) % 360;
    const travelRad = travelAngle * (Math.PI / 180);
    const moveStep = this.speed * 13.5 * dt;
    this.x += Math.sin(travelRad) * moveStep;
    this.y += -Math.cos(travelRad) * moveStep;

    // 7. Wake Trail
    this.wakeTimer += dt;
    if (this.wakeTimer > 0.12 && this.speed > 0.4) {
      this.wakeTimer = 0;
      this.wake.push({
        x: this.x - Math.sin(boatRad) * 7,
        y: this.y + Math.cos(boatRad) * 7,
        life: 1.0
      });
      if (this.wake.length > 18) this.wake.shift();
    }
    for (const w of this.wake) w.life -= dt * 0.7;
    this.wake = this.wake.filter(w => w.life > 0);
  }
}

if (typeof window !== 'undefined') window.V1Boat = V1Boat;
