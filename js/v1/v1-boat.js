/**
 * SAILING (1982 - WIND PRODUCTIONS) - BARCO E FÍSICA REAL DE VELEIRO
 *
 * Física real de um veleiro monocasco (sloop):
 *  - O vento empurra a vela/retranca para sotavento até alinhar com o vento (absr),
 *    mas o cabo da escota (this.sheet, 5°..90°) limita o quanto a vela pode abrir:
 *      phi = Math.min(this.sheet, absr)
 *  - Portanto:
 *    * Quando o barco aponta contra o vento ou a escota está mais solta que o ângulo
 *      do vento (this.sheet >= absr), a vela se alinha com o vento (phi = absr),
 *      paneja (ângulo de ataque = 0°) e não gera força!
 *    * Um comando caça a vela (1/2/3, ↑, barra vertical -> reduz this.sheet) e o outro
 *      solta a vela (7/8/9, ↓, barra vertical -> aumenta this.sheet).
 *  - Leme de mola: this.rudderInput (-1..+1) é o comando segurado pelo jogador; a pá
 *    gira até ele a V1_RUDDER_RATE °/s e volta sozinha ao centro quando ele é solto.
 *  - Força propulsiva na vela (aerodinâmica vetorial):
 *    * Pressão do vento no pano: proporcional a sin(absr - phi) (ângulo entre o vento e a vela).
 *    * Projeção de avanço no rumo do barco (sustentação + empuxo): proporcional a sin(min(90°, phi + 18°)).
 *    * Resultado natural:
 *      - Na bolina (~45°): máxima velocidade com a vela bem caçada (~14°).
 *      - No través (~90°): máxima velocidade com a vela a meia-escota (~36°); se soltar a 75°, perde força.
 *      - Na popa (~165°-180°): máxima velocidade com a vela aberta (~75°-85°, perpendicular ao vento de popa);
 *        se caçar para 40°, perde área exposta ao vento e a velocidade cai.
 */

const V1_WIND_FROM = 195;     // direção base de onde sopra o vento (graus)
const V1_MAX_SPEED = 10.0;    // px/s
const V1_MAX_RUDDER = 45;     // graus
const V1_RUDDER_RATE = 150;  // graus/s que a pá do leme gira (ida e volta ao centro)
const V1_MIN_SHEET = 0;       // vela toda caçada (graus a partir do eixo da popa)
const V1_MAX_SHEET = 90;      // vela toda solta (graus a partir do eixo da popa)

function v1Wrap180(a) {
  return ((a + 180) % 360 + 360) % 360 - 180;
}

class V1Boat {
  constructor() { this.reset(0, 0, 0); }

  reset(x, y, heading = 0) {
    this.x = x;
    this.y = y;
    this.heading = ((heading % 360) + 360) % 360;
    this.rudder = 0;
    this.rudderInput = 0;     // comando do jogador (-1..+1); 0 = leme solto, volta ao meio
    this.sheet = 35;          // escota inicial (0..90)
    this.speed = 0;
    this.windFrom = V1_WIND_FROM;
    this.windStrength = 1.0;
    this.windTimer = 0;

    const r0 = v1Wrap180(this.windFrom - this.heading);
    this.side = r0 <= 0 ? 1 : -1;             // +1 boreste, -1 bombordo (sotavento)
    this.boomAngle = Math.min(this.sheet, Math.abs(r0));
    this.signedBoom = this.side * this.boomAngle;
    this.luffing = false;
    this.engine = false;
    this.damage = 0;          // 0..100
    this.fuel = 100;          // 0..100
  }

  /** Ângulo de onde vem o vento em relação à proa (-180..+180; + = vem de boreste). */
  windRelative() {
    return v1Wrap180(this.windFrom - this.heading);
  }

  /** Direção para onde o vento sopra (graus, 0 = norte, sentido horário). */
  windTo() {
    return (this.windFrom + 180) % 360;
  }

  trim(delta) {
    this.sheet = Math.max(V1_MIN_SHEET, Math.min(V1_MAX_SHEET, this.sheet + delta));
  }

  /** Leme de mola: -1 todo a bombordo, +1 todo a boreste, 0 solto (volta ao meio). */
  setRudderInput(v) {
    this.rudderInput = Math.max(-1, Math.min(1, v));
  }

  update(dt) {
    if (dt <= 0) return;
    this.windTimer += dt;

    // 1. Vento estável: muda só um pouco e bem devagar ao longo do jogo (±6° em ~2 min)
    this.windFrom = ((V1_WIND_FROM + Math.sin(this.windTimer * 0.05) * 6) % 360 + 360) % 360;
    this.windStrength = 0.98 + Math.sin(this.windTimer * 0.07) * 0.04;

    // 2. Leme (gira até o comando; solto, volta ao centro) e giro do casco
    const rudderStep = V1_RUDDER_RATE * dt;
    this.rudder += Math.max(-rudderStep, Math.min(rudderStep, this.rudderInput * V1_MAX_RUDDER - this.rudder));
    const steerAuthority = 0.35 + 0.65 * Math.min(1, this.speed / (V1_MAX_SPEED * 0.6));
    this.heading = ((this.heading + this.rudder * 0.95 * steerAuthority * dt) % 360 + 360) % 360;

    // 3. Ângulo do vento relativo à proa
    const r = this.windRelative();
    const absr = Math.abs(r);

    // 4. Posição física da vela/retranca:
    // O vento empurra a vela para sotavento até o ângulo do vento (absr),
    // mas a escota (this.sheet) segura a vela não deixando passar de this.sheet.
    // Quando absr < this.sheet (ex: contra o vento ou escota solta), phi = absr
    // e a vela se alinha naturalmente com o vento!
    if (absr > 2) {
      this.side = r < 0 ? 1 : -1;
    }
    const phi = Math.min(this.sheet, absr);
    const targetSignedBoom = this.side * phi;
    this.signedBoom += (targetSignedBoom - this.signedBoom) * Math.min(1, dt * 10);
    this.boomAngle = Math.abs(this.signedBoom);

    // 5. Aerodinâmica real da vela:
    // alpha = absr - phi é o ângulo entre o fluxo do vento e o pano da vela.
    // Se alpha <= 4° (vela alinhada com o vento) ou absr < 28° (zona morta de contravento),
    // a vela paneja (luffing) e não gera força propulsiva.
    const alpha = Math.max(0, absr - phi);
    this.luffing = absr < 28 || alpha < 4;

    let targetSpeed = 0;
    if (!this.luffing) {
      // Curva polar do casco conforme o ponto de velejo
      let polar;
      if (absr < 55) {
        // Bolina (contravento): cresce suave a partir da zona morta, sem degrau em 28°
        polar = 0.90 * Math.sqrt((absr - 28) / 27);
      } else if (absr <= 125) {
        // Través / Alheta (ponto mais veloz)
        polar = 0.90 + Math.sin(((absr - 55) / 70) * Math.PI) * 0.10;
      } else {
        // Popa (vento vindo por trás)
        polar = 0.92;
      }

      // Força propulsiva = pressão do vento na vela sin(absr - phi) * projeção de avanço sin(min(90°, phi + 18°))
      const calcThrust = (sailAng) => {
        const attack = Math.max(0, absr - sailAng);
        const windPressure = Math.sin(Math.min(180, attack) * Math.PI / 180);
        const forwardProj = Math.sin(Math.min(90, sailAng + 18) * Math.PI / 180);
        return Math.max(0, windPressure * forwardProj);
      };

      // Ângulo ótimo da escota para o rumo atual: (absr - 18) / 2
      // (Bolina 45° -> ~13°; Través 95° -> ~38°; Popa 165° -> ~74°)
      const phiOpt = Math.max(V1_MIN_SHEET, Math.min(82, (absr - 18) * 0.5));
      const maxThrust = Math.max(0.05, calcThrust(phiOpt));
      const curThrust = calcThrust(phi);

      const sailEfficiency = Math.pow(Math.min(1, curThrust / maxThrust), 1.5);
      targetSpeed = V1_MAX_SPEED * polar * sailEfficiency * this.windStrength;
    }

    // Motor auxiliar (tecla E)
    if (this.engine && this.fuel > 0) {
      targetSpeed = Math.max(targetSpeed, V1_MAX_SPEED * 0.65);
      this.fuel = Math.max(0, this.fuel - dt * 0.8);
    }

    // 6. Inércia na água
    const accelRate = targetSpeed >= this.speed ? 1.8 : 0.7;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * accelRate);

    const hr = this.heading * Math.PI / 180;
    this.vx = Math.sin(hr) * this.speed;
    this.vy = -Math.cos(hr) * this.speed;
  }

  /** Rumo absoluto (graus) em que aponta a retranca. */
  boomBearing() {
    return this.heading + 180 - this.signedBoom;
  }

  /** Rumo absoluto em que aponta a pá do leme. */
  rudderBearing() {
    return this.heading + 180 - this.rudder;
  }
}

if (typeof window !== 'undefined') window.V1Boat = V1Boat;
