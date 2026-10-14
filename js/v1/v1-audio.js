/**
 * SAILING (1983 - DYNETRON) - ÁUDIO PC SPEAKER ORIGINAL (1-BIT IBM PC)
 * Emulação dos sons autênticos do chip 8253 PIT para MS-DOS 1983.
 */

class V1Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.initialized = true;
      }
    } catch (e) {
      console.warn("Web Audio API indisponível:", e);
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.enabled = !this.enabled;
    if (this.windGain) {
      this.windGain.gain.value = this.enabled ? 0.05 : 0;
    }
    return this.enabled;
  }

  initWind() {
    if (!this.ctx || this.windNode) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 400;
      this.windFilter.Q.value = 1.6;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.05;

      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      this.windSource.start();
      this.windNode = true;
    } catch (e) {}
  }

  updateWind(windSpeed, boatSpeed, isLuffing) {
    if (!this.enabled || !this.ctx) return;
    if (!this.windNode) this.initWind();

    if (this.windFilter && this.windGain) {
      const now = this.ctx.currentTime;
      const freq = 220 + (windSpeed * 16) + (boatSpeed * 30);
      const vol = isLuffing ? 0.07 : Math.min(0.12, 0.02 + (boatSpeed / 4) * 0.07);

      this.windFilter.frequency.setTargetAtTime(freq, now, 0.1);
      this.windGain.gain.setTargetAtTime(this.enabled ? vol : 0, now, 0.1);
    }

    if (isLuffing) {
      if (!this.lastFlap || performance.now() - this.lastFlap > 200) {
        this.lastFlap = performance.now();
        this.tone(130 + Math.random() * 40, 0.03, 0.07);
      }
    }
  }

  /**
   * Pulso quadrado típico de PC Speaker
   */
  tone(freq, duration, vol = 0.18) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  beepClick() {
    this.tone(980, 0.02, 0.08);
  }

  // Som ao resgatar nadador / náufrago
  rescueDing() {
    this.tone(600, 0.06, 0.2);
    setTimeout(() => this.tone(900, 0.12, 0.2), 60);
  }

  // Som ao colidir com recife ou obstáculo
  crashThud() {
    const freqs = [120, 95, 75, 60];
    freqs.forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.05, 0.25), i * 40);
    });
  }

  // Som dimensional de teletransporte do redemoinho (Whirlwind)
  whirlwindWarp() {
    for (let i = 0; i < 12; i++) {
      const f = 200 + Math.sin(i) * 500 + i * 40;
      setTimeout(() => this.tone(f, 0.04, 0.18), i * 35);
    }
  }

  // Som misterioso da entidade cristalina
  alienChime() {
    const notes = [880, 1174, 1318, 1760];
    notes.forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.08, 0.15), i * 70);
    });
  }

  // Fanfarra ao atracar no porto ao fim da etapa
  portVictory() {
    const melody = [523, 659, 784, 1046];
    melody.forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.14, 0.2), i * 110);
    });
  }

  // Início de etapa
  legStart() {
    this.tone(440, 0.1, 0.15);
    setTimeout(() => this.tone(880, 0.15, 0.2), 110);
  }
}

window.v1Audio = new V1Audio();
