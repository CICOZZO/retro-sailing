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

const V1_WIND_FROM = 215;     // direção base de onde sopra o vento (graus)
const V1_MAX_SPEED = 10.0;    // px/s
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
    this.sheet = 45;           // escota inicial já aberta para velejar bem (0..90)
    this.speed = V1_MAX_SPEED * 0.55;
    this.side = 1;             // lado da retranca: +1 boreste, -1 bombordo
    this.boomAngle = 45;       // ângulo atual da retranca (a partir da popa)
    this.luffing = false;
    this.engine = false;
    this.damage = 0;           // 0..100
    this.fuel = 100;           // 0..100
    this.windFrom = V1_WIND_FROM;
    this.windStrength = 1.0;   // 0.75..1.10 (nunca fica fraco por muito tempo)
    this.windTimer = 0;
    this.lowWindTimer = 0;
  }

  /** Ângulo do vento aparente relativo à proa (+ = vem de boreste). */
  windRelative() {
    return v1Wrap180(this.windFrom - this.heading);
  }

  /** Direção para onde o vento sopra (graus, 0 = norte, sentido horário). */
  windTo() {
    return (this.windFrom + 180) % 360;
  }

  trim(delta) {
    this.sheet = Math.max(0, Math.min(90, this.sheet + delta));
  }

  steer(delta) {
    this.rudder = Math.max(-V1_MAX_RUDDER, Math.min(V1_MAX_RUDDER, this.rudder + delta));
  }

  centerRudder() { this.rudder = 0; }

  update(dt) {
    this.windTimer += dt;

    // Oscilação natural do vento; ventos fracos duram pouquíssimo tempo
    const wave = Math.sin(this.windTimer * 0.45) * 0.15 + Math.cos(this.windTimer * 0.9) * 0.08;
    this.windStrength = Math.max(0.82, Math.min(1.12, 0.96 + wave));

    // Pequena variação suave na direção do vento
    this.windFrom = ((this.windFrom + Math.sin(this.windTimer * 0.25) * 1.8 * dt) % 360 + 360) % 360;

    let r = this.windRelative();
    let absr = Math.abs(r);

    // Se o barco ficar contra o vento / com pouco vento nas velas, recupera rápido (~2s)
    if (absr < 32) {
      this.lowWindTimer += dt;
      if (this.lowWindTimer > 2.0) {
        const shiftDir = r >= 0 ? 1 : -1;
        this.windFrom = ((this.windFrom + shiftDir * 35 * dt) % 360 + 360) % 360;
        r = this.windRelative();
        absr = Math.abs(r);
      }
    } else {
      this.lowWindTimer = 0;
    }

    // lado da retranca (com histerese perto do eixo para não "tremer")
    if (absr > 8) this.side = r < 0 ? 1 : -1;

    // polar: evita calmaria prolongada; sobe rápido já na bolina e mantém boa velocidade em popa
    let polar;
    if (absr < 22) polar = 0.35;
    else if (absr < 50) polar = 0.65 + ((absr - 22) / 28) * 0.25;
    else if (absr < 115) polar = 0.90 + ((absr - 50) / 65) * 0.10;
    else polar = 1.0 - ((absr - 115) / 65) * 0.18;

    // ângulo real da retranca e eficiência do ajuste
    const phi = Math.min(this.sheet, absr);
    this.luffing = this.sheet > absr + 12 && absr >= 25;
    let eff;
    if (this.luffing) eff = 0.60;
    else eff = Math.max(0.58, Math.min(1, 1 - Math.abs((absr - phi) - 22) / 75));

    let target = V1_MAX_SPEED * polar * eff * this.windStrength;

    if (this.engine && this.fuel > 0) {
      target = Math.max(target, V1_MAX_SPEED * 0.7);
      this.fuel = Math.max(0, this.fuel - dt * 0.8);
    }

    this.speed += (target - this.speed) * Math.min(1, dt * 1.8);

    // retranca acompanha suavemente
    const want = Math.max(8, phi);
    this.boomAngle += (want - this.boomAngle) * Math.min(1, dt * 6);

    // leme
    const response = 0.4 + 0.6 * Math.min(1, this.speed / V1_MAX_SPEED);
    this.heading = ((this.heading + this.rudder * 0.9 * response * dt) % 360 + 360) % 360;

    const hr = this.heading * Math.PI / 180;
    this.vx = Math.sin(hr) * this.speed;
    this.vy = -Math.cos(hr) * this.speed;
  }

  /** Rumo absoluto (graus) em que aponta a retranca. */
  boomBearing() {
    return this.heading + 180 - this.side * this.boomAngle;
  }

  /** Rumo absoluto em que aponta a pá do leme (corrigido: -this.rudder para defletir para o lado da curva). */
  rudderBearing() {
    return this.heading + 180 - this.rudder;
  }
}

if (typeof window !== 'undefined') window.V1Boat = V1Boat;
