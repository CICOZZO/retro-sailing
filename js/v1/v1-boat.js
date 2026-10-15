/**
 * SAILING (1982 - WIND PRODUCTIONS) - BARCO E FÍSICA DE VELA
 *
 * Modelo inferido do vídeo de referência:
 *  - o casco gira com o rumo (0° = norte, sentido horário);
 *  - o vento é fixo (WIND_FROM). A retranca fica sempre a sotavento, limitada
 *    pelo comprimento da escota (7/8/9 folga 2/5/10°, 1/2/3 caça 2/5/10°);
 *  - com a vela solta além do vento ela "panneja" (luff) e a força cai;
 *  - o leme (4/5/6) gira o barco; quanto mais rápido, mais responde;
 *  - velocidade máxima de ~6,5 px/s (a travessia de um setor leva ~28 s).
 */

const V1_WIND_FROM = 215;     // de onde sopra o vento (graus)
const V1_MAX_SPEED = 6.5;     // px/s
const V1_MAX_RUDDER = 45;     // graus

function v1Wrap180(a) {
  a = ((a + 180) % 360 + 360) % 360 - 180;
  return a;
}

class V1Boat {
  constructor() { this.reset(0, 0, 0); }

  reset(x, y, heading = 0) {
    this.x = x; this.y = y;
    this.heading = heading;
    this.rudder = 0;
    this.sheet = 0;            // escota (0 = vela cacada no eixo, 90 = toda folgada)
    this.speed = 0;
    this.side = 1;             // lado da retranca: +1 boreste, -1 bombordo
    this.boomAngle = 0;        // ângulo atual da retranca (a partir da popa)
    this.luffing = false;
    this.engine = false;
    this.damage = 0;           // 0..100
    this.fuel = 100;           // 0..100
  }

  /** Ângulo do vento aparente relativo à proa (+ = vem de boreste). */
  windRelative() {
    return v1Wrap180(V1_WIND_FROM - this.heading);
  }

  trim(delta) {
    this.sheet = Math.max(0, Math.min(90, this.sheet + delta));
  }

  steer(delta) {
    this.rudder = Math.max(-V1_MAX_RUDDER, Math.min(V1_MAX_RUDDER, this.rudder + delta));
  }

  centerRudder() { this.rudder = 0; }

  update(dt) {
    const r = this.windRelative();
    const absr = Math.abs(r);

    // lado da retranca (com histerese perto do eixo para não "tremer")
    if (absr > 8) this.side = r < 0 ? 1 : -1;

    // polar: sem avanço na "zona morta", pico no través, popa um pouco menor
    let polar;
    if (absr < 28) polar = 0;
    else if (absr < 100) polar = (absr - 28) / 72;
    else polar = 1 - ((absr - 100) / 80) * 0.35;

    // ângulo real da retranca e eficiência do ajuste
    const phi = Math.min(this.sheet, absr);
    this.luffing = this.sheet >= absr && absr >= 28;
    let eff;
    if (this.luffing) eff = 0.25;
    else eff = Math.max(0.2, Math.min(1, 1 - Math.abs((absr - phi) - 22) / 55));

    let target = V1_MAX_SPEED * polar * eff;

    if (this.engine && this.fuel > 0) {
      target = Math.max(target, V1_MAX_SPEED * 0.5);
      this.fuel = Math.max(0, this.fuel - dt * 0.8);
    }

    this.speed += (target - this.speed) * Math.min(1, dt * 0.6);

    // retranca acompanha suavemente
    const want = phi;
    this.boomAngle += (want - this.boomAngle) * Math.min(1, dt * 6);

    // leme
    const response = 0.3 + 0.7 * Math.min(1, this.speed / V1_MAX_SPEED);
    this.heading = ((this.heading + this.rudder * 0.8 * response * dt) % 360 + 360) % 360;

    const hr = this.heading * Math.PI / 180;
    this.vx = Math.sin(hr) * this.speed;
    this.vy = -Math.cos(hr) * this.speed;
  }

  /** Rumo absoluto (graus) em que aponta a retranca. */
  boomBearing() {
    return this.heading + 180 - this.side * this.boomAngle;
  }

  /** Rumo absoluto em que aponta a pá do leme. */
  rudderBearing() {
    return this.heading + 180 + this.rudder;
  }
}

if (typeof window !== 'undefined') window.V1Boat = V1Boat;
