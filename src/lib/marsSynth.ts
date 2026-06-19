'use client';

const CHORDS = [
  [73.42, 110.00, 146.83, 174.61, 220.00, 293.66], // Dm (D2, A2, D3, F3, A3, D4)
  [58.27, 87.31, 116.54, 146.83, 174.61, 233.08],  // Bb (Bb1, F2, Bb2, D3, F3, Bb3)
  [43.65, 65.41, 87.31, 110.00, 130.81, 174.61],   // F (F1, C2, F2, A2, C3, F3)
  [55.00, 82.41, 110.00, 130.81, 164.81, 220.00]   // Am (A1, E2, A2, C3, E3, A3)
];

class MarsSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNotes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private active = false;
  private chordInterval: any = null;
  private chimeTimeout: any = null;
  private currentChord = 0;

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
      console.log('[GENESIS Audio Engine] Mars Synth initialized.');
    } catch (e) {
      console.error('[GENESIS Audio Engine] Mars Synth failed to initialize:', e);
    }
  }

  start() {
    this.init();
    if (!this.active || !this.ctx || !this.masterGain) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    // Fade in master volume
    const t = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0, t);
    this.masterGain.gain.linearRampToValueAtTime(0.65, t + 4.0); // slow cinematic fade-in
    
    // Start chord cycle
    this.currentChord = 0;
    this.playNextChord();
    this.chordInterval = setInterval(() => {
      this.playNextChord();
    }, 6000);
    
    // Start chime sequence
    this.scheduleChimes();
  }
  
  private playNextChord() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    // Fade out and stop previous active notes
    this.activeNotes.forEach((note) => {
      try {
        note.gain.gain.cancelScheduledValues(t);
        note.gain.gain.setValueAtTime(note.gain.gain.value, t);
        note.gain.gain.exponentialRampToValueAtTime(0.001, t + 3.0); // long overlap
        note.osc.stop(t + 3.1);
      } catch (e) {}
    });
    this.activeNotes = [];
    
    // Select chord
    const chordFrequencies = CHORDS[this.currentChord];
    this.currentChord = (this.currentChord + 1) % CHORDS.length;
    
    // Spawn new oscillators
    chordFrequencies.forEach((freq, index) => {
      if (!this.ctx || !this.masterGain) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      // Warm, soft waves (triangle)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      
      // Detune to make it wide and chorusy
      osc.detune.setValueAtTime((Math.random() - 0.5) * 15, t);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250 + Math.sin(t * 0.1) * 50, t); // slowly modulate cutoff
      filter.Q.setValueAtTime(1.0, t);
      
      // Slow attack
      gain.gain.setValueAtTime(0, t);
      const targetVolume = (index < 2 ? 0.08 : 0.04); // lower base notes slightly less loud, chord notes soft
      gain.gain.linearRampToValueAtTime(targetVolume, t + 2.5);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(t);
      this.activeNotes.push({ osc, gain });
    });
  }

  private scheduleChimes() {
    if (!this.active || !this.ctx) return;
    
    const nextTime = 3000 + Math.random() * 4000; // random interval between chimes
    this.chimeTimeout = setTimeout(() => {
      this.playChime();
      this.scheduleChimes();
    }, nextTime);
  }
  
  private playChime() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    // reflective melody notes: D4, F4, A4, G4, C5, A4, F4, D5
    const melodyNotes = [293.66, 349.23, 440.00, 392.00, 523.25, 440.00, 349.23, 587.33];
    const freq = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
    
    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const delay = this.ctx.createDelay();
      const feedback = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 5, t);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.Q.setValueAtTime(1.0, t);
      
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.035, t + 0.1); // soft attack
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 3.5); // long chime release
      
      delay.delayTime.setValueAtTime(0.45, t);
      feedback.gain.setValueAtTime(0.5, t);
      
      osc.connect(filter);
      filter.connect(gainNode);
      
      gainNode.connect(this.masterGain);
      gainNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      feedback.connect(this.masterGain);
      
      osc.start(t);
      osc.stop(t + 4.0);
    } catch (e) {}
  }
  
  update(scrollFraction: number) {
    if (!this.active || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    // As the user scrolls through SCN_06 (approachProgress 0.0 -> 1.0):
    // 1. Chords volume increases slightly
    // 2. During descent (scroll 0.88 -> 1.0), music dissolves into low atmospheric wind rumble
    if (scrollFraction < 0.88) {
      const vol = 0.65 + scrollFraction * 0.15; // 0.65 to 0.8
      this.masterGain.gain.setTargetAtTime(vol, t, 0.1);
    } else {
      // Fade out music
      const fadeFactor = 1.0 - (scrollFraction - 0.88) / 0.12; // 1.0 to 0.0
      this.masterGain.gain.setTargetAtTime(fadeFactor * 0.65, t, 0.05);
    }
  }

  stop() {
    if (!this.active) return;
    if (this.chordInterval) clearInterval(this.chordInterval);
    if (this.chimeTimeout) clearTimeout(this.chimeTimeout);
    
    const t = this.ctx?.currentTime || 0;
    if (this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(0, t + 1.0);
      } catch (e) {}
    }
    
    setTimeout(() => {
      this.activeNotes.forEach((note) => {
        try {
          note.osc.stop();
        } catch (e) {}
      });
      this.activeNotes = [];
      this.active = false;
    }, 1100);
  }
}

export const marsSynth = new MarsSynth();
