'use client';

class RainSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  // Wind nodes
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Timers
  private rainTimer: any = null;
  private padTimer: any = null;
  private thunderTimer: any = null;

  // Control variables modulated by scroll progress
  private rainDensity = 0.0;
  private currentStage = 1;
  private padVolumeMultiplier = 1.0;

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
      console.log('[GENESIS Audio Engine] Rain Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Rain Synth failed to initialize:', e);
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2.0 - 1.0;
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
    this.masterGain.gain.cancelScheduledValues(t);
    this.masterGain.gain.setValueAtTime(0, t);
    this.masterGain.gain.linearRampToValueAtTime(1.0, t + 2.5); // Fade in master sound

    const noiseBuffer = this.createNoiseBuffer();

    // 1. Procedural Wind
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(120, t); // Low rumbling base wind

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.04, t);

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start(t);

    // 2. Start loop timers
    this.rainDensity = 0.0;
    this.currentStage = 1;
    this.padVolumeMultiplier = 1.0;

    this.scheduleRain();
    this.schedulePad();
    this.scheduleThunder();
  }

  private scheduleRain() {
    if (!this.active || !this.ctx) return;

    if (this.currentStage === 4 || this.currentStage === 5) {
      const density = this.rainDensity;
      if (density > 0.02) {
        // High density = rapid drops. Math.max of 6ms, scaling from 220ms
        const interval = Math.max(6, 220 - density * 210);
        this.playDroplet(false);
        this.rainTimer = setTimeout(() => this.scheduleRain(), interval + Math.random() * interval * 0.4);
        return;
      }
    }

    this.rainTimer = setTimeout(() => this.scheduleRain(), 80);
  }

  private schedulePad() {
    if (!this.active || !this.ctx) return;

    // Pad plays slower in SCN_09, feeling sacred and quiet
    const delay = 7000 + Math.random() * 5000;
    this.padTimer = setTimeout(() => {
      if (this.currentStage !== 3) {
        this.playPadNote();
      }
      this.schedulePad();
    }, delay);
  }

  private scheduleThunder() {
    if (!this.active || !this.ctx) return;

    // Distant thunder only starts occurring in stage 5
    const delay = 12000 + Math.random() * 12000;
    this.thunderTimer = setTimeout(() => {
      if (this.currentStage === 5) {
        this.playThunder();
      }
      this.scheduleThunder();
    }, delay);
  }

  playDroplet(isFirstDrop = false) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    try {
      // 1. Splash droplet body (sine wave with pitch sweep)
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = 'sine';
      // First drop has a much lower, heavier impact resonant pitch
      const startFreq = isFirstDrop ? 650 : 1100 + Math.random() * 500;
      const endFreq = isFirstDrop ? 50 : 130 + Math.random() * 40;
      const duration = isFirstDrop ? 0.32 : 0.05 + Math.random() * 0.03;

      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(isFirstDrop ? 0.42 : 0.05 + Math.random() * 0.04, t + 0.004);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.01);

      osc.connect(gainNode);
      gainNode.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + duration + 0.05);

      // 2. High-frequency splash click (triangle osc)
      const click = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();

      click.type = 'triangle';
      click.frequency.setValueAtTime(isFirstDrop ? 2200 : 3500 + Math.random() * 1500, t);

      clickGain.gain.setValueAtTime(0, t);
      clickGain.gain.linearRampToValueAtTime(isFirstDrop ? 0.15 : 0.015, t + 0.002);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, t + (isFirstDrop ? 0.06 : 0.015));

      click.connect(clickGain);
      clickGain.connect(this.masterGain);
      click.start(t);
      click.stop(t + 0.08);

      // 3. Wet soil muddy splatter (filtered noise burst)
      if (isFirstDrop || Math.random() > 0.4) {
        const noiseSource = this.ctx.createBufferSource();
        // Use a short noise buffer directly
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2.0 - 1.0;
        }
        noiseSource.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        // Wet impacts reside in mid-low frequencies (300Hz-600Hz)
        noiseFilter.frequency.setValueAtTime(isFirstDrop ? 250 : 380 + Math.random() * 200, t);
        noiseFilter.Q.setValueAtTime(3.0, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(isFirstDrop ? 0.28 : 0.02 + Math.random() * 0.02, t + 0.005);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + (isFirstDrop ? 0.14 : 0.05));

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noiseSource.start(t);
        noiseSource.stop(t + 0.2);
      }
    } catch (e) {}
  }

  playThunder() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    try {
      const bufferSize = this.ctx.sampleRate * 4.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2.0 - 1.0;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(42, t);
      // As the sound travels, filter cuts higher rumble elements
      filter.frequency.linearRampToValueAtTime(20, t + 3.5);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      // Double crackle-peak thunder profile
      gain.gain.linearRampToValueAtTime(0.16, t + 0.25);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.55);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.85);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(t);
      noise.stop(t + 4.5);
    } catch (e) {}
  }

  private playPadNote() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Sacred, melancholic chord progression keys (Eb, Gm, Bb, F, Ab)
    const notes = [116.54, 130.81, 146.83, 155.56, 174.61, 196.00, 233.08];
    const freq = notes[Math.floor(Math.random() * notes.length)];

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gainNode = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, t);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 1.006, t); // Slight chorus detune

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.05 * this.padVolumeMultiplier, t + 3.0); // Ultra slow swell
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 8.5); // long tail decay

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 9.0);
      osc2.stop(t + 9.0);
    } catch (e) {}
  }

  update(progress: number) {
    if (!this.active || !this.ctx || !this.windGain || !this.masterGain || !this.windFilter) return;
    const t = this.ctx.currentTime;

    // Define stage boundaries:
    // Stage 1: [0.00 - 0.25] - The Sky Changes
    // Stage 2: [0.25 - 0.45] - Atmospheric Buildup
    // Stage 3: [0.45 - 0.55] - The First Drop (Droplet drops at ~0.50)
    // Stage 4: [0.55 - 0.80] - The Rainfall
    // Stage 5: [0.80 - 1.00] - Transition Out (Ascent)

    if (progress < 0.25) {
      // Stage 1
      this.currentStage = 1;
      this.rainDensity = 0.0;
      this.padVolumeMultiplier = 1.0;
      
      this.windGain.gain.setTargetAtTime(0.03, t, 0.2);
      this.windFilter.frequency.setTargetAtTime(110, t, 0.25);
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } 
    else if (progress < 0.45) {
      // Stage 2: Wind starts building up
      this.currentStage = 2;
      this.rainDensity = 0.0;
      this.padVolumeMultiplier = 1.2;

      const stageProgress = (progress - 0.25) / 0.20; // 0.0 -> 1.0
      const windVal = 0.03 + stageProgress * 0.08;
      const windFreq = 110 + stageProgress * 60;

      this.windGain.gain.setTargetAtTime(windVal, t, 0.15);
      this.windFilter.frequency.setTargetAtTime(windFreq, t, 0.2);
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } 
    else if (progress < 0.55) {
      // Stage 3: Silence holds. Wind drops completely. Pad volume becomes whisper quiet.
      this.currentStage = 3;
      this.rainDensity = 0.0;
      this.padVolumeMultiplier = 0.15;

      this.windGain.gain.setTargetAtTime(0.002, t, 0.08);
      this.windFilter.frequency.setTargetAtTime(60, t, 0.1);
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } 
    else if (progress < 0.80) {
      // Stage 4: Rain shower begins and swells
      this.currentStage = 4;
      this.padVolumeMultiplier = 0.85;

      const stageProgress = (progress - 0.55) / 0.25; // 0.0 -> 1.0
      this.rainDensity = stageProgress; // 0.0 -> 1.0 density

      const windVal = 0.04 + stageProgress * 0.07;
      const windFreq = 90 + stageProgress * 50;

      this.windGain.gain.setTargetAtTime(windVal, t, 0.1);
      this.windFilter.frequency.setTargetAtTime(windFreq, t, 0.15);
      this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
    } 
    else {
      // Stage 5: Rain is heavy. Thunder rolls. Master fades out at the end.
      this.currentStage = 5;
      this.rainDensity = 1.0;
      this.padVolumeMultiplier = 0.9;

      const stageProgress = (progress - 0.80) / 0.20; // 0.0 -> 1.0

      if (stageProgress < 0.80) {
        // High wind/rain presence
        this.windGain.gain.setTargetAtTime(0.12, t, 0.15);
        this.windFilter.frequency.setTargetAtTime(150, t, 0.2);
        this.masterGain.gain.setTargetAtTime(1.0, t, 0.1);
      } else {
        // Fade out during last 4% scroll of scene
        const fadeProgress = (stageProgress - 0.80) / 0.20; // 0.0 -> 1.0
        const fadeVolume = 1.0 - fadeProgress;
        this.masterGain.gain.setTargetAtTime(fadeVolume, t, 0.05);
      }
    }
  }

  stop() {
    if (!this.active) return;
    if (this.rainTimer) clearTimeout(this.rainTimer);
    if (this.padTimer) clearTimeout(this.padTimer);
    if (this.thunderTimer) clearTimeout(this.thunderTimer);

    const t = this.ctx?.currentTime || 0;
    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(0, t + 1.2);
      } catch (e) {}
    }

    setTimeout(() => {
      try {
        this.windSource?.stop();
        this.windSource?.disconnect();
      } catch (e) {}
      this.windSource = null;
      this.active = false;
    }, 1300);
  }
}

export const rainSynth = new RainSynth();
