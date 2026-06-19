'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export default function useAudio() {
  const { audioState, setAudioState, currentScene } = useStore();

  useEffect(() => {
    const handleScroll = () => {
      if (currentScene !== 'SCN_02' && currentScene !== 'SCN_03') return;
      
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      
      const scrollFraction = window.scrollY / scrollHeight;

      // Map scroll progress to cinematic audio states:
      // - SCN_02 (0% to 50% scroll): 'ambience' (atmospheric wind + space sub-drone)
      // - Vacuum Event (50% to 53% scroll): 'vacuum-drop' (THE HARD CUT - Instant silence/zero audio)
      // - SCN_03 (53% to 100% scroll): 'vacuum' (Isolation: spacesuit breathing, distant heartbeat, faint electrical hum)
      if (scrollFraction < 0.50) {
        if (audioState !== 'ambience') setAudioState('ambience');
      } else if (scrollFraction < 0.53) {
        if (audioState !== 'vacuum-drop') setAudioState('vacuum-drop');
      } else {
        if (audioState !== 'vacuum') setAudioState('vacuum');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Run on mount

    return () => window.removeEventListener('scroll', handleScroll);
  }, [audioState, setAudioState, currentScene]);

  useEffect(() => {
    // =========================================================================
    // AUDIO ENGINE ARCHITECTURE PLACEHOLDER
    // =========================================================================
    // Developers can instantiate Web Audio API or HTML5 Audio nodes here:
    //
    // const ambientDrone = new Audio('/audio/deep_space_drone.mp3');
    // const windAmbience = new Audio('/audio/stratosphere_wind.mp3');
    // const suitBreathing = new Audio('/audio/astronaut_breathing.mp3');
    // const heartbeat = new Audio('/audio/heartbeat_slow.mp3');
    //
    // On state changes, coordinate the transition properties:
    //
    // switch (audioState) {
    //   case 'ambience':
    //     // Full atmospheric presence
    //     fade(windAmbience, 1.0, 1.0); // (audio, volume, duration)
    //     fade(ambientDrone, 0.7, 1.0);
    //     suitBreathing.pause();
    //     heartbeat.pause();
    //     break;
    //   case 'vacuum-drop':
    //     // THE VACUUM EVENT: HARD CUT
    //     // All music and wind cut instantly (0.0s fade - pure silence)
    //     windAmbience.volume = 0.0;
    //     ambientDrone.volume = 0.0;
    //     windAmbience.pause();
    //     ambientDrone.pause();
    //     suitBreathing.pause();
    //     heartbeat.pause();
    //     break;
    //   case 'vacuum':
    //     // ISOLATION STATE
    //     // Play only internal suit sounds
    //     suitBreathing.loop = true;
    //     heartbeat.loop = true;
    //     suitBreathing.volume = 0.45;
    //     heartbeat.volume = 0.35;
    //     suitBreathing.play();
    //     heartbeat.play();
    //     break;
    // }
    // =========================================================================
    
    console.log(`[GENESIS Audio Engine] State transitioned to: ${audioState.toUpperCase()}`);
  }, [audioState]);
}
