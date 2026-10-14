/**
 * SAILING (1986) - SINTETIZADOR DE ÁUDIO ESTILO PC SPEAKER (CHIP 8253 PIT)
 * Web Audio API gerando ondas quadradas puras e efeitos sonoros nostálgicos.
 */

class RetroAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.inIronsOsc = null;
    this.inIronsGain = null;
    this.windNoise = null;
    this.windGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.initWindHum();
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
    if (!this.enabled && this.windGain) {
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.stopInIronsAlarm();
    }
    return this.enabled;
  }

  /**
   * Bip básico de PC Speaker de 1 bit
   */
  beep(freq = 440, duration = 0.08, type = 'square', vol = 0.15) {
    if (!this.enabled || !this.ctx) return;
    this.resume();

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  /**
   * Som de clique mecânico / ajuste de vela ou leme
   */
  clickSound() {
    if (!this.enabled || !this.ctx) return;
    this.beep(880, 0.02, 'square', 0.08);
  }

  /**
   * Som de contornar bóia com sucesso (chime ascendente de 2 notas)
   */
  buoyRoundSound() {
    if (!this.enabled || !this.ctx) return;
    this.beep(523.25, 0.12, 'square', 0.15); // C5
    setTimeout(() => {
      this.beep(659.25, 0.18, 'square', 0.18); // E5
    }, 110);
    setTimeout(() => {
      this.beep(1046.50, 0.25, 'square', 0.22); // C6
    }, 240);
  }

  /**
   * Som de resgate de náufrago (fanfarra de vitória retrô)
   */
  rescueSound() {
    if (!this.enabled || !this.ctx) return;
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.beep(freq, 0.12, 'triangle', 0.2);
      }, idx * 90);
    });
  }

  /**
   * Alarme intermitente de "Em Ferro" (No-go zone)
   */
  startInIronsAlarm() {
    if (!this.enabled || !this.ctx || this.inIronsOsc) return;
    try {
      this.inIronsOsc = this.ctx.createOscillator();
      this.inIronsGain = this.ctx.createGain();

      this.inIronsOsc.type = 'sawtooth';
      this.inIronsOsc.frequency.setValueAtTime(140, this.ctx.currentTime);

      // Tremolo rápido
      this.inIronsGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.inIronsOsc.connect(this.inIronsGain);
      this.inIronsGain.connect(this.ctx.destination);
      this.inIronsOsc.start();
    } catch (e) {}
  }

  stopInIronsAlarm() {
    if (this.inIronsOsc) {
      try {
        this.inIronsOsc.stop();
        this.inIronsOsc.disconnect();
      } catch (e) {}
      this.inIronsOsc = null;
      this.inIronsGain = null;
    }
  }

  /**
   * Chiado suave de vento e água
   */
  initWindHum() {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      whiteNoise.start();
      this.windNoise = whiteNoise;
      this.windFilter = filter;
    } catch (e) {}
  }

  updateWindSound(speedRatio = 0.5) {
    if (!this.enabled || !this.windGain || !this.windFilter) return;
    try {
      const targetVol = 0.01 + speedRatio * 0.05;
      const targetFreq = 200 + speedRatio * 600;
      this.windGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.2);
      this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.2);
    } catch (e) {}
  }
}

window.retroAudio = new RetroAudio();
