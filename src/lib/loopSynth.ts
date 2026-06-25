'use client';

class MarsLoopSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  // Sound nodes
  private noiseSource: AudioBufferSourceNode | null = null;
  private breathGain: GainNode | null = null;
  private breathFilter: BiquadFilterNode | null = null;
  
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padOscGains: GainNode[] = [];

  // Loops/timers
  private heartbeatTimer: any = null;
  private breathCycleTimer: any = null;
  private padTimer: any = null;

  // Sound settings
  private progress = 0.0;
  private currentPadIndex = 0;
  private scaleChords = [
    [130.81, 196.00, 261.63, 329.63], // C3, G3, C4, E4 - open majestic C major
    [146.83, 220.00, 293.66, 349.23]  // D3, A3, D4, F4 - D minor backdrop
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
      console.log('[GENESIS Audio Engine] Loop Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Loop Synth failed to initialize:', e);
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
    this.masterGain.gain.linearRampToValueAtTime(0.95, t + 2.5); // Fade in master soundscape

    // Initialize procedural noise for breathing simulation
    this.setupBreathing();

    // Warm atmospheric low-pass filter
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.setValueAtTime(250, t);
    this.padFilter.Q.setValueAtTime(1.0, t);

    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.06, t);

    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.masterGain);

    this.progress = 0.0;
    this.currentPadIndex = 0;

    // Trigger scheduled loops
    this.playNextLoopPad();
    this.scheduleHeartbeats();
    this.scheduleBreathingCycle(true);
  }

  private setupBreathing() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    try {
      // 1. Procedural white noise generation
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 3.5; // 3.5s breathe cycle
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        channelData[i] = Math.random() * 2.0 - 1.0;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = buffer;
      this.noiseSource.loop = true;

      // 2. Resonant bandpass filter to shape noise into airy breath
      this.breathFilter = this.ctx.createBiquadFilter();
      this.breathFilter.type = 'bandpass';
      this.breathFilter.Q.setValueAtTime(1.5, t);
      this.breathFilter.frequency.setValueAtTime(320, t); // Initial cutoff

      // 3. Breath gain controller
      this.breathGain = this.ctx.createGain();
      this.breathGain.gain.setValueAtTime(0.0, t);

      // Connect
      this.noiseSource.connect(this.breathFilter);
      this.breathFilter.connect(this.breathGain);
      this.breathGain.connect(this.masterGain);

      this.noiseSource.start(t);
    } catch (e) {
      console.error('Failed to setup breathing synth node:', e);
    }
  }

  private scheduleBreathingCycle(isInhaling: boolean) {
    if (!this.active || !this.ctx || !this.breathFilter || !this.breathGain) return;
    const t = this.ctx.currentTime;

    const cycleDuration = isInhaling ? 2.0 : 2.5;

    try {
      this.breathGain.gain.cancelScheduledValues(t);
      this.breathFilter.frequency.cancelScheduledValues(t);

      if (isInhaling) {
        // Inhale: Sweep up frequency (deep breath in) and rise volume
        this.breathGain.gain.setValueAtTime(0.005, t);
        this.breathGain.gain.exponentialRampToValueAtTime(0.024, t + cycleDuration * 0.9);
        this.breathGain.gain.linearRampToValueAtTime(0.005, t + cycleDuration);

        this.breathFilter.frequency.setValueAtTime(280, t);
        this.breathFilter.frequency.exponentialRampToValueAtTime(560, t + cycleDuration * 0.9);
        this.breathFilter.frequency.linearRampToValueAtTime(450, t + cycleDuration);
      } else {
        // Exhale: Sweep down frequency (breath release) and lower volume slowly
        this.breathGain.gain.setValueAtTime(0.024, t);
        this.breathGain.gain.exponentialRampToValueAtTime(0.002, t + cycleDuration * 0.85);
        this.breathGain.gain.setValueAtTime(0.0, t + cycleDuration);

        this.breathFilter.frequency.setValueAtTime(450, t);
        this.breathFilter.frequency.exponentialRampToValueAtTime(260, t + cycleDuration * 0.8);
        this.breathFilter.frequency.setValueAtTime(280, t + cycleDuration);
      }
    } catch (e) {}

    this.breathCycleTimer = setTimeout(() => {
      this.scheduleBreathingCycle(!isInhaling);
    }, cycleDuration * 1000);
  }

  private scheduleHeartbeats() {
    if (!this.active || !this.ctx) return;
    
    // Heart beats twice in quick succession (lub-dub), then pauses
    const interval = 1350; // BPM ~ 88 beats/min
    this.heartbeatTimer = setTimeout(() => {
      this.triggerSingleHeartbeat(true);
      this.triggerSingleHeartbeat(false);
      this.scheduleHeartbeats();
    }, interval);
  }

  private triggerSingleHeartbeat(isFirstBeat: boolean) {
    if (!this.ctx || !this.masterGain) return;
    
    const t = this.ctx.currentTime;
    const beatTimeOffset = isFirstBeat ? 0.0 : 0.28; // time delta between lub and dub
    const triggerTime = t + beatTimeOffset;
    
    // Beat frequency parameters: dub is slightly lower pitch than lub
    const baseFreq = isFirstBeat ? 56.0 : 48.0;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, triggerTime);
      // Pitch sweep downward to simulate a heavy thumping impact
      osc.frequency.exponentialRampToValueAtTime(10.0, triggerTime + 0.16);

      gainNode.gain.setValueAtTime(0.0, triggerTime);
      gainNode.gain.linearRampToValueAtTime(0.45, triggerTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, triggerTime + 0.15);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc.start(triggerTime);
      osc.stop(triggerTime + 0.22);
    } catch (e) {}
  }

  private playNextLoopPad() {
    if (!this.active || !this.ctx || !this.padGain) return;
    const t = this.ctx.currentTime;

    // Clean up previous oscillators
    this.padOscs.forEach((osc) => {
      try {
        osc.stop(t);
        osc.disconnect();
      } catch (e) {}
    });
    this.padOscGains.forEach((g) => {
      try {
        g.disconnect();
      } catch (e) {}
    });
    this.padOscs = [];
    this.padOscGains = [];

    const chord = this.scaleChords[this.currentPadIndex];
    this.currentPadIndex = (this.currentPadIndex + 1) % this.scaleChords.length;

    chord.forEach((freq) => {
      if (!this.ctx || !this.padGain) return;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      oscGain.gain.setValueAtTime(0.0, t);
      // Slow ambient swell
      oscGain.gain.linearRampToValueAtTime(0.24, t + 4.0);
      oscGain.gain.setValueAtTime(0.24, t + 6.0);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 9.5);

      osc.connect(oscGain);
      oscGain.connect(this.padGain);

      osc.start(t);
      this.padOscs.push(osc);
      this.padOscGains.push(oscGain);
    });

    this.padTimer = setTimeout(() => this.playNextLoopPad(), 9500);
  }

  update(progress: number) {
    if (!this.active || !this.ctx || !this.masterGain || !this.padFilter) return;
    const t = this.ctx.currentTime;
    this.progress = progress;

    // Fades pad frequencies to create a sense of expansion into the cosmic ocean (250Hz -> 480Hz)
    const filterCutoff = 250.0 + progress * 230.0;
    this.padFilter.frequency.setTargetAtTime(filterCutoff, t, 0.2);

    // Dynamic master gain modulation:
    // Slightly lower overall volume during white flash zoom descent (0.75 - 0.85) to increase tension, 
    // then restore sound fully as the eye is revealed to create impact.
    if (progress >= 0.70 && progress < 0.85) {
      const midVal = 0.95 - ((progress - 0.70) / 0.15) * 0.4;
      this.masterGain.gain.setTargetAtTime(midVal, t, 0.1);
    } else {
      this.masterGain.gain.setTargetAtTime(0.95, t, 0.15);
    }
  }

  stop() {
    if (!this.active) return;
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    if (this.breathCycleTimer) clearTimeout(this.breathCycleTimer);
    if (this.padTimer) clearTimeout(this.padTimer);

    const t = this.ctx?.currentTime || 0;
    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(0.0, t + 1.2);
      } catch (e) {}
    }

    setTimeout(() => {
      if (this.noiseSource) {
        try {
          this.noiseSource.stop();
          this.noiseSource.disconnect();
        } catch (e) {}
      }
      this.padOscs.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this.padOscs = [];
      this.active = false;
    }, 1300);
  }
}

export const loopSynth = new MarsLoopSynth();
