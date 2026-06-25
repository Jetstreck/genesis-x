'use client';

class MarsLightsSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  // Sound nodes
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];

  // Loops/timers
  private padTimer: any = null;
  private pianoTimer: any = null;
  private telemetryTimer: any = null;

  // Synth state
  private progress = 0.0;
  private currentPadIndex = 0;

  // Ambient chord progression (Db major -> Bbm -> Gb major7 -> Ab sus4)
  private chords = [
    [138.59, 174.61, 207.65, 277.18], // Db3, F3, Ab3, Db4
    [116.54, 138.59, 174.61, 233.08], // Bb2, Db3, F3, Bb3
    [92.50, 138.59, 185.00, 277.18],  // Gb2, Db3, Gb3, Db4
    [103.83, 155.56, 207.65, 311.13]  // Ab2, Eb3, Ab3, Eb4
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
      console.log('[GENESIS Audio Engine] Lights Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Lights Synth failed to initialize:', e);
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
    this.masterGain.gain.linearRampToValueAtTime(1.0, t + 2.5);

    // Warm, peaceful ambient low-pass filter
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(180, t);
    this.padFilter.Q.setValueAtTime(1.2, t);

    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.06, t);

    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.masterGain);

    this.progress = 0.0;
    this.currentPadIndex = 0;

    // Trigger procedural loops
    this.playNextPadChord();
    this.schedulePianoMelody();
    this.scheduleRadioBeeps();
  }

  private playNextPadChord() {
    if (!this.active || !this.ctx || !this.padGain) return;
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

    const chord = this.chords[this.currentPadIndex];
    this.currentPadIndex = (this.currentPadIndex + 1) % this.chords.length;

    chord.forEach((freq) => {
      if (!this.ctx || !this.padGain) return;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sine'; // Sine waves are pure, soft, and non-intrusive
      osc.frequency.setValueAtTime(freq, t);
      
      oscGain.gain.setValueAtTime(0, t);
      // Ultra-slow swell
      oscGain.gain.linearRampToValueAtTime(0.25, t + 3.0);
      oscGain.gain.setValueAtTime(0.25, t + 6.5);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 8.5);

      osc.connect(oscGain);
      oscGain.connect(this.padGain);

      osc.start(t);
      this.oscs.push(osc);
      this.oscGains.push(oscGain);
    });

    // Chord loops every 8.0 seconds
    this.padTimer = setTimeout(() => this.playNextPadChord(), 8000);
  }

  private schedulePianoMelody() {
    if (!this.active || !this.ctx) return;

    // Trigger a reflective, quiet piano note every 2.8 to 5 seconds
    const delay = 2800 + Math.random() * 2200;
    this.pianoTimer = setTimeout(() => {
      this.playPianoNote();
      this.schedulePianoMelody();
    }, delay);
  }

  private playPianoNote() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Db major / Bb minor pentatonic melody notes (F4, Ab4, Bb4, Db5, Eb5, F5, Ab5)
    const scale = [349.23, 415.30, 466.16, 554.37, 622.25, 698.46, 830.61];
    const freq = scale[Math.floor(Math.random() * scale.length)];

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const lowpass = this.ctx.createBiquadFilter();
      const gainNode = this.ctx.createGain();

      // Blend sine and triangle for a warm, hollow wood-hammer piano pluck timbre
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 1.002, t);

      // Lowpass filter envelope sweeps down to filter out higher triangle buzz
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(freq * 2.5, t);
      lowpass.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.35);

      // Dynamic gain envelope
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.12, t + 0.005); // Fast hammer strike
      gainNode.gain.exponentialRampToValueAtTime(0.015, t + 0.4); // Fast decay
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 2.2); // Slow tail release

      osc1.connect(lowpass);
      osc2.connect(lowpass);
      lowpass.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 2.4);
      osc2.stop(t + 2.4);
    } catch (e) {}
  }

  private scheduleRadioBeeps() {
    if (!this.active || !this.ctx) return;

    // Soft, delicate telemetry signal in the background (human civilization corridor)
    const delay = 4000 + Math.random() * 4000;
    this.telemetryTimer = setTimeout(() => {
      this.playRadioBeep();
      this.scheduleRadioBeeps();
    }, delay);
  }

  private playRadioBeep() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    const notes = [880.00, 1046.50, 1174.66]; // A5, C6, D6
    const freq = notes[Math.floor(Math.random() * notes.length)];

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.005, t + 0.006);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) {}
  }

  update(progress: number) {
    if (!this.active || !this.ctx || !this.padGain || !this.masterGain || !this.padFilter) return;
    const t = this.ctx.currentTime;

    this.progress = progress;

    // As sunset settles:
    // 1. Pad filter frequency gets slightly darker and warmer (180Hz -> 120Hz)
    // 2. Pad gain is quiet and peaceful
    // 3. Fades out master at the end of the scene (last 4% scroll)

    const filterFreq = 180.0 - progress * 60.0;
    this.padFilter.frequency.setTargetAtTime(filterFreq, t, 0.2);

    if (progress < 0.96) {
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } else {
      const fadeProgress = (progress - 0.96) / 0.04;
      const volumeVal = 1.0 - fadeProgress;
      this.masterGain.gain.setTargetAtTime(volumeVal, t, 0.05);
    }
  }

  stop() {
    if (!this.active) return;
    if (this.padTimer) clearTimeout(this.padTimer);
    if (this.pianoTimer) clearTimeout(this.pianoTimer);
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

export const lightsSynth = new MarsLightsSynth();
