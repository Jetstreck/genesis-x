'use client';

import { useEffect, useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import useAudio from '@/hooks/useAudio';
import { shepardToneSynth } from '@/lib/shepardSynth';
import { marsSynth } from '@/lib/marsSynth';
import { footfallSynth } from '@/lib/footfallSynth';
import { rainSynth } from '@/lib/rainSynth';
import { awakeningSynth } from '@/lib/awakeningSynth';
import { lightsSynth } from '@/lib/lightsSynth';
import { reflectionSynth } from '@/lib/reflectionSynth';
import { loopSynth } from '@/lib/loopSynth';

export default function Overlay() {
  const [scrollY, setScrollY] = useState(0);
  const [scrollFraction, setScrollFraction] = useState(0);

  // Zustand Store parameters
  const currentScene = useStore((state) => state.currentScene);
  const setCurrentScene = useStore((state) => state.setCurrentScene);
  const hingePhase = useStore((state) => state.hingePhase);
  const setHingePhase = useStore((state) => state.setHingePhase);
  const dragProgress = useStore((state) => state.dragProgress);
  const setDragProgress = useStore((state) => state.setDragProgress);
  const transitProgress = useStore((state) => state.transitProgress);
  const setTransitProgress = useStore((state) => state.setTransitProgress);
  const approachProgress = useStore((state) => state.approachProgress);
  const setApproachProgress = useStore((state) => state.setApproachProgress);
  const footfallProgress = useStore((state) => state.footfallProgress);
  const setFootfallProgress = useStore((state) => state.setFootfallProgress);
  const rainProgress = useStore((state) => state.rainProgress);
  const setRainProgress = useStore((state) => state.setRainProgress);
  const awakeningProgress = useStore((state) => state.awakeningProgress);
  const setAwakeningProgress = useStore((state) => state.setAwakeningProgress);
  const lightsProgress = useStore((state) => state.lightsProgress);
  const setLightsProgress = useStore((state) => state.setLightsProgress);
  const reflectionProgress = useStore((state) => state.reflectionProgress);
  const setReflectionProgress = useStore((state) => state.setReflectionProgress);
  const setMousePosition = useStore((state) => state.setMousePosition);
  const loopProgress = useStore((state) => state.loopProgress);
  const setLoopProgress = useStore((state) => state.setLoopProgress);

  // Invoke default ambient audio system (manages SCN_02/SCN_03 phases)
  useAudio();

  // Y tracking parameters for manual drag tension
  const startDragY = useRef(0);
  const maxDragDistance = 240; // Pixels required to drag up to trigger breaking point
  const recoilIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manage window scroll locking based on scene state
  useEffect(() => {
    if (currentScene === 'SCN_04') {
      if (hingePhase !== 'idle') {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_05') {
      // Allow scroll in SCN_05 until they reach the absolute end (transitProgress = 1.0)
      if (transitProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_06') {
      // Allow scroll in SCN_06 until the descent completes (approachProgress = 1.0)
      if (approachProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_07') {
      // Allow scroll in SCN_07 until the scene ends (footfallProgress = 1.0)
      if (footfallProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_09') {
      // Allow scroll in SCN_09 until the scene ends (rainProgress = 1.0)
      if (rainProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_10') {
      // Allow scroll in SCN_10 until the scene ends (awakeningProgress = 1.0)
      if (awakeningProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_11') {
      // Allow scroll in SCN_11 until the scene ends (lightsProgress = 1.0)
      if (lightsProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_12') {
      // Allow scroll in SCN_12 until the scene ends (reflectionProgress = 1.0)
      if (reflectionProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else if (currentScene === 'SCN_13') {
      // Allow scroll in SCN_13 until the scene ends (loopProgress = 1.0)
      if (loopProgress >= 0.99) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [currentScene, hingePhase, transitProgress, approachProgress, footfallProgress, rainProgress, awakeningProgress, lightsProgress, reflectionProgress, loopProgress]);

  // Track page scroll to transition into SCN_04
  useEffect(() => {
    const handleScroll = () => {
      if (currentScene === 'SCN_04' || currentScene === 'SCN_05') return;
      
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      
      setScrollY(y);
      const fraction = limit > 0 ? y / limit : 0;
      setScrollFraction(fraction);

      // Transition to SCN_04 when scrolled to the very bottom
      if (fraction >= 0.995) {
        setCurrentScene('SCN_04');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial run

    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentScene, setCurrentScene]);

  // Track page scroll for SCN_05 Deep Space Transit
  useEffect(() => {
    if (currentScene !== 'SCN_05') return;

    // Reset scroll parameters to allow scrolling down again
    window.scrollTo(0, 0);
    setTransitProgress(0.0);

    const handleTransitScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setTransitProgress(boundedFraction);

      // Evolve synth sounds based on scroll progress (filters & chimes)
      shepardToneSynth.updateTransit(boundedFraction);
    };

    window.addEventListener('scroll', handleTransitScroll, { passive: true });
    handleTransitScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleTransitScroll);
    };
  }, [currentScene, setTransitProgress]);

  // Auto-transition from SCN_05 to SCN_06 when transit is complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_05' && transitProgress >= 0.99) {
      const timer = setTimeout(() => {
        // Stop SCN_05 deep space chimes and drone
        shepardToneSynth.stop();
        // Transition to SCN_06
        setCurrentScene('SCN_06');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentScene, transitProgress, setCurrentScene]);

  // Track page scroll for SCN_06 Mars Approach
  useEffect(() => {
    if (currentScene !== 'SCN_06') {
      marsSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to descend
    window.scrollTo(0, 0);
    setApproachProgress(0.0);
    
    // Start reflective emotional synth score
    marsSynth.start();

    const handleApproachScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setApproachProgress(boundedFraction);

      // Modulate Mars synth score based on scroll progress
      marsSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleApproachScroll, { passive: true });
    handleApproachScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleApproachScroll);
      marsSynth.stop();
    };
  }, [currentScene, setApproachProgress]);

  // Auto-transition from SCN_06 to SCN_07 when approach is complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_06' && approachProgress >= 0.99) {
      const timer = setTimeout(() => {
        // Stop SCN_06 synth
        marsSynth.stop();
        // Transition to SCN_07
        setCurrentScene('SCN_07');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentScene, approachProgress, setCurrentScene]);

  // Track page scroll for SCN_07 First Footfall
  useEffect(() => {
    if (currentScene !== 'SCN_07') {
      footfallSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to descend/step
    window.scrollTo(0, 0);
    setFootfallProgress(0.0);
    
    // Start spacesuit breathing sounds
    footfallSynth.start();

    const handleFootfallScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setFootfallProgress(boundedFraction);

      // Modulate footfall synth wind/master based on scroll progress
      footfallSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleFootfallScroll, { passive: true });
    handleFootfallScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleFootfallScroll);
      footfallSynth.stop();
    };
  }, [currentScene, setFootfallProgress]);

  // Auto-transition from SCN_07 to SCN_09 when footfall is complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_07' && footfallProgress >= 0.99) {
      const timer = setTimeout(() => {
        footfallSynth.stop();
        setCurrentScene('SCN_09');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentScene, footfallProgress, setCurrentScene]);

  // Track page scroll for SCN_09 The First Rain
  useEffect(() => {
    if (currentScene !== 'SCN_09') {
      rainSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to rain
    window.scrollTo(0, 0);
    setRainProgress(0.0);
    
    // Start procedural rain synthesizer
    rainSynth.start();

    const handleRainScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setRainProgress(boundedFraction);

      // Modulate sound based on scroll progress
      rainSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleRainScroll, { passive: true });
    handleRainScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleRainScroll);
      rainSynth.stop();
    };
  }, [currentScene, setRainProgress]);

  // Auto-transition from SCN_09 to SCN_10 when rain is complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_09' && rainProgress >= 0.99) {
      const timer = setTimeout(() => {
        rainSynth.stop();
        setCurrentScene('SCN_10');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentScene, rainProgress, setCurrentScene]);

  // Track page scroll for SCN_10 Azure Awakening
  useEffect(() => {
    if (currentScene !== 'SCN_10') {
      awakeningSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to terraform
    window.scrollTo(0, 0);
    setAwakeningProgress(0.0);
    
    // Start procedural orchestral synthesizer
    awakeningSynth.start();

    const handleAwakeningScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setAwakeningProgress(boundedFraction);

      // Modulate sound based on scroll progress
      awakeningSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleAwakeningScroll, { passive: true });
    handleAwakeningScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleAwakeningScroll);
      awakeningSynth.stop();
    };
  }, [currentScene, setAwakeningProgress]);

  // Auto-transition from SCN_10 to SCN_11 when awakening is complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_10' && awakeningProgress >= 0.99) {
      const timer = setTimeout(() => {
        awakeningSynth.stop();
        setCurrentScene('SCN_11');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScene, awakeningProgress, setCurrentScene]);

  // Track page scroll for SCN_11 First Lights
  useEffect(() => {
    if (currentScene !== 'SCN_11') {
      lightsSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to light cities
    window.scrollTo(0, 0);
    setLightsProgress(0.0);
    
    // Start procedural piano/lights synthesizer
    lightsSynth.start();

    const handleLightsScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setLightsProgress(boundedFraction);

      // Modulate sound based on scroll progress
      lightsSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleLightsScroll, { passive: true });
    handleLightsScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleLightsScroll);
      lightsSynth.stop();
    };
  }, [currentScene, setLightsProgress]);

  // Auto-transition from SCN_11 to SCN_12 when lights are complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_11' && lightsProgress >= 0.99) {
      const timer = setTimeout(() => {
        lightsSynth.stop();
        setCurrentScene('SCN_12');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScene, lightsProgress, setCurrentScene]);

  // Track page scroll for SCN_12 Twin Reflection
  useEffect(() => {
    if (currentScene !== 'SCN_12') {
      reflectionSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to reflect
    window.scrollTo(0, 0);
    setReflectionProgress(0.0);
    
    // Start procedural reflection synthesizer
    reflectionSynth.start();

    const handleReflectionScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setReflectionProgress(boundedFraction);

      // Modulate sound based on scroll progress
      reflectionSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleReflectionScroll, { passive: true });
    handleReflectionScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleReflectionScroll);
      reflectionSynth.stop();
    };
  }, [currentScene, setReflectionProgress]);

  // Auto-transition from SCN_12 to SCN_13 when reflection is complete (at black screen)
  useEffect(() => {
    if (currentScene === 'SCN_12' && reflectionProgress >= 0.99) {
      const timer = setTimeout(() => {
        reflectionSynth.stop();
        setCurrentScene('SCN_13');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScene, reflectionProgress, setCurrentScene]);

  // Track page scroll for SCN_13 The Loop
  useEffect(() => {
    if (currentScene !== 'SCN_13') {
      loopSynth.stop();
      return;
    }

    // Reset page scroll to top so they can scroll down to loop
    window.scrollTo(0, 0);
    setLoopProgress(0.0);
    
    // Start procedural loop synthesizer
    loopSynth.start();

    const handleLoopScroll = () => {
      const y = window.scrollY;
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      const fraction = limit > 0 ? y / limit : 0;
      
      const boundedFraction = Math.min(1.0, fraction);
      setLoopProgress(boundedFraction);

      // Modulate sound based on scroll progress
      loopSynth.update(boundedFraction);
    };

    window.addEventListener('scroll', handleLoopScroll, { passive: true });
    handleLoopScroll(); // Run immediately

    return () => {
      window.removeEventListener('scroll', handleLoopScroll);
      loopSynth.stop();
    };
  }, [currentScene, setLoopProgress]);

  // Track mouse coordinates for SCN_12 synchronized rotation
  useEffect(() => {
    if (currentScene !== 'SCN_12') return;

    const handlePointerMove = (e: MouseEvent) => {
      // Normalize to -1.0 to 1.0 range
      const x = (e.clientX / window.innerWidth) * 2.0 - 1.0;
      const y = (e.clientY / window.innerHeight) * 2.0 - 1.0;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handlePointerMove);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
    };
  }, [currentScene, setMousePosition]);

  // Gesture down: Capture pointer and prepare tension audio
  const handlePointerDown = (e: React.PointerEvent) => {
    if (currentScene !== 'SCN_04' || hingePhase !== 'idle') return;

    if (recoilIntervalRef.current) {
      clearInterval(recoilIntervalRef.current);
    }

    const container = e.currentTarget as HTMLElement;
    container.setPointerCapture(e.pointerId);

    setHingePhase('dragging');
    startDragY.current = e.clientY;
    
    // Initialize synthesized audio
    shepardToneSynth.init();
    shepardToneSynth.update(0);
  };

  // Gesture move: Translate Z coordinates and synthesize pitch/volume curves
  const handlePointerMove = (e: React.PointerEvent) => {
    if (hingePhase !== 'dragging') return;

    // Standardize pulling upwards (starting Y coordinate is higher on-screen than current cursor Y)
    const diffY = startDragY.current - e.clientY;
    const progress = Math.max(0, Math.min(1.0, diffY / maxDragDistance));
    
    setDragProgress(progress);
    shepardToneSynth.update(progress);

    // Enter maximum tension state (The Breaking Point)
    if (progress >= 1.0) {
      setHingePhase('holding');
      setDragProgress(1.0);
      shepardToneSynth.update(1.0);
    }
  };

  // Gesture release: Trigger warp speed snap or smooth recoil/spring-back
  const handlePointerUp = (e: React.PointerEvent) => {
    if (currentScene !== 'SCN_04') return;
    
    const container = e.currentTarget as HTMLElement;
    try {
      container.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (hingePhase === 'dragging') {
      // Revert drag if let go early (feels like tension rubber band)
      setHingePhase('idle');
      
      let currentProg = dragProgress;
      recoilIntervalRef.current = setInterval(() => {
        currentProg -= 0.08;
        if (currentProg <= 0.0) {
          currentProg = 0.0;
          if (recoilIntervalRef.current) clearInterval(recoilIntervalRef.current);
          shepardToneSynth.stop();
        } else {
          shepardToneSynth.update(currentProg);
        }
        setDragProgress(currentProg);
      }, 16);
    } else if (hingePhase === 'holding') {
      // Release at peak tension: Trigger warp acceleration (The Snap)
      setHingePhase('snapped');
      setDragProgress(0.0);
      shepardToneSynth.triggerSnap();
    }
  };

  const isVacuumScene = scrollFraction >= 0.50;

  // SCN_02 HUD elements opacities
  const scrollIndicatorOpacity = !isVacuumScene ? Math.max(0, 1 - scrollY / 120) : 0;
  const logoOpacity = !isVacuumScene ? Math.max(0.3, 1 - scrollY / 300) : 0;

  // SCN_03 HUD overlay opacity
  const vacuumOpacity = isVacuumScene && currentScene === 'SCN_03'
    ? Math.min(0.45, (scrollFraction - 0.50) * 10)
    : 0;

  // Dynamic cinematic overlay for transitions
  let overlayColor = '#000000';
  let overlayOpacity = 0.0;

  if (currentScene === 'SCN_05') {
    if (transitProgress > 0.90) {
      overlayOpacity = Math.min(1.0, (transitProgress - 0.90) * 10.0);
    }
  } else if (currentScene === 'SCN_06') {
    if (approachProgress < 0.15) {
      // Fade out from black at the beginning of the scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (approachProgress / 0.15);
    } else if (approachProgress > 0.88) {
      // Atmospheric entry: fade to dusty rust red, then to pure black before touchdown
      const t = (approachProgress - 0.88) / 0.12; // 0.0 to 1.0
      if (t < 0.75) {
        const subT = t / 0.75;
        overlayColor = '#3c180e'; // Dusty martian atmosphere friction color
        overlayOpacity = subT * 0.95;
      } else {
        const subT = (t - 0.75) / 0.25;
        overlayColor = '#000000';
        overlayOpacity = 0.95 + subT * 0.05;
      }
    }
  } else if (currentScene === 'SCN_07') {
    if (footfallProgress < 0.15) {
      // Fade out from black at the beginning of the landing scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (footfallProgress / 0.15);
    } else if (footfallProgress > 0.90) {
      // Fade to black at transition out
      overlayColor = '#000000';
      overlayOpacity = Math.min(1.0, (footfallProgress - 0.90) * 10.0);
    }
  } else if (currentScene === 'SCN_09') {
    if (rainProgress < 0.15) {
      // Fade out from black at start of rain scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (rainProgress / 0.15);
    } else if (rainProgress > 0.90) {
      // Fade to black at end of scene
      overlayColor = '#000000';
      overlayOpacity = Math.min(1.0, (rainProgress - 0.90) * 10.0);
    }
  } else if (currentScene === 'SCN_10') {
    if (awakeningProgress < 0.15) {
      // Fade out from black at start of awakening scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (awakeningProgress / 0.15);
    } else if (awakeningProgress > 0.94) {
      // Fade to black at end of scene (civilization lights hold)
      overlayColor = '#000000';
      overlayOpacity = Math.min(1.0, (awakeningProgress - 0.94) * 20.0);
    }
  } else if (currentScene === 'SCN_11') {
    if (lightsProgress < 0.15) {
      // Fade out from black at start of first lights scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (lightsProgress / 0.15);
    } else if (lightsProgress > 0.92) {
      // Fade to black at end of scene (telemetry beacons hold)
      overlayColor = '#000000';
      overlayOpacity = Math.min(1.0, (lightsProgress - 0.92) * 15.0);
    }
  } else if (currentScene === 'SCN_12') {
    if (reflectionProgress < 0.15) {
      // Fade out from black at start of reflection scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (reflectionProgress / 0.15);
    } else if (reflectionProgress > 0.95) {
      // Fade to black at end of scene
      overlayColor = '#000000';
      overlayOpacity = Math.min(1.0, (reflectionProgress - 0.95) * 20.0);
    }
  } else if (currentScene === 'SCN_13') {
    if (loopProgress < 0.15) {
      // Fade out from black at start of loop scene
      overlayColor = '#000000';
      overlayOpacity = 1.0 - (loopProgress / 0.15);
    } else if (loopProgress >= 0.77 && loopProgress <= 0.84) {
      // Stage 5 descent: White light dissolve
      overlayColor = '#ffffff';
      overlayOpacity = (loopProgress - 0.77) / 0.04;
    } else if (loopProgress > 0.84 && loopProgress < 0.90) {
      // Stage 6 reveal: White out fades to reveal eye
      overlayColor = '#ffffff';
      overlayOpacity = 1.0 - (loopProgress - 0.84) / 0.05;
    } else if (loopProgress > 0.96) {
      // Climax fade out to black
      overlayColor = '#000000';
      overlayOpacity = Math.min(1.0, (loopProgress - 0.96) * 25.0);
    }
  }

  return (
    <div 
      className={`hud-overlay ${currentScene === 'SCN_04' ? 'hinge-active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ pointerEvents: currentScene === 'SCN_04' ? 'auto' : 'none' }}
    >
      {/* Dynamic cinematic color overlay for transition fades and atmospheric entry */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: overlayColor,
          zIndex: 100,
          pointerEvents: 'none',
          opacity: overlayOpacity,
          transition: 'opacity 0.05s ease-out, background-color 0.1s ease-out'
        }}
      />

      <div className="scanlines" />
      <div className="ambient-vignette" />

      {/* SCN_02 HUD */}
      {currentScene === 'SCN_02' && (
        <>
          <header className="hud-header" style={{ opacity: logoOpacity, transition: 'opacity 0.3s ease-out' }}>
            <div className="brand-section">
              <h1 className="brand-logo">
                Genesis <span>V3</span>
              </h1>
              <span className="brand-tagline">SCN_02 — DEPARTURE CORRIDOR</span>
            </div>
          </header>

          <div className="journey-tracker-container" style={{ transition: 'opacity 0.3s ease-out' }}>
            <div className="journey-tracker-label">DEPARTURE PROGRESS</div>
            <div className="journey-tracker-track">
              <div className="journey-tracker-fill" style={{ height: `${scrollFraction * 200}%` }} />
            </div>
            <div className="journey-tracker-percentage">
              {Math.min(100, Math.round(scrollFraction * 200))}<span className="percent-char">%</span>
            </div>
          </div>

          <div
            className="scroll-indicator-container"
            style={{
              opacity: scrollIndicatorOpacity,
              transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
              transform: `translateX(-50%) translateY(${scrollY * 0.15}px)`,
              pointerEvents: 'none',
            }}
          >
            <span className="scroll-text">Scroll to Begin</span>
            <div className="scroll-chevron-wrapper">
              <div className="scroll-chevron" />
              <div className="scroll-chevron" />
              <div className="scroll-chevron" />
            </div>
          </div>
        </>
      )}

      {/* SCN_03 HUD */}
      {currentScene === 'SCN_03' && (
        <div 
          className="vacuum-overlay"
          style={{
            opacity: vacuumOpacity,
            transition: 'opacity 0.4s ease-out',
            pointerEvents: 'none',
          }}
        >
          <div className="vacuum-title">SCN_03 — ACOUSTIC VACUUM</div>
        </div>
      )}

      {/* SCN_04 HUD: THE HINGE INTERACTION INTERFACE */}
      {currentScene === 'SCN_04' && (
        <div className="hinge-hud-layer">
          <div className="hinge-scene-label">SCN_04 — THE HINGE</div>

          {/* Minimal Instruction Prompt */}
          {hingePhase !== 'snapped' && (
            <div className="hinge-prompt-container" style={{ opacity: 1 - dragProgress * 0.4 }}>
              <div className={`hinge-prompt-text ${hingePhase === 'holding' ? 'holding' : 'pulsing'}`}>
                {hingePhase === 'holding' ? 'Release to Commit' : 'Continue'}
              </div>
              <div className="hinge-prompt-subtext">
                {hingePhase === 'holding' 
                  ? 'THRESHOLD REACHED — CONFIRM DISENGAGEMENT' 
                  : hingePhase === 'dragging' 
                    ? 'PULLING FORWARD...' 
                    : 'CLICK & DRAG UPWARD TO BREAK ORBIT'}
              </div>
              
              {/* Drag indicator bar showing progress visual feedback */}
              {dragProgress > 0 && (
                <div className="hinge-drag-bar-container">
                  <div className="hinge-drag-bar-fill" style={{ width: `${dragProgress * 100}%` }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SCN_05 HUD: MINIMALIST INTERPLANETARY TRANSIT */}
      {currentScene === 'SCN_05' && (
        <div className="transit-hud-layer">
          <div className="transit-scene-label">SCN_05 — THE RED SIGNAL</div>
        </div>
      )}

      {/* SCN_06 HUD: MINIMALIST MARS APPROACH */}
      {currentScene === 'SCN_06' && (
        <div 
          className="approach-hud-layer" 
          style={{ 
            opacity: approachProgress > 0.12 && approachProgress < 0.88 ? 1.0 : 0.0, 
            transition: 'opacity 0.8s ease-in-out' 
          }}
        >
          <div className="approach-scene-label">SCN_06 — MARS APPROACH</div>
        </div>
      )}

      {/* SCN_07 HUD: MINIMALIST FIRST FOOTFALL */}
      {currentScene === 'SCN_07' && (
        <div 
          className="footfall-hud-layer" 
          style={{ 
            opacity: footfallProgress > 0.15 && footfallProgress < 0.88 ? 1.0 : 0.0, 
            transition: 'opacity 0.8s ease-in-out' 
          }}
        >
          <div className="footfall-scene-label">SCN_07 — FIRST FOOTFALL</div>
        </div>
      )}

      {/* SCN_09 HUD: MINIMALIST THE FIRST RAIN */}
      {currentScene === 'SCN_09' && (
        <div 
          className="rain-hud-layer" 
          style={{ 
            opacity: rainProgress > 0.12 && rainProgress < 0.88 ? 1.0 : 0.0, 
            transition: 'opacity 0.8s ease-in-out' 
          }}
        >
          <div className="rain-scene-label">SCN_09 — THE FIRST RAIN</div>
        </div>
      )}

      {/* SCN_10 HUD: MINIMALIST AZURE AWAKENING */}
      {currentScene === 'SCN_10' && (
        <div 
          className="awakening-hud-layer" 
          style={{ 
            opacity: awakeningProgress > 0.12 && awakeningProgress < 0.93 ? 1.0 : 0.0, 
            transition: 'opacity 0.8s ease-in-out' 
          }}
        >
          <div className="awakening-scene-label">SCN_10 — AZURE AWAKENING</div>
        </div>
      )}

      {/* SCN_11 HUD: MINIMALIST FIRST LIGHTS */}
      {currentScene === 'SCN_11' && (
        <div 
          className="lights-hud-layer" 
          style={{ 
            opacity: lightsProgress > 0.12 && lightsProgress < 0.90 ? 1.0 : 0.0, 
            transition: 'opacity 0.8s ease-in-out' 
          }}
        >
          <div className="lights-scene-label">SCN_11 — FIRST LIGHTS</div>
        </div>
      )}

      {/* SCN_12 HUD: MINIMALIST TWIN REFLECTION */}
      {currentScene === 'SCN_12' && (
        <>
          <div 
            className="reflection-hud-layer" 
            style={{ 
              opacity: reflectionProgress > 0.12 && reflectionProgress < 0.98 ? 1.0 : 0.0, 
              transition: 'opacity 0.8s ease-in-out' 
            }}
          >
            <div className="reflection-scene-label">SCN_12 — TWIN REFLECTION</div>
          </div>

          {/* SCN_12 Subtitle Dialogues */}
          <div className="climax-subtitles-container">
            {/* Quote 1: 68% to 98% scroll */}
            <div className={`climax-subtitle-text ${reflectionProgress >= 0.68 && reflectionProgress < 0.98 ? 'visible' : ''}`}>
              We began as wanderers.<br />
              We looked at the sky and saw a destination.<br />
              Now, we look at the sky and see home.
            </div>
          </div>
        </>
      )}

      {/* SCN_13 HUD: THE LOOP */}
      {currentScene === 'SCN_13' && (
        <>
          {/* Subtle text thought fragments (Stage 3) */}
          <div className="climax-subtitles-container">
            {/* Thought 1: 28% to 42% scroll */}
            <div className={`climax-subtitle-text ${loopProgress >= 0.26 && loopProgress < 0.43 ? 'visible' : ''}`}>
              How many worlds remain unseen?
            </div>

            {/* Thought 2: 45% to 58% scroll */}
            <div className={`climax-subtitle-text ${loopProgress >= 0.45 && loopProgress < 0.62 ? 'visible' : ''}`}>
              What becomes of a species that no longer fears distance?
            </div>

            {/* Thought 3: 64% to 75% scroll */}
            <div className={`climax-subtitle-text ${loopProgress >= 0.64 && loopProgress < 0.77 ? 'visible' : ''}`}>
              What waits beyond the next horizon?
            </div>

            {/* Final Title Card: 90% onwards */}
            <div className={`climax-subtitle-text ${loopProgress >= 0.90 ? 'visible' : ''}`} style={{ fontSize: '3.0rem', letterSpacing: '0.5em', fontWeight: 300, transition: 'opacity 2.5s ease-in-out, transform 2.5s ease-in-out' }}>
              GENESIS
            </div>

            {/* Restart Button: 95% onwards */}
            <button 
              className={`restart-btn ${loopProgress >= 0.94 ? 'visible' : ''}`}
              onClick={() => {
                window.location.reload();
              }}
            >
              Restart Journey
            </button>
          </div>
        </>
      )}
    </div>
  );
}
