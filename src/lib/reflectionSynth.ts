'use client';

class MarsReflectionSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  // Sound nodes
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];

  // Loops/timers
  private padTimer: any = null;
  private chimeTimer: any = null;

  // Synth state
  private progress = 0.0;
  private currentPadIndex = 0;

  // Sacred major7/maj9 chord progression: (Cmaj9 -> Fmaj9 -> Am9 -> Gsus4)
  private chords = [
    [130.81, 164.81, 196.00, 246.94, 293.66], // C3, E3, G3, B3, D4
    [87.31, 130.81, 174.61, 220.00, 349.23],  // F2, C3, F3, A3, F4
    [110.00, 146.83, 174.61, 220.00, 329.63], // A2, D3, F3, A3, E4
    [98.00, 146.83, 196.00, 293.66, 392.00]   // G2, D3, G3, D4, G4
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

      // Setup feedback delay node for the space shimmer/chime harmonics
      this.delayNode = this.ctx.createDelay(2.0);
      this.delayFeedback = this.ctx.createGain();
      this.delayNode.delayTime.setValueAtTime(0.6, this.ctx.currentTime);
      this.delayFeedback.gain.setValueAtTime(0.4, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);

      this.active = true;
      console.log('[GENESIS Audio Engine] Reflection Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Reflection Synth failed to initialize:', e);
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
    this.masterGain.gain.linearRampToValueAtTime(1.0, t + 3.0); // Slow fade-in of general soundscape

    // Very soft resonant low-pass filter to emulate the vacuum/space environment
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(220, t);
    this.padFilter.Q.setValueAtTime(1.0, t);

    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.08, t);

    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.masterGain);

    this.progress = 0.0;
    this.currentPadIndex = 0;

    // Start playing choir chord loops and sparkling space chimes
    this.playNextChoirChord();
    this.scheduleSpaceChimes();
  }

  private playNextChoirChord() {
    if (!this.active || !this.ctx || !this.padGain) return;
    const t = this.ctx.currentTime;

    // Clean up previous chord oscillators
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

      // Layer 1: Pure sine wave for deep warmth
      const osc1 = this.ctx.createOscillator();
      const oscGain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, t);

      // Layer 2: Soft triangle wave slightly detuned for organic choir vibe
      const osc2 = this.ctx.createOscillator();
      const oscGain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 1.002, t);

      oscGain1.gain.setValueAtTime(0, t);
      oscGain1.gain.linearRampToValueAtTime(0.18, t + 3.5); // long slow swell
      oscGain1.gain.setValueAtTime(0.18, t + 7.5);
      oscGain1.gain.exponentialRampToValueAtTime(0.0001, t + 9.5); // release tail

      oscGain2.gain.setValueAtTime(0, t);
      oscGain2.gain.linearRampToValueAtTime(0.06, t + 3.8); 
      oscGain2.gain.setValueAtTime(0.06, t + 7.5);
      oscGain2.gain.exponentialRampToValueAtTime(0.0001, t + 9.5); 

      osc1.connect(oscGain1);
      oscGain1.connect(this.padGain);

      osc2.connect(oscGain2);
      oscGain2.connect(this.padGain);

      osc1.start(t);
      osc2.start(t);

      this.oscs.push(osc1, osc2);
      this.oscGains.push(oscGain1, oscGain2);
    });

    // Swell loop occurs every 9.0 seconds
    this.padTimer = setTimeout(() => this.playNextChoirChord(), 9000);
  }

  private scheduleSpaceChimes() {
    if (!this.active || !this.ctx) return;

    // Trigger faint chime bell harmonics at random interval (4.0s - 7.5s)
    const delay = 4000 + Math.random() * 3500;
    this.chimeTimer = setTimeout(() => {
      this.playChimeNote();
      this.scheduleSpaceChimes();
    }, delay);
  }

  private playChimeNote() {
    if (!this.ctx || !this.masterGain || !this.delayNode) return;
    const t = this.ctx.currentTime;

    // Peaceful pentatonic chime scale (C5, D5, E5, G5, A5, C6)
    const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    const freq = scale[Math.floor(Math.random() * scale.length)];

    try {
      const osc = this.ctx.createOscillator();
      const lowpass = this.ctx.createBiquadFilter();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      // Gentle filter sweep
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(freq * 1.5, t);
      lowpass.frequency.exponentialRampToValueAtTime(freq * 0.8, t + 0.5);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.04, t + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

      osc.connect(lowpass);
      lowpass.connect(gainNode);
      
      // Connect to both Master and Delay Loop for echo
      gainNode.connect(this.masterGain);
      gainNode.connect(this.delayNode);

      osc.start(t);
      osc.stop(t + 2.0);
    } catch (e) {}
  }

  update(progress: number) {
    if (!this.active || !this.ctx || !this.masterGain || !this.padFilter) return;
    const t = this.ctx.currentTime;

    this.progress = progress;

    // As reflection reaches climax (Stage 3 & 4), expand the filter frequency (220Hz -> 380Hz) to sound brighter
    const filterFreq = 220.0 + progress * 160.0;
    this.padFilter.frequency.setTargetAtTime(filterFreq, t, 0.15);

    // Fade out audio on transition out (starts at 0.95 progress)
    if (progress < 0.95) {
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.15);
    } else {
      const fadeProgress = (progress - 0.95) / 0.05;
      const volumeVal = Math.max(0.0, 1.0 - fadeProgress);
      this.masterGain.gain.setTargetAtTime(volumeVal, t, 0.08);
    }
  }

  stop() {
    if (!this.active) return;
    if (this.padTimer) clearTimeout(this.padTimer);
    if (this.chimeTimer) clearTimeout(this.chimeTimer);

    const t = this.ctx?.currentTime || 0;
    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(0.0, t + 1.5);
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
    }, 1600);
  }
}

export const reflectionSynth = new MarsReflectionSynth();
