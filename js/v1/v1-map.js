/**
 * SAILING (1983 - DYNETRON COMPANY)
 * Sector Map, Blocky CGA Geography, Swimmers & Hazards (Versão 1)
 *
 * Implements:
 * - 8x6 grid of discrete sectors (184x184 px per sector)
 * - Authentic flip-screen navigation (no modern smooth scrolling)
 * - Blocky CGA green coastlines for Florida, Bahamas, Bermuda, Cuba, Puerto Rico
 * - Swimmers as brown rings, reefs as brown clustered hazards
 * - Bermuda Triangle dynamic hazards (sharks, speedboats, whirlwinds, anomalies)
 * - Destination ports for the 3 Legs
 */

class V1Map {
  constructor() {
    this.SECTOR_W = 184;
    this.SECTOR_H = 184;
    this.COLS = 8;
    this.ROWS = 6;
    this.width = this.COLS * this.SECTOR_W;   // 1472
    this.height = this.ROWS * this.SECTOR_H; // 1104

    // Stepped blocky CGA land masses (Green = 1)
    // Coords in global world space
    this.islands = [
      // --- FLORIDA & KEYS (West: Cols 0-1, Rows 1-3) ---
      { x: 0, y: 120, w: 140, h: 260, name: "Florida Mainland" },
      { x: 100, y: 320, w: 90, h: 110, name: "Miami Coast" },
      { x: 130, y: 430, w: 60, h: 50, name: "Key Largo" },
      { x: 90, y: 480, w: 90, h: 40, name: "Florida Keys" },

      // --- BAHAMAS ARCHIPELAGO (Cols 2-3, Rows 2-4) ---
      { x: 380, y: 350, w: 100, h: 55, name: "Grand Bahama" },
      { x: 500, y: 390, w: 70, h: 45, name: "Abaco" },
      { x: 440, y: 470, w: 85, h: 70, name: "New Providence / Nassau" },
      { x: 390, y: 530, w: 110, h: 80, name: "Andros Island" },
      { x: 540, y: 560, w: 90, h: 45, name: "Exuma Cays" },
      { x: 620, y: 640, w: 80, h: 50, name: "Long Island" },

      // --- BERMUDA (Northeast: Cols 6-7, Rows 0-1) ---
      { x: 1200, y: 80, w: 130, h: 65, name: "Bermuda / St. George" },
      { x: 1180, y: 145, w: 95, h: 60, name: "Hamilton Island" },
      { x: 1275, y: 145, w: 60, h: 45, name: "Castle Harbour" },

      // --- CUBA (South: Cols 1-5, Row 5) ---
      { x: 220, y: 890, w: 560, h: 140, name: "Cuba" },
      { x: 450, y: 840, w: 180, h: 50, name: "Cayo Coco" },

      // --- PUERTO RICO & VIRGIN ISL. (Southeast: Cols 5-7, Rows 4-5) ---
      { x: 1010, y: 880, w: 230, h: 80, name: "Puerto Rico" },
      { x: 1240, y: 890, w: 90, h: 60, name: "Virgin Islands" }
    ];

    // Dangerous coral reefs (clusters of brown rocks)
    this.reefs = [
      { x: 280, y: 260, r: 16 },
      { x: 340, y: 440, r: 20 },
      { x: 630, y: 330, r: 18 },
      { x: 820, y: 240, r: 22 },
      { x: 1080, y: 190, r: 20 },
      { x: 1120, y: 340, r: 24 },
      { x: 910, y: 580, r: 25 },
      { x: 740, y: 760, r: 22 },
      { x: 950, y: 810, r: 18 }
    ];

    // Destination Ports for the 3 Legs
    this.ports = {
      1: {
        leg: 1,
        name: "PORT OF HAMILTON (BERMUDA)",
        x: 1220, y: 155, w: 40, h: 35,
        targetSecX: 6, targetSecY: 0
      },
      2: {
        leg: 2,
        name: "PORT OF SAN JUAN (PUERTO RICO)",
        x: 1040, y: 885, w: 40, h: 35,
        targetSecX: 5, targetSecY: 4
      },
      3: {
        leg: 3,
        name: "PORT OF MIAMI (FLORIDA)",
        x: 170, y: 360, w: 40, h: 35,
        targetSecX: 0, targetSecY: 1
      }
    };

    this.swimmers = [];
    this.hazards = [];
    this.setupLeg(1);
  }

  setupLeg(legNum) {
    this.swimmers = [];
    this.hazards = [];

    if (legNum === 1) {
      // LEG 1: Miami -> Bermuda (Heading Northeast against trade wind)
      this.swimmers = [
        { id: 1, x: 330, y: 290, rescued: false, name: "Castaway from S/V 'Sea Star'" },
        { id: 2, x: 610, y: 240, rescued: false, name: "Drifting Bahamian fisherman" },
        { id: 3, x: 890, y: 190, rescued: false, name: "Life raft from cargo ship" },
        { id: 4, x: 1110, y: 170, rescued: false, name: "Stranded yacht crew" }
      ];

      this.hazards = [
        { type: 'shark', x: 460, y: 270, vx: 12, vy: 6 },
        { type: 'shark', x: 780, y: 210, vx: -10, vy: 8 },
        { type: 'speedboat', x: 380, y: 190, vx: 45, vy: 0 },
        { type: 'speedboat', x: 960, y: 260, vx: -40, vy: 8 }
      ];
    } else if (legNum === 2) {
      // LEG 2: Bermuda -> Puerto Rico (Across Sargasso Sea)
      this.swimmers = [
        { id: 1, x: 1190, y: 320, rescued: false, name: "Survivor of USS Cyclops (1918?!)" },
        { id: 2, x: 1130, y: 490, rescued: false, name: "Muttered about 'Lights in the Deep'" },
        { id: 3, x: 1050, y: 640, rescued: false, name: "Sailor in 1950s life jacket" },
        { id: 4, x: 1140, y: 780, rescued: false, name: "Life raft near Puerto Rico Trench" }
      ];

      this.hazards = [
        { type: 'whirlwind', x: 1120, y: 420, r: 28, rot: 0 },
        { type: 'whirlwind', x: 1060, y: 690, r: 28, rot: 0 },
        { type: 'shark', x: 1180, y: 550, vx: 14, vy: -10 },
        { type: 'shark', x: 1090, y: 740, vx: -12, vy: 12 }
      ];
    } else {
      // LEG 3: Puerto Rico -> Miami (Directly through the heart of the Triangle)
      this.swimmers = [
        { id: 1, x: 920, y: 790, rescued: false, name: "Flight 19 pilot helmet recovered" },
        { id: 2, x: 740, y: 660, rescued: false, name: "Marine Sulphur Queen survivor" },
        { id: 3, x: 570, y: 540, rescued: false, name: "Magnetic anomaly research scientist" },
        { id: 4, x: 360, y: 450, rescued: false, name: "Castaway near Bimini" },
        { id: 5, x: 230, y: 390, rescued: false, name: "Drifting raft off Key Biscayne" }
      ];

      this.hazards = [
        { type: 'anomaly', x: 680, y: 620, r: 35, rot: 0 },
        { type: 'anomaly', x: 510, y: 510, r: 30, rot: 0 },
        { type: 'whirlwind', x: 790, y: 710, r: 28, rot: 0 },
        { type: 'whirlwind', x: 390, y: 480, r: 28, rot: 0 },
        { type: 'shark', x: 620, y: 580, vx: 15, vy: -8 }
      ];
    }
  }

  updateHazards(dt) {
    for (const h of this.hazards) {
      if (h.type === 'shark') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        // Turn around on edges
        if (h.x < 50 || h.x > this.width - 50) h.vx *= -1;
        if (h.y < 50 || h.y > this.height - 50) h.vy *= -1;
      } else if (h.type === 'speedboat') {
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        if (h.x < 100) { h.x = 100; h.vx = Math.abs(h.vx); }
        if (h.x > this.width - 100) { h.x = this.width - 100; h.vx = -Math.abs(h.vx); }
      } else if (h.type === 'whirlwind' || h.type === 'anomaly') {
        h.rot = (h.rot + dt * 3) % (Math.PI * 2);
      }
    }
  }

  checkLandCollision(wx, wy) {
    for (const island of this.islands) {
      if (wx >= island.x && wx <= island.x + island.w &&
          wy >= island.y && wy <= island.y + island.h) {
        return true;
      }
    }
    return false;
  }

  checkReefCollision(wx, wy) {
    for (const reef of this.reefs) {
      const dx = wx - reef.x;
      const dy = wy - reef.y;
      if (dx * dx + dy * dy < reef.r * reef.r) {
        return true;
      }
    }
    return false;
  }
}

if (typeof window !== 'undefined') window.V1Map = V1Map;
