'use client';

import { useEffect, useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import useAudio from '@/hooks/useAudio';
import { shepardToneSynth } from '@/lib/shepardSynth';
import { marsSynth } from '@/lib/marsSynth';
import { footfallSynth } from '@/lib/footfallSynth';

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
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [currentScene, hingePhase, transitProgress, approachProgress, footfallProgress]);

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
    </div>
  );
}
