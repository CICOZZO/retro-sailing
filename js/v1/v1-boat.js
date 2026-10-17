/**
 * SAILING (1982 - WIND PRODUCTIONS) - BARCO E FÍSICA REAL DE VELEIRO
 *
 * Física náutica de um veleiro monocasco (sloop):
 *  - Vento quase constante (direção base 195° SSW->NNE), com variação muito
 *    lenta e suave (±6° ao longo de ~2 minutos) e intensidade firme (~100%).
 *  - A retranca (vela) é presa ao barco pela escota (sheet, de 8° caçada a 80° folgada):
 *    a vela NÃO acompanha o vento quando o barco gira — ela gira solidária ao casco
 *    no ângulo definido pela escota (mudando de bordo apenas ao cambar ou dar jaibe).
 *  - Com a vela caçada (1/2/3 ou ↑), a retenção e a pressão do vento no pano são
 *    maiores e a velocidade do barco aumenta. Com a vela folgada (7/8/9 ou ↓), o
 *    vento escapa, a pressão diminui e a velocidade cai.
 *  - Contra o vento (< 28° da origem do vento), o barco entra "em ferro" (zona morta),
 *    mas conserva inércia hidrodinâmica suficiente para completar a cambada.
 */

const V1_WIND_FROM = 195;     // direção base de onde sopra o vento (graus)
const V1_MAX_SPEED = 10.0;    // px/s
const V1_MAX_RUDDER = 45;     // graus
const V1_MIN_SHEET = 8;       // vela toda caçada (graus a partir do eixo da popa)
const V1_MAX_SHEET = 80;      // vela toda folgada (graus a partir do eixo da popa)

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
    this.sheet = 22;           // começa com a vela bem regulada/caçada (8..80)
    this.speed = V1_MAX_SPEED * 0.65;
    this.windFrom = V1_WIND_FROM;
    this.windStrength = 1.0;
    this.windTimer = 0;

    const r0 = v1Wrap180(this.windFrom - this.heading);
    this.side = r0 <= 0 ? 1 : -1;             // +1 boreste, -1 bombordo (sotavento)
    this.boomAngle = this.sheet;              // magnitude da abertura (para telemetria)
    this.signedBoom = this.side * this.sheet; // ângulo assinalado da retranca relativo à popa
    this.luffing = false;
    this.engine = false;
    this.damage = 0;           // 0..100
    this.fuel = 100;           // 0..100
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

  steer(delta) {
    this.rudder = Math.max(-V1_MAX_RUDDER, Math.min(V1_MAX_RUDDER, this.rudder + delta));
  }

  centerRudder() { this.rudder = 0; }

  update(dt) {
    if (dt <= 0) return;
    this.windTimer += dt;

    // 1. Vento estável: muda só um pouco e muito devagar durante o jogo (±6° em ~2 min)
    this.windFrom = ((V1_WIND_FROM + Math.sin(this.windTimer * 0.05) * 6) % 360 + 360) % 360;
    this.windStrength = 0.98 + Math.sin(this.windTimer * 0.07) * 0.04; // 0.94..1.02

    // 2. Leme e giro do casco (responde ao seguimento do barco na água)
    const steerAuthority = 0.35 + 0.65 * Math.min(1, this.speed / (V1_MAX_SPEED * 0.6));
    this.heading = ((this.heading + this.rudder * 0.95 * steerAuthority * dt) % 360 + 360) % 360;

    // 3. Ângulo do vento relativo à proa
    const r = this.windRelative();
    const absr = Math.abs(r);

    // 4. Bordo da retranca (sotavento = lado oposto de onde vem o vento)
    // Só troca de bordo ao cruzar efetivamente a linha de proa (> 10°) ou popa (< 172°),
    // mantendo a vela firme junto ao casco durante toda a navegação.
    if (absr > 10 && absr < 172) {
      this.side = r < 0 ? 1 : -1;
    }

    // A retranca é presa ao barco pelo cabo da escota (this.sheet):
    // ela gira COM O BARCO no ângulo this.sheet, sem acompanhar o vento.
    const targetSignedBoom = this.side * this.sheet;
    this.signedBoom += (targetSignedBoom - this.signedBoom) * Math.min(1, dt * 10);
    this.boomAngle = Math.abs(this.signedBoom);

    // 5. Física de propulsão da vela (curva polar + pressão de caça da escota)
    // Fator de caça: 1.0 com vela toda caçada (8°), 0.0 com vela toda folgada (80°)
    const tightness = (V1_MAX_SHEET - this.sheet) / (V1_MAX_SHEET - V1_MIN_SHEET);

    let targetSpeed = 0;
    if (absr < 26) {
      // Zona morta contra o vento ("em ferro"): sem tração vélica
      this.luffing = true;
      targetSpeed = 0;
    } else {
      // Curva polar do veleiro conforme o ponto de velejo (bolina -> través -> alheta/popa)
      let polar;
      if (absr < 55) {
        // Bolina (contravento): ganha força rapidamente ao abrir da zona morta
        polar = 0.68 + ((absr - 26) / 29) * 0.24;
      } else if (absr <= 120) {
        // Través: ponto de maior rendimento aerodinâmico do veleiro
        polar = 0.92 + Math.sin(((absr - 55) / 65) * Math.PI) * 0.08;
      } else {
        // Alheta e popa rasa
        polar = 0.92 - ((absr - 120) / 60) * 0.10;
      }

      // Se soltar a escota além do ângulo do vento na bolina/través, a vela paneja
      this.luffing = (absr < 85 && this.sheet > absr + 6);

      // Pressão do vento na vela: quanto mais caçada a vela (maior tightness),
      // maior a pressão retida no pano e maior a velocidade do barco!
      let sailPressure;
      if (this.luffing) {
        sailPressure = 0.28;
      } else {
        sailPressure = 0.36 + 0.64 * tightness;
      }

      targetSpeed = V1_MAX_SPEED * polar * sailPressure * this.windStrength;
    }

    // Motor auxiliar (tecla E)
    if (this.engine && this.fuel > 0) {
      targetSpeed = Math.max(targetSpeed, V1_MAX_SPEED * 0.65);
      this.fuel = Math.max(0, this.fuel - dt * 0.8);
    }

    // 6. Inércia hidrodinâmica: acelera com vigor quando há pressão na vela
    // e desacelera suavemente na água (permitindo cambar sem travar).
    const accelRate = targetSpeed >= this.speed ? 1.8 : 0.55;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * accelRate);

    const hr = this.heading * Math.PI / 180;
    this.vx = Math.sin(hr) * this.speed;
    this.vy = -Math.cos(hr) * this.speed;
  }

  /** Rumo absoluto (graus) em que aponta a retranca (solidária ao casco no ângulo da escota). */
  boomBearing() {
    return this.heading + 180 - this.signedBoom;
  }

  /** Rumo absoluto em que aponta a pá do leme. */
  rudderBearing() {
    return this.heading + 180 - this.rudder;
  }
}

if (typeof window !== 'undefined') window.V1Boat = V1Boat;
