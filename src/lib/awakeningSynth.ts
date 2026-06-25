'use client';

class MarsAwakeningSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  // Sound nodes
  private stringGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];

  // Loops/timers
  private chordTimer: any = null;
  private chimeTimer: any = null;
  private telemetryTimer: any = null;

  // Synth state
  private progress = 0.0;
  private currentChordIndex = 0;

  // Chord progression definitions: C major -> Fmaj7 -> A minor -> G major (hopeful, cinematic)
  private chords = [
    [130.81, 164.81, 196.00, 261.63], // C3, E3, G3, C4 (C major)
    [87.31, 130.81, 174.61, 261.63],  // F2, C3, F3, C4 (F major)
    [110.00, 164.81, 220.00, 329.63], // A2, E3, A3, E4 (A minor)
    [98.00, 146.83, 196.00, 293.66]   // G2, D3, G3, D4 (G major)
  ];

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
      console.log('[GENESIS Audio Engine] Mars Awakening Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Mars Awakening Synth failed to initialize:', e);
    }
  }

  start() {
    this.init();
    if (!this.active || !this.ctx || !this.masterGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setValueAtTime(0, t);
    this.masterGain.gain.linearRampToValueAtTime(1.0, t + 3.0); // Smooth swell at launch

    // Set up strings filter and master gain
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(220, t); // Low filter baseline
    this.filterNode.Q.setValueAtTime(2.0, t);

    this.stringGain = this.ctx.createGain();
    this.stringGain.gain.setValueAtTime(0.08, t); // Low volume initially

    this.stringGain.connect(this.filterNode);
    this.filterNode.connect(this.masterGain);

    this.progress = 0.0;
    this.currentChordIndex = 0;

    // Trigger loops
    this.playNextChord();
    this.scheduleChimes();
    this.scheduleTelemetry();
  }

  private playNextChord() {
    if (!this.active || !this.ctx || !this.stringGain) return;
    const t = this.ctx.currentTime;

    // Clean up previous oscillators
    this.oscs.forEach((osc) => {
      try {
        osc.stop(t);
        osc.disconnect();
      } catch (e) {}
    });
    this.oscGains.forEach((g) => {
      try {
        g.disconnect();
      } catch (e) {}
    });
    this.oscs = [];
    this.oscGains = [];

    const chord = this.chords[this.currentChordIndex];
    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;

    // Play string chord (4 oscillators)
    chord.forEach((freq, i) => {
      if (!this.ctx || !this.stringGain) return;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      // Detuned sawtooth/triangle blend to simulate string ensembles
      osc.type = i % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      
      // Slight detune for fat chorus depth
      osc.detune.setValueAtTime((Math.random() - 0.5) * 14.0, t);

      oscGain.gain.setValueAtTime(0, t);
      // Swell attack
      oscGain.gain.linearRampToValueAtTime(0.24, t + 2.5);
      // Retain sustain, then fade slowly at end of chord duration
      oscGain.gain.setValueAtTime(0.24, t + 6.0);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 8.0);

      osc.connect(oscGain);
      oscGain.connect(this.stringGain);

      osc.start(t);
      this.oscs.push(osc);
      this.oscGains.push(oscGain);
    });

    // Loop chord every 7.5 seconds
    this.chordTimer = setTimeout(() => this.playNextChord(), 7500);
  }

  private scheduleChimes() {
    if (!this.active || !this.ctx) return;

    // Chimes trigger representing new bio-life expansion (peaking in Stage 2 & 4)
    const delay = 3500 + Math.random() * 4000;
    this.chimeTimer = setTimeout(() => {
      if (this.progress > 0.15 && this.progress < 0.88) {
        this.playChime();
      }
      this.scheduleChimes();
    }, delay);
  }

  private playChime() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Pentatonic scale sparkles (C5, D5, E5, G5, A5, C6)
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    const freq = scale[Math.floor(Math.random() * scale.length)];

    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      // Fast drop sweep to mimic a water droplet drop or sparkling chime
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.3);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.5, t);
      filter.Q.setValueAtTime(8.0, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.08, t + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.8);
    } catch (e) {}
  }

  private scheduleTelemetry() {
    if (!this.active || !this.ctx) return;

    // Telemetry sounds trigger when civilization lights twinkle (Stage 6 > 0.95)
    const delay = 1200 + Math.random() * 1200;
    this.telemetryTimer = setTimeout(() => {
      if (this.progress >= 0.94) {
        this.playTelemetry();
      }
      this.scheduleTelemetry();
    }, delay);
  }

  private playTelemetry() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // High space beacon tones
    const notes = [1318.51, 1567.98, 1975.53, 2093.00]; // E6, G6, B6, C7
    const freq = notes[Math.floor(Math.random() * notes.length)];

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.015, t + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {}
  }

  update(progress: number) {
    if (!this.active || !this.ctx || !this.stringGain || !this.masterGain || !this.filterNode) return;
    const t = this.ctx.currentTime;

    this.progress = progress;

    // Dynamic progression modifiers:
    // 1. Strings volume swells from 0.08 up to 0.45 as the planet transforms
    // 2. Lowpass filter frequency opens from 220Hz up to 950Hz to let higher frequencies shine
    // 3. Overall master volume fades out slowly at the absolute end (last 3% of scroll)

    const swellVolume = 0.08 + Math.min(0.85, progress) * 0.36;
    const filterFreq = 220.0 + Math.min(0.88, progress) * 730.0;

    this.stringGain.gain.setTargetAtTime(swellVolume, t, 0.25);
    this.filterNode.frequency.setTargetAtTime(filterFreq, t, 0.3);

    if (progress < 0.97) {
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } else {
      // Fade out
      const fadeProgress = (progress - 0.97) / 0.03; // 0.0 -> 1.0
      const volumeVal = 1.0 - fadeProgress;
      this.masterGain.gain.setTargetAtTime(volumeVal, t, 0.05);
    }
  }

  stop() {
    if (!this.active) return;
    if (this.chordTimer) clearTimeout(this.chordTimer);
    if (this.chimeTimer) clearTimeout(this.chimeTimer);
    if (this.telemetryTimer) clearTimeout(this.telemetryTimer);

    const t = this.ctx?.currentTime || 0;
    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(0, t + 1.2);
      } catch (e) {}
    }

    setTimeout(() => {
      this.oscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this.oscs = [];
      this.active = false;
    }, 1300);
  }
}

export const awakeningSynth = new MarsAwakeningSynth();
