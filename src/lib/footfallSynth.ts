'use client';

class FootfallSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  // Breathing components
  private breathSource: AudioBufferSourceNode | null = null;
  private breathFilter: BiquadFilterNode | null = null;
  private breathGain: GainNode | null = null;
  private breathTimer: any = null;

  // Wind and Radio Hum components
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private radioSource: AudioBufferSourceNode | null = null;
  private radioFilter: BiquadFilterNode | null = null;
  private radioGain: GainNode | null = null;
  
  // Sparse melody
  private melodyTimeout: any = null;

  constructor() {}

  init() {
    if (this.active) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.active = true;
      console.log('[GENESIS Audio Engine] Footfall Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Footfall Synth failed to initialize:', e);
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  start() {
    this.init();
    if (!this.active || !this.ctx || !this.masterGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0, t);
    this.masterGain.gain.linearRampToValueAtTime(1.0, t + 3.0); // smooth entry fade

    const noiseBuffer = this.createNoiseBuffer();

    // 1. Set up Spacesuit Breathing
    this.breathSource = this.ctx.createBufferSource();
    this.breathSource.buffer = noiseBuffer;
    this.breathSource.loop = true;

    this.breathFilter = this.ctx.createBiquadFilter();
    this.breathFilter.type = 'bandpass';
    this.breathFilter.Q.setValueAtTime(4.0, t);
    this.breathFilter.frequency.setValueAtTime(200, t);

    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.setValueAtTime(0, t);

    this.breathSource.connect(this.breathFilter);
    this.breathFilter.connect(this.breathGain);
    this.breathGain.connect(this.masterGain);
    this.breathSource.start(t);

    // Start breathing cycle loop
    this.runBreathingLoop();

    // 2. Set up Distant Martian Wind
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(70, t); // deep bass rumble

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.08, t); // low baseline rumble

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start(t);

    // 3. Set up Radio static / static hum
    this.radioSource = this.ctx.createBufferSource();
    this.radioSource.buffer = noiseBuffer;
    this.radioSource.loop = true;

    this.radioFilter = this.ctx.createBiquadFilter();
    this.radioFilter.type = 'highpass';
    this.radioFilter.frequency.setValueAtTime(1400, t); // high hiss

    this.radioGain = this.ctx.createGain();
    this.radioGain.gain.setValueAtTime(0.005, t); // very faint static

    this.radioSource.connect(this.radioFilter);
    this.radioFilter.connect(this.radioGain);
    this.radioGain.connect(this.masterGain);
    this.radioSource.start(t);

    // 4. Start sparse melody scheduler
    this.scheduleMelody();
  }

  private runBreathingLoop() {
    if (!this.active || !this.ctx || !this.breathFilter || !this.breathGain) return;

    const t = this.ctx.currentTime;
    
    // Inhale: 1.8 seconds
    this.breathFilter.frequency.cancelScheduledValues(t);
    this.breathFilter.frequency.setValueAtTime(180, t);
    this.breathFilter.frequency.linearRampToValueAtTime(450, t + 1.8);

    this.breathGain.gain.cancelScheduledValues(t);
    this.breathGain.gain.setValueAtTime(0.001, t);
    this.breathGain.gain.linearRampToValueAtTime(0.12, t + 1.8);

    // Exhale: 2.2 seconds (starts at t + 1.8)
    const tExhale = t + 1.8;
    this.breathFilter.frequency.setValueAtTime(450, tExhale);
    this.breathFilter.frequency.exponentialRampToValueAtTime(140, tExhale + 2.2);

    this.breathGain.gain.setValueAtTime(0.12, tExhale);
    this.breathGain.gain.exponentialRampToValueAtTime(0.001, tExhale + 2.2);

    // Pause: 1.2 seconds (starts at t + 4.0)
    // Breathing cycle completes at t + 5.2

    this.breathTimer = setTimeout(() => {
      this.runBreathingLoop();
    }, 5200);
  }

  private scheduleMelody() {
    if (!this.active || !this.ctx) return;

    // Trigger a reflective resonance note every 8-12 seconds
    const delay = 8000 + Math.random() * 4000;
    this.melodyTimeout = setTimeout(() => {
      this.playReflectiveNote();
      this.scheduleMelody();
    }, delay);
  }

  private playReflectiveNote() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const notes = [65.41, 73.42, 87.31, 110.00]; // Low C2, D2, F2, A2
    const freq = notes[Math.floor(Math.random() * notes.length)];

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.06, t + 1.5); // long attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 6.0); // long resonance fade

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 6.5);
    } catch (e) {}
  }

  update(scrollFraction: number) {
    if (!this.active || !this.ctx || !this.windGain || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // As user scrolls:
    // 1. Wind strength increases slightly as camera pivots/rises (0.05 -> 0.16)
    // 2. Fades out master at the end of the scene (descent looking out)
    if (scrollFraction < 0.90) {
      const targetWind = 0.08 + scrollFraction * 0.08;
      this.windGain.gain.setTargetAtTime(targetWind, t, 0.2);
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } else {
      const fadeFactor = 1.0 - (scrollFraction - 0.90) / 0.10;
      this.masterGain.gain.setTargetAtTime(fadeFactor, t, 0.08);
    }
  }

  stop() {
    if (!this.active) return;
    if (this.breathTimer) clearTimeout(this.breathTimer);
    if (this.melodyTimeout) clearTimeout(this.melodyTimeout);

    const t = this.ctx?.currentTime || 0;
    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(0, t + 1.5);
      } catch (e) {}
    }

    setTimeout(() => {
      // Disconnect and stop all nodes
      [this.breathSource, this.windSource, this.radioSource].forEach((src) => {
        try {
          src?.stop();
          src?.disconnect();
        } catch (e) {}
      });
      this.breathSource = null;
      this.windSource = null;
      this.radioSource = null;
      this.active = false;
    }, 1600);
  }
}

export const footfallSynth = new FootfallSynth();
