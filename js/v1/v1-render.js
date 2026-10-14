/**
 * SAILING (1983 - DYNETRON COMPANY)
 * Authentic CGA 320x200 Mode 4 Raster Renderer (Versão 1)
 *
 * Direct framebuffer rasterization locked to CGA Palette 0:
 * 0 = Black (#000000)
 * 1 = Green (#00aa00)
 * 2 = Red   (#aa0000)
 * 3 = Brown (#aa5500)
 */

class V1Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.cga = new V1CGA(canvas);

    this.blinkTimer = 0;
    this.blinkOn = true;
    this.showTelemetry = false; // Toggle with 'T'
    this.hoveredMenuOption = null;
  }

  toggleTelemetry() {
    this.showTelemetry = !this.showTelemetry;
    return this.showTelemetry;
  }

  render(game, dt = 0.016) {
    this.blinkTimer += dt;
    if (this.blinkTimer > 0.35) {
      this.blinkTimer = 0;
      this.blinkOn = !this.blinkOn;
    }

    const cga = this.cga;
    cga.clear(0);

    // 1. Draw outer CRT bezel and dividing frames (Brown = 3)
    this.renderBezelLayout(cga, game);

    // 2. Render Top-Right Quadrant: Wind-relative boat close-up (x: 200, y: 8, w: 112, h: 102)
    this.renderBoatCloseUp(cga, 200, 8, 112, 102, game);

    // 3. Render Center-Right: Tiller / Rudder gauge (x: 200, y: 112, w: 112, h: 14)
    this.renderTillerGauge(cga, 200, 112, 112, 14, game);

    // 4. Render Bottom-Right: Tactical radar & instruments (x: 200, y: 128, w: 112, h: 62)
    this.renderRadarAndInstruments(cga, 200, 128, 112, 62, game);

    // 5. Render Left Quadrant: Sector Map or Title / Instructions (x: 8, y: 8, w: 184, h: 182)
    if (game.state === 'TITLE') {
      this.renderTitleScreen(cga, 8, 8, 184, 182, game);
    } else if (game.state === 'INSTRUCTIONS') {
      this.renderInstructions(cga, 8, 8, 184, 182, game);
    } else if (game.state === 'LEG_INTRO') {
      this.renderMainMapView(cga, 8, 8, 184, 182, game);
      this.renderModal(cga, 8, 8, 184, 182, [
        `LEG ${game.leg} OF 3`,
        "",
        game.map.ports[game.leg].name,
        "",
        "RESCUE CASTAWAYS &",
        "NAVIGATE TO PORT",
        "",
        "[PRESS ANY KEY / CLICK]"
      ], 3);
    } else if (game.state === 'PLAYING') {
      this.renderMainMapView(cga, 8, 8, 184, 182, game);
      if (this.showTelemetry) {
        this.renderTelemetryHUD(cga, 10, 10, game);
      }
    } else if (game.state === 'LEG_COMPLETE') {
      this.renderMainMapView(cga, 8, 8, 184, 182, game);
      this.renderModal(cga, 8, 8, 184, 182, [
        "HARBOUR REACHED!",
        "",
        `LEG ${game.leg} COMPLETE`,
        `TIME BONUS: +${Math.max(0, 300 - Math.floor(game.elapsedTime)) * 10}`,
        "",
        "[SPACE / CLICK NEXT LEG]"
      ], 1);
    } else if (game.state === 'VICTORY') {
      this.renderMainMapView(cga, 8, 8, 184, 182, game);
      this.renderModal(cga, 8, 8, 184, 182, [
        "*** VICTORY! ***",
        "",
        "TRIANGLE CONQUERED!",
        `FINAL SCORE: ${game.score}`,
        "",
        "YOU ARE A MASTER SAILOR",
        "",
        "[SPACE / CLICK TITLE]"
      ], 1);
    } else if (game.state === 'GAMEOVER') {
      this.renderMainMapView(cga, 8, 8, 184, 182, game);
      this.renderModal(cga, 8, 8, 184, 182, [
        "* SHIPWRECKED *",
        "",
        "YOUR BOAT WAS LOST",
        "IN THE BERMUDA TRIANGLE",
        `FINAL SCORE: ${game.score}`,
        "",
        "[SPACE / CLICK TITLE]"
      ], 2);
    }

    // 6. Bottom Bezel status line (y: 192)
    this.renderBottomStatus(cga, game);

    // Present indexed buffer to canvas
    cga.present();
  }

  // ------------------------------------------------------------- BEZEL LAYOUT
  renderBezelLayout(cga, game) {
    // Outer border (Brown = 3)
    cga.rect(0, 0, 320, 200, 3);
    cga.rect(1, 1, 318, 198, 3);

    // Left Quadrant frame (x: 6, y: 6, w: 188, h: 185)
    cga.rect(6, 6, 188, 185, 3);

    // Top-Right Quadrant frame (x: 198, y: 6, w: 116, h: 105)
    cga.rect(198, 6, 116, 105, 3);

    // Red arrows along top bezel of boat close-up (Authentic Dynetron detail!)
    for (let x = 208; x <= 304; x += 16) {
      cga.line(x, 4, x, 7, 2);
      cga.pset(x - 1, 5, 2);
      cga.pset(x + 1, 5, 2);
    }

    // Tiller bar frame (x: 198, y: 111, w: 116, h: 16)
    cga.rect(198, 111, 116, 16, 3);

    // Bottom-Right Quadrant frame (x: 198, y: 127, w: 116, h: 64)
    cga.rect(198, 127, 116, 64, 3);

    // Bottom separator line (y: 191)
    cga.line(0, 191, 319, 191, 3);
  }

  // ----------------------------------------------------- TOP-RIGHT BOAT CLOSE-UP
  renderBoatCloseUp(cga, x, y, w, h, game) {
    cga.fill(x, y, w, h, 0);

    const cx = x + Math.floor(w / 2);
    const cy = y + Math.floor(h / 2);
    const boat = game.boat;

    // Relative wind angle off the bow:
    // In this display, WIND BLOWS DOWNWARDS from the top bezel (red arrows indicate wind flow).
    // The boat's heading relative to the wind:
    // When heading into the wind, bow points UP (angle = 0).
    // When running with wind, bow points DOWN (angle = 180).
    const relWindDeg = -boat.apparentWindAngle; // Invert so port/stbd match visual orientation
    const relRad = relWindDeg * (Math.PI / 180);

    const cosH = Math.cos(relRad);
    const sinH = Math.sin(relRad);

    // Transform local boat coordinates to screen coordinates
    const toScreen = (lx, ly) => ({
      x: Math.round(cx + lx * cosH - ly * sinH),
      y: Math.round(cy + lx * sinH + ly * cosH)
    });

    // 1. Draw water wake if moving
    if (boat.speed > 0.5) {
      const stern = toScreen(0, 24);
      const w1 = toScreen(-6, 32);
      const w2 = toScreen(6, 32);
      cga.line(stern.x, stern.y, w1.x, w1.y, 1);
      cga.line(stern.x, stern.y, w2.x, w2.y, 1);
    }

    // 2. Boat Hull Outline (Red = 2)
    const bow = toScreen(0, -26);
    const portBow = toScreen(-9, -10);
    const stbdBow = toScreen(9, -10);
    const portMid = toScreen(-10, 8);
    const stbdMid = toScreen(10, 8);
    const portStern = toScreen(-7, 24);
    const stbdStern = toScreen(7, 24);

    cga.line(bow.x, bow.y, portBow.x, portBow.y, 2);
    cga.line(portBow.x, portBow.y, portMid.x, portMid.y, 2);
    cga.line(portMid.x, portMid.y, portStern.x, portStern.y, 2);

    cga.line(bow.x, bow.y, stbdBow.x, stbdBow.y, 2);
    cga.line(stbdBow.x, stbdBow.y, stbdMid.x, stbdMid.y, 2);
    cga.line(stbdMid.x, stbdMid.y, stbdStern.x, stbdStern.y, 2);

    cga.line(portStern.x, portStern.y, stbdStern.x, stbdStern.y, 2);

    // Cockpit & deck details
    const mast = toScreen(0, -6);
    cga.fill(mast.x - 1, mast.y - 1, 3, 3, 3); // Mast (Brown)

    // 3. Boom & Sail (Brown = 3 or Red = 2)
    // Boom rotates around mast by boat.boomAngle
    let boomRad = (relWindDeg + boat.boomAngle + 180) * (Math.PI / 180);
    let boomLen = 22;

    // If luffing (in-irons), vibrate boom and draw fluttering sail!
    let luffOffset = 0;
    if (boat.isLuffing) {
      luffOffset = (Math.random() - 0.5) * 8;
      boomRad += luffOffset * (Math.PI / 180);
      if (window.v1Audio && window.v1Audio.luffFlutter) {
        window.v1Audio.luffFlutter();
      }
    }

    const boomEndX = Math.round(mast.x + Math.sin(boomRad) * boomLen);
    const boomEndY = Math.round(mast.y - Math.cos(boomRad) * boomLen);

    // Boom line (Brown = 3)
    cga.line(mast.x, mast.y, boomEndX, boomEndY, 3);

    // Sail shape / belly curve (drawn towards the wind or billowing)
    const midX = Math.round((mast.x + boomEndX) / 2 + Math.sin(boomRad + 1.57) * (boat.isLuffing ? luffOffset : 4));
    const midY = Math.round((mast.y + boomEndY) / 2 - Math.cos(boomRad + 1.57) * (boat.isLuffing ? luffOffset : 4));
    cga.line(mast.x, mast.y, midX, midY, 3);
    cga.line(midX, midY, boomEndX, boomEndY, 3);

    // Status label at bottom of boat quadrant
    if (boat.isLuffing) {
      if (this.blinkOn) cga.textCenter("IN IRONS", x, w, y + h - 11, 2);
    } else {
      cga.textCenter(boat.pointOfSail, x, w, y + h - 11, 3);
    }
  }

  // ----------------------------------------------------- TILLER / RUDDER GAUGE
  renderTillerGauge(cga, x, y, w, h, game) {
    cga.fill(x, y, w, h, 0);

    const midX = x + Math.floor(w / 2);
    const midY = y + Math.floor(h / 2);

    // Tiller track (Brown = 3)
    cga.line(x + 12, midY, x + w - 12, midY, 3);
    // Center tick mark
    cga.line(midX, midY - 3, midX, midY + 3, 3);
    // Quarter ticks
    cga.line(midX - 22, midY - 2, midX - 22, midY + 2, 3);
    cga.line(midX + 22, midY - 2, midX + 22, midY + 2, 3);

    // 'P' (Port) and 'S' (Starboard) labels
    cga.text("P", x + 3, y + 3, 3);
    cga.text("S", x + w - 9, y + 3, 3);

    // Red indicator block for current rudder position
    const offset = Math.round(game.boat.tillerDisplay * 38);
    const rx = midX + offset - 2;
    cga.fill(rx, midY - 4, 5, 9, 2);
  }

  // --------------------------------------------- RADAR & INSTRUMENTS QUADRANT
  renderRadarAndInstruments(cga, x, y, w, h, game) {
    cga.fill(x, y, w, h, 0);

    // 1. Digital Clock & Lives
    const totalSec = Math.floor(game.elapsedTime);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    cga.text(`${mm}:${ss}`, x + 4, y + 4, 3);

    // Lives icons (red boat silhouettes)
    for (let i = 0; i < Math.min(4, game.lives); i++) {
      const lx = x + 62 + i * 11;
      const ly = y + 5;
      cga.pset(lx + 2, ly, 2);
      cga.line(lx, ly + 2, lx + 4, ly + 2, 2);
      cga.line(lx + 1, ly + 4, lx + 3, ly + 4, 2);
    }

    // 2. Hull Damage Gauge: D [=====] F
    cga.text("D", x + 4, y + 15, 2);
    cga.text("F", x + w - 12, y + 15, 1);
    cga.rect(x + 15, y + 16, w - 30, 6, 3);

    const dmgWidth = Math.round(((w - 32) * (100 - game.boat.damage)) / 100);
    if (dmgWidth > 0) {
      cga.fill(x + 16, y + 17, dmgWidth, 4, 2);
    }

    // 3. Mini Bermuda Triangle Radar Map (x: 204, y: 153, w: 104, h: 36)
    const rx0 = x + 4;
    const ry0 = y + 25;
    const rw = w - 8;
    const rh = 34;
    cga.rect(rx0, ry0, rw, rh, 3);

    // Scale world (1472 x 1104) down to (rw x rh)
    const scaleX = (rw - 4) / game.map.width;
    const scaleY = (rh - 4) / game.map.height;

    // Draw mini green island dots/rects
    for (const island of game.map.islands) {
      const ix = Math.round(rx0 + 2 + island.x * scaleX);
      const iy = Math.round(ry0 + 2 + island.y * scaleY);
      const iw = Math.max(2, Math.round(island.w * scaleX));
      const ih = Math.max(2, Math.round(island.h * scaleY));
      cga.fill(ix, iy, iw, ih, 1);
    }

    // Current sector highlight box
    const secX = Math.floor(game.boat.x / game.map.SECTOR_W);
    const secY = Math.floor(game.boat.y / game.map.SECTOR_H);
    const sx0 = Math.round(rx0 + 2 + (secX * game.map.SECTOR_W) * scaleX);
    const sy0 = Math.round(ry0 + 2 + (secY * game.map.SECTOR_H) * scaleY);
    const sw = Math.round(game.map.SECTOR_W * scaleX);
    const sh = Math.round(game.map.SECTOR_H * scaleY);

    if (this.blinkOn) {
      cga.rect(sx0, sy0, Math.max(4, sw), Math.max(4, sh), 2);
    }

    // Flashing boat pixel
    const bx = Math.round(rx0 + 2 + game.boat.x * scaleX);
    const by = Math.round(ry0 + 2 + game.boat.y * scaleY);
    cga.pset(bx, by, this.blinkOn ? 3 : 2);
  }

  // ----------------------------------------------------------- SECTOR MAP VIEW
  renderMainMapView(cga, x, y, w, h, game) {
    cga.fill(x, y, w, h, 0);
    cga.setClip(x, y, w, h);

    const boat = game.boat;
    const map = game.map;

    // Current Sector Coordinates
    const secX = Math.floor(boat.x / map.SECTOR_W);
    const secY = Math.floor(boat.y / map.SECTOR_H);

    // Sector World Origin
    const secWorldX = secX * map.SECTOR_W;
    const secWorldY = secY * map.SECTOR_H;

    // Transform world coords to screen coords in left quadrant
    const toScreen = (wx, wy) => ({
      x: Math.round(x + (wx - secWorldX)),
      y: Math.round(y + (wy - secWorldY))
    });

    // 1. Draw Islands & Coastlines in this sector (CGA Green = 1)
    // Drawn with 4px stepped CGA blocks for true 1983 pixel fidelity
    for (const island of map.islands) {
      // Check if island intersects this sector
      if (island.x + island.w >= secWorldX && island.x <= secWorldX + map.SECTOR_W &&
          island.y + island.h >= secWorldY && island.y <= secWorldY + map.SECTOR_H) {

        const p0 = toScreen(island.x, island.y);
        const p1 = toScreen(island.x + island.w, island.y + island.h);

        // Fill with stepped 4px blocks
        const bx0 = Math.floor(p0.x / 4) * 4;
        const by0 = Math.floor(p0.y / 4) * 4;
        const bx1 = Math.ceil(p1.x / 4) * 4;
        const by1 = Math.ceil(p1.y / 4) * 4;

        cga.fill(bx0, by0, bx1 - bx0, by1 - by0, 1);
      }
    }

    // 2. Draw Coral Reefs in this sector (Brown = 3)
    for (const reef of map.reefs) {
      const p = toScreen(reef.x, reef.y);
      if (p.x >= x - 20 && p.x <= x + w + 20 && p.y >= y - 20 && p.y <= y + h + 20) {
        cga.circle(p.x, p.y, Math.round(reef.r / 3), 3);
        cga.pset(p.x, p.y, 3);
        cga.pset(p.x - 3, p.y - 2, 3);
        cga.pset(p.x + 3, p.y + 2, 3);
      }
    }

    // 3. Draw Destination Port in this sector
    const port = map.ports[game.leg];
    if (port && port.targetSecX === secX && port.targetSecY === secY) {
      const pp = toScreen(port.x, port.y);
      // Flashing port buoy
      cga.circle(pp.x, pp.y, 6, this.blinkOn ? 1 : 3);
      cga.line(pp.x, pp.y - 8, pp.x, pp.y + 8, 3);
      cga.line(pp.x - 8, pp.y, pp.x + 8, pp.y, 3);
      cga.text("PORT", pp.x - 14, pp.y - 16, 1);
    }

    // 4. Draw Swimmers (Castaways) as brown rings
    for (const s of map.swimmers) {
      if (s.rescued) continue;
      const sp = toScreen(s.x, s.y);
      if (sp.x >= x && sp.x <= x + w && sp.y >= y && sp.y <= y + h) {
        cga.circle(sp.x, sp.y, 3, 3);
        cga.pset(sp.x, sp.y, this.blinkOn ? 2 : 3);
      }
    }

    // 5. Draw Dynamic Hazards (Sharks, Powerboats, Whirlwinds, Anomalies)
    for (const haz of map.hazards) {
      const hp = toScreen(haz.x, haz.y);
      if (hp.x < x - 20 || hp.x > x + w + 20 || hp.y < y - 20 || hp.y > y + h + 20) continue;

      if (haz.type === 'shark') {
        // Red shark fin
        cga.line(hp.x, hp.y - 3, hp.x + 4, hp.y + 2, 2);
        cga.line(hp.x + 4, hp.y + 2, hp.x - 3, hp.y + 2, 2);
        cga.line(hp.x - 3, hp.y + 2, hp.x, hp.y - 3, 2);
      } else if (haz.type === 'speedboat') {
        // Fast red craft with dashed wake
        cga.rect(hp.x - 4, hp.y - 2, 8, 4, 2);
        cga.pset(hp.x - 6, hp.y, 3);
        cga.pset(hp.x - 8, hp.y, 3);
      } else if (haz.type === 'whirlwind') {
        // Swirling vortex
        cga.circle(hp.x, hp.y, 8, 1);
        cga.circle(hp.x, hp.y, 4, 2);
      } else if (haz.type === 'anomaly') {
        // Pulsing alien diamond
        cga.line(hp.x, hp.y - 6, hp.x + 6, hp.y, 2);
        cga.line(hp.x + 6, hp.y, hp.x, hp.y + 6, 2);
        cga.line(hp.x, hp.y + 6, hp.x - 6, hp.y, 2);
        cga.line(hp.x - 6, hp.y, hp.x, hp.y - 6, 2);
        cga.pset(hp.x, hp.y, 3);
      }
    }

    // 6. Draw Boat Wake Trail on Map
    for (const wk of boat.wake) {
      const wp = toScreen(wk.x, wk.y);
      if (wp.x >= x && wp.x <= x + w && wp.y >= y && wp.y <= y + h) {
        cga.pset(wp.x, wp.y, 1);
      }
    }

    // 7. Draw Player's Boat Sprite (Red = 2 with Brown = 3 mast)
    const bp = toScreen(boat.x, boat.y);
    const bRad = boat.heading * (Math.PI / 180);
    const cosB = Math.cos(bRad);
    const sinB = Math.sin(bRad);

    const bTip = { x: Math.round(bp.x + sinB * 7), y: Math.round(bp.y - cosB * 7) };
    const bLeft = { x: Math.round(bp.x - sinB * 5 - cosB * 4), y: Math.round(bp.y + cosB * 5 - sinB * 4) };
    const bRight = { x: Math.round(bp.x - sinB * 5 + cosB * 4), y: Math.round(bp.y + cosB * 5 + sinB * 4) };

    cga.line(bTip.x, bTip.y, bLeft.x, bLeft.y, 2);
    cga.line(bTip.x, bTip.y, bRight.x, bRight.y, 2);
    cga.line(bLeft.x, bLeft.y, bRight.x, bRight.y, 2);

    // Fill inner hull
    const midX = Math.round((bTip.x + bLeft.x + bRight.x) / 3);
    const midY = Math.round((bTip.y + bLeft.y + bRight.y) / 3);
    cga.line(bTip.x, bTip.y, midX, midY, 2);
    cga.line(bLeft.x, bLeft.y, midX, midY, 2);
    cga.line(bRight.x, bRight.y, midX, midY, 2);

    // Prominent mast dot (Brown = 3)
    cga.fill(bp.x - 1, bp.y - 1, 3, 3, 3);

    // 8. Radio narrative overlay banner
    if (game.radioMessage && game.radioTimer > 0) {
      cga.fill(x + 2, y + h - 18, w - 4, 16, 0);
      cga.rect(x + 2, y + h - 18, w - 4, 16, 3);
      cga.text(game.radioMessage.substring(0, 22), x + 6, y + h - 14, 3);
    }

    // Sector coordinates stamp in corner
    cga.text(`SEC ${secX},${secY}`, x + 4, y + 4, 3);

    cga.resetClip();
  }

  // ------------------------------------------------------------- TELEMETRY HUD
  renderTelemetryHUD(cga, x, y, game) {
    const boat = game.boat;
    cga.fill(x, y, 168, 56, 0);
    cga.rect(x, y, 168, 56, 3);

    const hdgStr = String(Math.round(boat.heading)).padStart(3, '0');
    const wndStr = String(Math.round(game.windDir)).padStart(3, '0');
    const awaStr = (boat.apparentWindAngle >= 0 ? '+' : '') + Math.round(boat.apparentWindAngle);

    cga.text(`HDG: ${hdgStr}°  SPD: ${boat.speed.toFixed(1)}KT`, x + 4, y + 4, 3);
    cga.text(`WND: ${wndStr}° @ ${game.windSpeed}KT`, x + 4, y + 14, 3);
    cga.text(`AWA: ${awaStr}° [${boat.pointOfSail}]`, x + 4, y + 24, boat.isLuffing ? 2 : 1);
    cga.text(`SHT: ${Math.round(boat.sheetAngle)}° OPT: ${boat.optimalSheet}°`, x + 4, y + 34, 3);
    cga.text(`STATUS: ${boat.isLuffing ? "IN IRONS!" : "UNDER WAY"}`, x + 4, y + 44, boat.isLuffing ? 2 : 1);
  }

  // ------------------------------------------------------------- TITLE SCREEN
  renderTitleScreen(cga, x, y, w, h, game) {
    cga.fill(x, y, w, h, 0);

    cga.textCenter("SAILING...", x, w, y + 8, 3);
    cga.textCenter("AN ADVENTURE IN THE", x, w, y + 20, 3);
    cga.textCenter("BERMUDA TRIANGLE", x, w, y + 30, 2);

    cga.line(x + 10, y + 42, x + w - 10, y + 42, 3);

    const opts = [
      { key: 'B', label: "[B] - BEGIN GAME" },
      { key: 'P', label: "[P] - PRACTICE SAILING" },
      { key: 'O', label: "[O] - OBJECTIVE" },
      { key: 'C', label: "[C] - CONTROLS" },
      { key: 'S', label: "[S] - SAILING BASICS" },
      { key: 'H', label: "[H] - HAZARDS" },
      { key: 'G', label: "[G] - GEOGRAPHY" },
      { key: 'A', label: "[A] - ALL INSTRUCTIONS" },
      { key: 'T', label: "[T] - TELEMETRY HUD" }
    ];

    for (let i = 0; i < opts.length; i++) {
      const opt = opts[i];
      const isHovered = this.hoveredMenuOption === opt.key;
      const c = isHovered ? 1 : 3;
      cga.text(opt.label, x + 12, y + 48 + i * 11, c);
    }

    cga.line(x + 10, y + 150, x + w - 10, y + 150, 3);
    cga.textCenter("DYNETRON COMPANY (C) 1983", x, w, y + 156, 3);
    cga.textCenter("PRESS KEY OR CLICK OPTION", x, w, y + 168, this.blinkOn ? 1 : 3);
  }

  getMenuOptionAt(cx, cy) {
    // Relative to left quadrant (x: 8 to 192, y: 8 to 192)
    if (cx < 8 || cx > 192 || cy < 56 || cy > 156) return null;
    const row = Math.floor((cy - 56) / 11);
    const keys = ['B', 'P', 'O', 'C', 'S', 'H', 'G', 'A', 'T'];
    return keys[row] || null;
  }

  // ------------------------------------------------------- INSTRUCTION SCREENS
  renderInstructions(cga, x, y, w, h, game) {
    cga.fill(x, y, w, h, 0);

    const key = game.currentInstruction || 'O';
    const pages = {
      'O': {
        title: "OBJECTIVE",
        lines: [
          "YOU ARE CAPTAIN OF A 36-FT",
          "SLOOP IN THE DANGEROUS",
          "BERMUDA TRIANGLE.",
          "",
          "NAVIGATE 3 LEGS ACROSS",
          "THE MYSTERIOUS CARIBBEAN:",
          " 1. MIAMI TO BERMUDA",
          " 2. BERMUDA TO SAN JUAN",
          " 3. SAN JUAN TO MIAMI",
          "",
          "RESCUE CASTAWAYS FOR",
          "500 PTS EACH AND REACH",
          "DESTINATION HARBOURS."
        ]
      },
      'C': {
        title: "CONTROLS",
        lines: [
          "STEERING (RUDDER):",
          " [LEFT / A]  - PORT (LEFT)",
          " [RIGHT / D] - STBD (RIGHT)",
          "",
          "SAIL TRIM (SHEET):",
          " [UP / W]   - SHEET IN (TIGHT)",
          " [DOWN / S] - SHEET OUT (EASE)",
          "",
          "OTHER COMMANDS:",
          " [T] - TOGGLE TELEMETRY HUD",
          " [M] - MUTE AUDIO",
          " [B] - BEGIN GAME NOW"
        ]
      },
      'S': {
        title: "SAILING BASICS",
        lines: [
          "A BOAT CANNOT SAIL DIRECTLY",
          "INTO THE WIND (IN-IRONS).",
          "",
          "TO GO UPWIND:",
          "TACK IN A ZIG-ZAG AT 45 DEG",
          "TO THE WIND WITH SHEET TIGHT.",
          "",
          "OFF THE WIND:",
          "EASE THE SHEET AS YOU TURN",
          "AWAY FROM THE WIND.",
          "",
          "BEAM REACH (90 DEG) IS YOUR",
          "FASTEST POINT OF SAIL!"
        ]
      },
      'H': {
        title: "HAZARDS",
        lines: [
          "WATCH OUT FOR:",
          "",
          "- CORAL REEFS (BROWN)",
          "- SHARKS AND RUNAWAYS",
          "- ROGUE SPEEDBOATS",
          "- DERELICT SHIPS",
          "- FREAK WHIRLWINDS",
          "- MAGNETIC ANOMALIES",
          "",
          "COLLISIONS DAMAGE HULL (D).",
          "AVOID RUNNING AGROUND!"
        ]
      },
      'G': {
        title: "GEOGRAPHY",
        lines: [
          "THE BERMUDA TRIANGLE:",
          "",
          "WEST: FLORIDA & KEYS",
          "CENTRE: BAHAMA ISLANDS",
          "NORTHEAST: BERMUDA",
          "SOUTH: CUBA",
          "SOUTHEAST: PUERTO RICO",
          "",
          "USE THE RADAR IN LOWER RIGHT",
          "TO TRACK YOUR SECTOR."
        ]
      }
    };

    const cur = pages[key] || pages['O'];

    cga.textCenter(`* ${cur.title} *`, x, w, y + 8, 2);
    cga.line(x + 10, y + 20, x + w - 10, y + 20, 3);

    for (let i = 0; i < cur.lines.length; i++) {
      cga.text(cur.lines[i], x + 8, y + 26 + i * 10, 3);
    }

    cga.line(x + 10, y + 162, x + w - 10, y + 162, 3);
    cga.textCenter("[SPACE / CLICK TO RETURN]", x, w, y + 168, this.blinkOn ? 1 : 3);
  }

  // ------------------------------------------------------------- GENERIC MODAL
  renderModal(cga, x, y, w, h, lines, borderCol = 3) {
    const mw = w - 16;
    const mh = lines.length * 12 + 16;
    const mx = x + 8;
    const my = y + Math.floor((h - mh) / 2);

    cga.fill(mx, my, mw, mh, 0);
    cga.rect(mx, my, mw, mh, borderCol);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const col = (line.startsWith('*') || line.startsWith('[')) ? borderCol : 3;
      cga.textCenter(line, mx, mw, my + 8 + i * 12, col);
    }
  }

  // ------------------------------------------------------------- BOTTOM STATUS
  renderBottomStatus(cga, game) {
    const scoreStr = String(game.score).padStart(6, '0');
    cga.text(`SCORE: ${scoreStr}`, 8, 192, 3);
    cga.text(`LEG: ${game.leg}/3`, 140, 192, 3);
    cga.text(`SPD: ${game.boat.speed.toFixed(1)}KT`, 220, 192, 3);
  }
}

if (typeof window !== 'undefined') window.V1Renderer = V1Renderer;
