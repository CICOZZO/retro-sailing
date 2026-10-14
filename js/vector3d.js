/**
 * SAILING (1986) - MOTOR MATEMÁTICO 3D VETORIAL ("PONTOS E TRAÇOS")
 * Projeção perspectiva, transformações matriciais e malhas de arame (wireframe).
 */

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  scale(s) {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : new Vec3();
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  rotateY(rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return new Vec3(
      this.x * cos + this.z * sin,
      this.y,
      -this.x * sin + this.z * cos
    );
  }

  rotateX(rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return new Vec3(
      this.x,
      this.y * cos - this.z * sin,
      this.y * sin + this.z * cos
    );
  }

  rotateZ(rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return new Vec3(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos,
      this.z
    );
  }
}

class Camera3D {
  constructor() {
    this.pos = new Vec3(0, 4, -14);
    this.target = new Vec3(0, 1.5, 0);
    this.fov = 60 * (Math.PI / 180);
    this.near = 0.5;
    this.far = 400.0;
  }

  /**
   * Transforma ponto do mundo para coordenadas locais da câmera
   */
  worldToCamera(p) {
    // Vetor para frente (forward), direita (right) e cima (up)
    const forward = this.target.sub(this.pos).normalize();
    const worldUp = new Vec3(0, 1, 0);
    
    // Cross product: right = worldUp x forward
    let right = new Vec3(
      worldUp.y * forward.z - worldUp.z * forward.y,
      worldUp.z * forward.x - worldUp.x * forward.z,
      worldUp.x * forward.y - worldUp.y * forward.x
    ).normalize();

    // up = forward x right
    const up = new Vec3(
      forward.y * right.z - forward.z * right.y,
      forward.z * right.x - forward.x * right.z,
      forward.x * right.y - forward.y * right.x
    );

    const rel = p.sub(this.pos);
    return new Vec3(
      rel.dot(right),
      rel.dot(up),
      rel.dot(forward)
    );
  }

  /**
   * Projeta ponto da câmera na tela (viewport)
   */
  project(pCamera, viewWidth, viewHeight) {
    if (pCamera.z <= this.near) {
      return null; // Atrás da câmera ou muito perto
    }

    const scale = (viewHeight / 2) / Math.tan(this.fov / 2);
    const screenX = (viewWidth / 2) + (pCamera.x / pCamera.z) * scale;
    const screenY = (viewHeight / 2) - (pCamera.y / pCamera.z) * scale;

    return {
      x: screenX,
      y: screenY,
      depth: pCamera.z,
      visible: (screenX >= -100 && screenX <= viewWidth + 100 &&
                screenY >= -100 && screenY <= viewHeight + 100)
    };
  }

  /**
   * Recorte (clipping) de segmento de reta contra o plano de corte anterior (near plane)
   */
  clipLineToNearPlane(p1Cam, p2Cam) {
    if (p1Cam.z >= this.near && p2Cam.z >= this.near) {
      return [p1Cam, p2Cam];
    }
    if (p1Cam.z < this.near && p2Cam.z < this.near) {
      return null; // Totalmente atrás
    }

    // Interpolação na intersecção com o plano z = this.near
    const t = (this.near - p1Cam.z) / (p2Cam.z - p1Cam.z);
    const intersect = new Vec3(
      p1Cam.x + t * (p2Cam.x - p1Cam.x),
      p1Cam.y + t * (p2Cam.y - p1Cam.y),
      this.near
    );

    if (p1Cam.z < this.near) {
      return [intersect, p2Cam];
    } else {
      return [p1Cam, intersect];
    }
  }
}

/**
 * Definições das Malhas 3D Wireframe
 */
const WireframeMeshes = {
  /**
   * Constrói o modelo 3D do veleiro com vela dinâmica articulada
   */
  createSailboat(sailAngle = 0, isLuffing = false, animTime = 0) {
    const lines = [];
    const points = [];

    // Vértices do Casco (Proa em +Z, Popa em -Z)
    const bow = new Vec3(0, 0.4, 4.8);
    const sternL = new Vec3(-1.4, 0.5, -3.8);
    const sternR = new Vec3(1.4, 0.5, -3.8);
    const midL = new Vec3(-1.8, 0.4, 0.4);
    const midR = new Vec3(1.8, 0.4, 0.4);
    const keelBow = new Vec3(0, -0.6, 2.5);
    const keelMid = new Vec3(0, -1.8, 0.0);
    const keelStern = new Vec3(0, -1.0, -3.0);

    // Contorno do Convés (Borda)
    lines.push([bow, midL], [midL, sternL], [sternL, sternR], [sternR, midR], [midR, bow]);
    // Linhas do Fundo / Quilha
    lines.push([bow, keelBow], [keelBow, keelMid], [keelMid, keelStern], [keelStern, sternL], [keelStern, sternR]);
    // Cavernas transversais (armação estrutural)
    lines.push([midL, keelMid], [midR, keelMid]);

    // Mastro
    const mastBase = new Vec3(0, 0.3, 1.2);
    const mastTop = new Vec3(0, 8.2, 1.0);
    lines.push([mastBase, mastTop]);
    points.push(mastTop);

    // Retranca (Boom) articulada pelo ângulo da vela
    const boomLength = 4.6;
    const boomEnd = new Vec3(
      mastBase.x + Math.sin(sailAngle) * boomLength,
      mastBase.y + 1.1,
      mastBase.z - Math.cos(sailAngle) * boomLength
    );
    const boomBase = new Vec3(mastBase.x, mastBase.y + 1.1, mastBase.z);
    lines.push([boomBase, boomEnd]);
    points.push(boomEnd);

    // Vela Grande (Mainsail) com ripas transversais
    // Se estiver em ferro (luffing), as ripas tremulam!
    const flutter = isLuffing ? Math.sin(animTime * 25) * 0.45 : 0;
    const midSail = new Vec3(
      boomEnd.x * 0.5 + flutter,
      (mastTop.y + boomEnd.y) * 0.5,
      (mastTop.z + boomEnd.z) * 0.5
    );

    lines.push([mastTop, boomEnd]);
    lines.push([mastBase, boomEnd]);
    lines.push([mastTop, midSail], [midSail, boomEnd]);

    // Ripas transversais da vela grande
    for (let r = 0.25; r <= 0.75; r += 0.25) {
      const pMast = new Vec3(
        mastBase.x,
        mastBase.y + 1.1 + (mastTop.y - mastBase.y - 1.1) * r,
        mastBase.z + (mastTop.z - mastBase.z) * r
      );
      const pEdge = new Vec3(
        boomEnd.x * (1 - r) + flutter * (1 - r),
        boomEnd.y + (mastTop.y - boomEnd.y) * r,
        boomEnd.z + (mastTop.z - boomEnd.z) * r
      );
      lines.push([pMast, pEdge]);
    }

    // Vela de Proa (Genoa / Buja)
    const forestayTop = new Vec3(0, 6.5, 1.1);
    const tackPoint = new Vec3(0, 0.4, 4.4);
    const clewPoint = new Vec3(
      Math.sin(sailAngle * 0.7) * 1.5,
      1.2,
      1.8
    );
    lines.push([forestayTop, tackPoint], [tackPoint, clewPoint], [clewPoint, forestayTop]);

    // Leme na popa
    const rudderTop = new Vec3(0, 0.6, -3.8);
    const rudderBottom = new Vec3(0, -1.2, -4.2);
    lines.push([rudderTop, rudderBottom]);

    return { lines, points };
  },

  /**
   * Bóia de Regata (Pirâmide vetorial com luz pulsante no topo)
   */
  createBuoy() {
    const lines = [];
    const points = [];
    const top = new Vec3(0, 3.2, 0);
    const b1 = new Vec3(-1.2, -0.4, -1.2);
    const b2 = new Vec3(1.2, -0.4, -1.2);
    const b3 = new Vec3(1.2, -0.4, 1.2);
    const b4 = new Vec3(-1.2, -0.4, 1.2);

    lines.push([top, b1], [top, b2], [top, b3], [top, b4]);
    lines.push([b1, b2], [b2, b3], [b3, b4], [b4, b1]);

    // Anel de linha d'água
    const w1 = new Vec3(-1.8, 0, -1.8);
    const w2 = new Vec3(1.8, 0, -1.8);
    const w3 = new Vec3(1.8, 0, 1.8);
    const w4 = new Vec3(-1.8, 0, 1.8);
    lines.push([w1, w2], [w2, w3], [w3, w4], [w4, w1]);

    points.push(top);
    return { lines, points };
  },

  /**
   * Balsa com Náufrago (Para o modo Triângulo das Bermudas)
   */
  createRaft(animTime = 0) {
    const lines = [];
    const points = [];

    // Balsa octogonal
    const r = 1.4;
    const numPts = 6;
    const ring = [];
    for (let i = 0; i < numPts; i++) {
      const a = (i / numPts) * Math.PI * 2;
      ring.push(new Vec3(Math.cos(a) * r, 0.1, Math.sin(a) * r));
    }
    for (let i = 0; i < numPts; i++) {
      lines.push([ring[i], ring[(i + 1) % numPts]]);
      lines.push([ring[i], new Vec3(0, 0, 0)]);
    }

    // Boneco acenando (braços de linhas oscilantes)
    const head = new Vec3(0, 1.5, 0);
    const waist = new Vec3(0, 0.5, 0);
    lines.push([head, waist]);
    points.push(head);

    // Braços em SOS
    const armWave = Math.sin(animTime * 10) * 0.5;
    const leftHand = new Vec3(-0.9, 1.4 + armWave, 0);
    const rightHand = new Vec3(0.9, 1.4 - armWave, 0);
    lines.push([new Vec3(0, 1.2, 0), leftHand]);
    lines.push([new Vec3(0, 1.2, 0), rightHand]);
    points.push(leftHand, rightHand);

    return { lines, points };
  }
};
