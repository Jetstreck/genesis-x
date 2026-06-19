'use client';

class ShepardToneSynth {
  private ctx: AudioContext | null = null;
  private oscillators: { osc: OscillatorNode; base: number; gainNode: GainNode }[] = [];
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private active = false;
  private ambientNodes: (OscillatorNode | GainNode)[] = [];
  private triggeredNotes: { [key: number]: boolean } = {};

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

      // Create Shepard Tone oscillators
      // 5 octaves spaced
      const numOscs = 5;
      const baseFreq = 55; // A1 base
      for (let i = 0; i < numOscs; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const octaveFreq = baseFreq * Math.pow(2, i);
        osc.frequency.setValueAtTime(octaveFreq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0, this.ctx.currentTime);

        osc.connect(gain);
        gain.connect(this.masterGain);

        this.oscillators.push({ osc, base: octaveFreq, gainNode: gain });
      }

      // Create deep sub-bass rumble oscillator
      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'sawtooth';
      this.rumbleOsc.frequency.setValueAtTime(32, this.ctx.currentTime); // Low C0/C1 boundary

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(75, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.rumbleGain = this.ctx.createGain();
      this.rumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.rumbleOsc.connect(filter);
      filter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.masterGain);

      // Start all sound sources
      this.oscillators.forEach((o) => o.osc.start());
      this.rumbleOsc.start();
      this.active = true;
      console.log('[GENESIS Audio Engine] Shepard Tone Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Web Audio API initialization failed:', e);
    }
  }

  update(dragProgress: number) {
    if (!this.active) {
      this.init();
    }
    if (!this.ctx || !this.masterGain || !this.rumbleGain || !this.rumbleOsc) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;

    // Master volume scales up with drag progress (max 0.75 to protect hearing)
    this.masterGain.gain.setTargetAtTime(dragProgress * 0.75, t, 0.05);

    // Pitch multiplier: sweeps up by 2.2x over the drag
    const pitchFactor = 1.0 + dragProgress * 1.2;

    this.oscillators.forEach((o) => {
      const currentFreq = o.base * pitchFactor;
      o.osc.frequency.setTargetAtTime(currentFreq, t, 0.04);

      // Shepard Tone envelope: bell curve in log space centered around 250Hz (log frequency scale)
      // High and low frequencies are attenuated so they fade in/out seamlessly
      const logFreq = Math.log2(currentFreq / 55);
      const centerLog = 2.2; // roughly 250 Hz
      const sigma = 1.1;
      const volume = Math.exp(-Math.pow(logFreq - centerLog, 2) / (2 * Math.pow(sigma, 2)));

      // Limit individual oscillator volume to avoid clipping
      o.gainNode.gain.setTargetAtTime(volume * 0.16, t, 0.05);
    });

    // Sub-bass rumble volume scales with drag progress (up to 0.45)
    this.rumbleGain.gain.setTargetAtTime(dragProgress * 0.45, t, 0.05);
    // Rumble pitch rises slightly as tension builds
    this.rumbleOsc.frequency.setTargetAtTime(32 + dragProgress * 18, t, 0.05);
  }

  triggerSnap() {
    if (!this.active || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;

    // Stop deep space drone if running from a previous lifecycle
    this.stopAmbient();
    this.triggeredNotes = {}; // Reset SCN_05 triggered notes

    // 1. Cut the Shepard Tone and rumble instantly to generate the hard vacuum silence drop
    this.masterGain.gain.setValueAtTime(0, t);

    // 2. Play a synthesized explosive sub-bass "thud" impact sound using isolated nodes
    try {
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();
      const snapFilter = this.ctx.createBiquadFilter();

      snapOsc.type = 'sine';
      snapOsc.frequency.setValueAtTime(100, t);
      // Pitch drop representing structural implosion
      snapOsc.frequency.exponentialRampToValueAtTime(0.01, t + 0.9);

      snapFilter.type = 'lowpass';
      snapFilter.frequency.setValueAtTime(120, t);

      snapGain.gain.setValueAtTime(1.1, t);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      snapOsc.connect(snapFilter);
      snapFilter.connect(snapGain);
      gainNodeConnect(snapGain, this.ctx.destination);

      snapOsc.start(t);
      snapOsc.stop(t + 0.95);
    } catch (e) {
      console.error('Failed to trigger snap impact sound:', e);
    }

    // 3. Synthesize a cold, quiet deep-space ambient drone that fades in after the snap silence
    try {
      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0, t + 1.2);
      droneGain.gain.linearRampToValueAtTime(0.12, t + 3.8);
      droneGain.connect(this.ctx.destination);

      // Low frequency hum detuned for hollow isolation
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(55.0, t + 1.2); // A1

      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(82.4, t + 1.2); // E2 (Perfect fifth)

      const droneFilter = this.ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.setValueAtTime(90, t + 1.2);

      osc1.connect(droneFilter);
      osc2.connect(droneFilter);
      droneFilter.connect(droneGain);

      osc1.start(t + 1.2);
      osc2.start(t + 1.2);

      this.ambientNodes = [osc1, osc2, droneGain];
    } catch (e) {
      console.error('Failed to trigger deep-space ambience fade-in:', e);
    }
  }

  // Modulate drone sounds and trigger chimes dynamically based on SCN_05 scroll progress
  updateTransit(fraction: number) {
    if (!this.active || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Slowly evolve detuned frequencies of space drone to build tension
    if (this.ambientNodes.length >= 2) {
      const osc1 = this.ambientNodes[0];
      const osc2 = this.ambientNodes[1];
      if (osc1 instanceof OscillatorNode && osc2 instanceof OscillatorNode) {
        // Base frequency A1 detunes up slightly
        osc1.frequency.setTargetAtTime(55.0 + fraction * 6, t, 0.4);
        // Fifth detunes down slightly to create a slow beat-frequency wobble
        osc2.frequency.setTargetAtTime(82.4 - fraction * 4, t, 0.4);
      }
    }

    // Melodic progression chimes triggered at fixed percentages
    const thresholds = [
      { key: 0.15, freq: 220.0 }, // A3
      { key: 0.35, freq: 293.7 }, // D4
      { key: 0.55, freq: 329.6 }, // E4
      { key: 0.75, freq: 440.0 }, // A4
      { key: 0.90, freq: 523.3 }  // C5
    ];

    thresholds.forEach((th) => {
      if (fraction >= th.key && !this.triggeredNotes[th.key]) {
        this.triggeredNotes[th.key] = true;
        this.playChime(th.freq);
      } else if (fraction < th.key - 0.05 && this.triggeredNotes[th.key]) {
        // Reset if they scroll back up
        this.triggeredNotes[th.key] = false;
      }
    });
  }

  private playChime(freq: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const delay = this.ctx.createDelay();
      const feedback = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      // Small randomized detuning for rich natural acoustic resonance
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, t);
      filter.Q.setValueAtTime(1.2, t);

      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.045, t + 0.04); // soft attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 4.8); // long wash decay

      // Delay lines for deep space echo
      delay.delayTime.setValueAtTime(0.38, t);
      feedback.gain.setValueAtTime(0.42, t);

      osc.connect(filter);
      filter.connect(gainNode);
      
      // Echo routing
      gainNode.connect(this.ctx.destination);
      gainNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      feedback.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 5.2);
    } catch (e) {
      console.error('Failed to trigger chime synth:', e);
    }
  }

  stopAmbient() {
    this.ambientNodes.forEach((node) => {
      try {
        if (node instanceof OscillatorNode) {
          node.stop();
        } else if (node instanceof GainNode) {
          node.disconnect();
        }
      } catch (e) {}
    });
    this.ambientNodes = [];
  }

  stop() {
    if (!this.active) return;
    const t = this.ctx?.currentTime || 0;
    try {
      this.masterGain?.gain.setTargetAtTime(0, t, 0.08);
      this.stopAmbient();
      this.triggeredNotes = {};
    } catch (e) {}
  }
}

// Global helper to bypass TypeScript errors for AudioNodes connection inside try blocks
function gainNodeConnect(gain: GainNode, dest: AudioNode) {
  try {
    gain.connect(dest);
  } catch(e){}
}

// Single instance to share audio engine state
export const shepardToneSynth = new ShepardToneSynth();
