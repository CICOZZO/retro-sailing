/**
 * SAILING (1986) - FÍSICA NÁUTICA E AERODINÂMICA DA VELA
 * Cálculos vetoriais de vento aparente, ponto de vela (polar), arrasto e adornamento.
 */

class BoatPhysics {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = 0;
    this.z = 0;
    this.heading = 0;       // Graus (0 = Norte / +Z, 90 = Leste / +X)
    this.speed = 0.0;       // Nós (knots)
    this.sailTrim = 40.0;   // Ângulo de caça da vela em graus (5° a 90°)
    this.rudder = 0.0;      // -1 (Bombordo/Esq) a +1 (Boreste/Dir)
    this.heelAngle = 0.0;   // Inclinação lateral em radianos
    this.pitchAngle = 0.0;  // Balanço de proa
    this.isLuffing = false; // Em ferro (no-go zone)
    this.efficiency = 0.0;  // Eficiência atual da regulagem da vela (0.0 a 1.0)
    this.trackHistory = []; // Rastro de navegação para o radar
  }

  update(dt, windDir, windSpeed) {
    // 1. Cálculo da Velocidade Angular do Leme
    // O leme só responde efetivamente se o barco tiver velocidade na água!
    const steerAuthority = Math.max(0.15, Math.min(1.0, this.speed / 4.0));
    const turnRate = 32.0 * steerAuthority; // Graus por segundo
    this.heading = (this.heading + this.rudder * turnRate * dt + 360) % 360;

    // 2. Cálculo dos Vetores de Vento Verdadeiro e Barco
    const headingRad = this.heading * (Math.PI / 180);
    const windRad = windDir * (Math.PI / 180);

    // Vetor do Vento Verdadeiro (direção de onde o vento sopra para onde vai)
    const trueWindVecX = -Math.sin(windRad) * windSpeed;
    const trueWindVecZ = -Math.cos(windRad) * windSpeed;

    // Vetor de Velocidade do Barco
    const boatVecX = Math.sin(headingRad) * this.speed;
    const boatVecZ = Math.cos(headingRad) * this.speed;

    // Vento Aparente (Vento sentido a bordo) = Vento Verdadeiro - Velocidade do Barco
    const appWindX = trueWindVecX - boatVecX;
    const appWindZ = trueWindVecZ - boatVecZ;
    const appWindSpeed = Math.sqrt(appWindX * appWindX + appWindZ * appWindZ);

    // Ângulo de onde o vento aparente está vindo
    const appWindFromAngle = (Math.atan2(-appWindX, -appWindZ) * (180 / Math.PI) + 360) % 360;

    // Ângulo relativo da proa em relação ao vento aparente (-180° a +180°)
    let relWindAngle = appWindFromAngle - this.heading;
    while (relWindAngle > 180) relWindAngle -= 360;
    while (relWindAngle < -180) relWindAngle += 360;

    const absRelAngle = Math.abs(relWindAngle); // 0° = vento direto de proa, 180° = de popa
    const windSide = relWindAngle >= 0 ? 1 : -1; // 1 = Boreste, -1 = Bombordo

    // 3. Verificação da "NO-GO ZONE" (Em Ferro / Contravento Absoluto)
    // Veleiros monocasco não conseguem velejar a menos de ~36° da origem do vento
    if (absRelAngle < 36.0) {
      this.isLuffing = true;
      this.efficiency = 0.0;
    } else {
      this.isLuffing = false;
      // 4. Ângulo Ótimo da Vela para o Vento Aparente Atual
      // Fórmula empírica náutica de trim:
      let optimalTrim = (absRelAngle - 25.0) * 0.55;
      optimalTrim = Math.max(10.0, Math.min(85.0, optimalTrim));

      // Diferença entre a regulagem do jogador e a regulagem ótima
      const trimDiff = Math.abs(this.sailTrim - optimalTrim);
      this.efficiency = Math.max(0.0, 1.0 - Math.pow(trimDiff / 28.0, 1.8));
    }

    // 5. Coeficiente Polar do Barco por Ponto de Velejo
    let polarFactor = 0.0;
    if (!this.isLuffing) {
      if (absRelAngle >= 36 && absRelAngle < 70) {
        // Bolina fechada (Close-hauled)
        polarFactor = 0.65 + ((absRelAngle - 36) / 34) * 0.25;
      } else if (absRelAngle >= 70 && absRelAngle <= 115) {
        // Través (Beam Reach) - Ponto mais veloz!
        polarFactor = 0.90 + Math.sin(((absRelAngle - 70) / 45) * Math.PI) * 0.20;
      } else if (absRelAngle > 115 && absRelAngle <= 155) {
        // Alheta (Broad Reach)
        polarFactor = 0.85 - ((absRelAngle - 115) / 40) * 0.15;
      } else {
        // Popa rasa (Running)
        polarFactor = 0.65;
      }
    }

    // 6. Aceleração, Arrasto e Velocidade Máxima
    const maxTheoreticalSpeed = windSpeed * 0.82 * polarFactor;
    const targetSpeed = maxTheoreticalSpeed * this.efficiency;

    if (this.isLuffing) {
      // Perda rápida de velocidade por arrasto ao ficar em ferro
      this.speed = Math.max(0, this.speed - 3.5 * dt);
    } else if (this.speed < targetSpeed) {
      // Aceleração progressiva com inércia da água
      this.speed += Math.min(targetSpeed - this.speed, 2.2 * dt);
    } else {
      // Desaceleração suave por atrito hidrodinâmico
      this.speed = Math.max(targetSpeed, this.speed - 1.8 * dt);
    }

    // 7. Adornamento (Inclinação lateral / Heel) e Balanço (Pitch)
    // O barco aderna para o lado oposto de onde o vento sopra
    const lateralForce = Math.sin(absRelAngle * (Math.PI / 180)) * (this.speed / 12.0) * (windSpeed / 15.0);
    const targetHeel = -windSide * Math.min(0.38, lateralForce * 0.35);
    this.heelAngle += (targetHeel - this.heelAngle) * 4.0 * dt;

    // Balanço de proa com as ondas
    this.pitchAngle = Math.sin(Date.now() * 0.0035 + this.z * 0.05) * 0.04 * (0.5 + this.speed * 0.1);

    // 8. Deslocamento do Barco no Mundo
    const forwardX = Math.sin(headingRad);
    const forwardZ = Math.cos(headingRad);

    // Pequeno abatimento / deriva lateral (leeway)
    const leewayX = -windSide * Math.cos(headingRad) * (0.04 * (1 - this.efficiency));
    const leewayZ = windSide * Math.sin(headingRad) * (0.04 * (1 - this.efficiency));

    // Conversão de nós (knots) para escala de metros/segundo do jogo
    const speedMps = this.speed * 0.85;
    this.x += (forwardX + leewayX) * speedMps * dt;
    this.z += (forwardZ + leewayZ) * speedMps * dt;

    // Rastro histórico no radar (a cada ~1 segundo ou distância)
    if (!this.lastTrackTime || Date.now() - this.lastTrackTime > 800) {
      this.lastTrackTime = Date.now();
      this.trackHistory.push({ x: this.x, z: this.z });
      if (this.trackHistory.length > 50) this.trackHistory.shift();
    }

    return {
      relWindAngle,
      absRelAngle,
      windSide,
      appWindSpeed,
      appWindFromAngle
    };
  }
}
