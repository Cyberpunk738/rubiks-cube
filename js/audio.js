/**
 * Audio Engine - Procedural Web Audio API Sound Synthesizer
 * Provides tactile mechanical cube turn clicks, scramble swooshes, victory chimes, and timer beeps.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initAudioContext();
  }

  initAudioContext() {
    // Lazily initialize AudioContext on user interaction to comply with browser autoplay policies
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass && !this.ctx) {
      this.ctx = new AudioContextClass();
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Mechanical plastic cube turn click sound
   * Synthesizes a high-frequency click with subtle resonant body thump
   */
  playTurnSound(speedFactor = 1.0) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.04;

    // 1. Noise burst (high frequency snap)
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    // Highpass filter for crisp click
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1400 * speedFactor, now);

    // Click Gain Envelope
    const clickGain = this.ctx.createGain();
    clickGain.gain.setValueAtTime(0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    whiteNoise.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    whiteNoise.start(now);

    // 2. Low resonant thump (cubelet magnetic/plastic body snap)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 220 * speedFactor + (Math.random() * 20 - 10);
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.045);

    oscGain.gain.setValueAtTime(0.2, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Rapid scramble swoosh sound
   */
  playSwoosh() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const dur = 0.22;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + dur);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + dur);
  }

  /**
   * Solved Victory Chime / Fanfare
   */
  playVictoryChime() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major triad)
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.09;
      const dur = 0.55;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  /**
   * Beep for inspection / timer ready
   */
  playBeep(freq = 880, dur = 0.08) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + dur);
  }
}

// Global instance
window.soundEngine = new SoundEngine();
