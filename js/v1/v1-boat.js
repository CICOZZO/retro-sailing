/**
 * SAILING (1983 - DYNETRON) - FÍSICA E CONTROLE DO VELEIRO
 * Controle do leme (tiller), retranca da vela (boom) e resposta ao vento.
 */

class V1Boat {
  constructor() {
    this.reset(250, 420, 45);
  }

  reset(x, y, heading = 60) {
    this.x = x;
    this.y = y;
    this.heading = heading;     // Graus (0 = Norte / Cima, 90 = Leste / Direita)
    this.sailTrim = 42;         // Ângulo da vela em relação ao barco (8° a 85°)
    this.rudderAngle = 0;       // Posição do leme (-1 a +1)
    this.speed = 2.4;           // Já inicia navegando com velocidade
    this.maxSpeed = 3.8;        // Velocidade máxima em nós
    this.damage = 0;            // 0 = Perfeito (F), 100 = Destruído (D)
    this.isLuffing = false;     // Em ferro (contra o vento)
    this.inPort = false;
    this.wake = [];             // Rastro de espuma da popa
    this.wakeTimer = 0;
    this.optTrim = 42;          // Ângulo ideal calculado
  }

  update(dt, windDir, windSpeed) {
    // 1. O Leme altera o rumo
    const turnSpeed = 50.0; // Graus por segundo
    if (this.rudderAngle !== 0) {
      this.heading = (this.heading + this.rudderAngle * turnSpeed * dt + 360) % 360;
    }

    // 2. Vento Relativo
    // windDir: direção de onde o vento vem (0 = Norte, 90 = Leste, 180 = Sul, 270 = Oeste)
    let relWind = windDir - this.heading;
    while (relWind > 180) relWind -= 360;
    while (relWind < -180) relWind += 360;

    const absRelWind = Math.abs(relWind);
    const windSide = relWind >= 0 ? 1 : -1;

    // 3. No-Go Zone (Em ferro - até 28 graus de proa ao vento)
    if (absRelWind < 28) {
      this.isLuffing = true;
      this.speed = Math.max(0, this.speed - 2.8 * dt);
      this.optTrim = 15;
    } else {
      this.isLuffing = false;

      // Ângulo ideal da retranca da vela:
      // De 14° na bolina até 80° em popa rasa
      this.optTrim = Math.round(14 + ((absRelWind - 28) / (180 - 28)) * 66);
      const trimDiff = Math.abs(this.sailTrim - this.optTrim);

      // Eficiência de 0.45 a 1.0 (barco sempre mantém tração mínima quando fora de ferro)
      const efficiency = Math.max(0.45, 1.0 - (trimDiff / 42.0));

      // Polar de vento: Través (70°-120°) é o ponto mais rápido da vela
      let polar = 0.8;
      if (absRelWind >= 65 && absRelWind <= 125) polar = 1.0;
      else if (absRelWind > 125) polar = 0.9;
      else polar = 0.75;

      const targetSpeed = this.maxSpeed * (windSpeed / 18.0) * polar * efficiency * (1 - this.damage * 0.005);

      if (this.speed < targetSpeed) {
        this.speed += Math.min(targetSpeed - this.speed, 2.5 * dt);
      } else {
        this.speed = Math.max(targetSpeed, this.speed - 1.2 * dt);
      }
    }

    // 4. Movimento nas coordenadas 2D do mapa
    // 0° = Norte (Y diminui), 90° = Leste (X aumenta)
    const rad = this.heading * (Math.PI / 180);
    const moveStep = this.speed * 45 * dt;
    this.x += Math.sin(rad) * moveStep;
    this.y += -Math.cos(rad) * moveStep;

    // Conter dentro dos limites do mapa
    this.x = Math.max(20, Math.min(1580, this.x));
    this.y = Math.max(20, Math.min(1150, this.y));

    // Rastro de espuma da popa (Wake)
    this.wakeTimer += dt;
    if (this.wakeTimer > 0.08 && this.speed > 0.3) {
      this.wakeTimer = 0;
      this.wake.push({
        x: this.x - Math.sin(rad) * 10,
        y: this.y + Math.cos(rad) * 10,
        life: 1.0
      });
      if (this.wake.length > 20) this.wake.shift();
    }

    // Atualiza vida do rastro
    for (const w of this.wake) {
      w.life -= dt * 0.6;
    }
    this.wake = this.wake.filter(w => w.life > 0);

    return {
      absRelWind,
      windSide,
      isLuffing: this.isLuffing,
      speed: this.speed,
      optTrim: this.optTrim
    };
  }
}

window.V1Boat = V1Boat;
