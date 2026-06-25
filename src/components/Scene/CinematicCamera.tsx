'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

gsap.registerPlugin(ScrollTrigger);

const SCN06_KEYFRAMES = [
  { p: 0.0,  pos: [0.0, 56.0, -1142.0] as [number, number, number], target: [0.0, 52.0, -1200.0] as [number, number, number] }, // Stage 1 Start: Curved red horizon tangent
  { p: 0.25, pos: [0.0, 72.0, -1125.0] as [number, number, number], target: [0.0, 40.0, -1200.0] as [number, number, number] }, // Stage 1 End / Stage 2 Start: Curvature expands
  { p: 0.50, pos: [0.0, 95.0, -1070.0] as [number, number, number], target: [0.0, 10.0, -1200.0] as [number, number, number] }, // Stage 2 End / Stage 3 Start: Large portion of Mars
  { p: 0.75, pos: [0.0, 20.0, -980.0] as [number, number, number],  target: [0.0, 0.0, -1200.0] as [number, number, number] },  // Stage 3 End / Stage 4 Start: Silhouette dominates
  { p: 0.90, pos: [0.0, 0.0, -950.0] as [number, number, number],   target: [0.0, 0.0, -1200.0] as [number, number, number] },  // Stage 4 Hold
  { p: 1.0,  pos: [0.0, 15.0, -1141.5] as [number, number, number],  target: [0.0, 10.0, -1200.0] as [number, number, number] }  // Transition Out: Plunge descent
];

function interpolateKeyframes(p: number) {
  for (let i = 0; i < SCN06_KEYFRAMES.length - 1; i++) {
    const k1 = SCN06_KEYFRAMES[i];
    const k2 = SCN06_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN06_KEYFRAMES[SCN06_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

const SCN07_KEYFRAMES = [
  { p: 0.0,  pos: [0.0, 10.0, 2.0] as [number, number, number],  target: [0.0, 0.0, -0.4] as [number, number, number] },  // Stage 1 Start: Descent high above
  { p: 0.20, pos: [0.0, 0.45, 1.2] as [number, number, number],  target: [0.0, 0.0, -0.4] as [number, number, number] },  // Stage 1 End / Stage 2 Start: Landing pause
  { p: 0.35, pos: [0.0, 0.45, 1.2] as [number, number, number],  target: [0.0, 0.0, -0.4] as [number, number, number] },  // Stage 2 End / Stage 3 Start: Boot stepping close-up
  { p: 0.70, pos: [0.0, 0.45, 1.2] as [number, number, number],  target: [0.0, 0.0, -0.4] as [number, number, number] },  // Stage 3 End / Stage 4 Start: Camera tilt-up sky pivot
  { p: 0.90, pos: [0.0, 0.50, 0.8] as [number, number, number],  target: [3.0, 4.0, -8.0] as [number, number, number] },  // Stage 4 End / Stage 5 Start: Looking back at Earth sky star
  { p: 1.0,  pos: [0.0, 2.5, 2.0] as [number, number, number],   target: [0.0, 0.5, -15.0] as [number, number, number] } // Stage 5 End: Rise camera and look to valley
];

function interpolateKeyframes07(p: number) {
  for (let i = 0; i < SCN07_KEYFRAMES.length - 1; i++) {
    const k1 = SCN07_KEYFRAMES[i];
    const k2 = SCN07_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN07_KEYFRAMES[SCN07_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

const SCN09_KEYFRAMES = [
  { p: 0.0,  pos: [0.0, 0.25, 0.6] as [number, number, number],   target: [0.0, 0.2, -0.6] as [number, number, number] },    // Stage 1 Start: Low horizon, seed in frame
  { p: 0.25, pos: [0.0, 0.3, 0.5] as [number, number, number],    target: [0.05, 0.15, -0.3] as [number, number, number] },  // Stage 1 End / Stage 2 Start: Sky builds, clouds appear
  { p: 0.45, pos: [0.13, 0.18, -0.06] as [number, number, number], target: [0.2, 0.08, -0.2] as [number, number, number] },   // Stage 2 End / Stage 3 Start: Extreme zoom to rock
  { p: 0.55, pos: [0.13, 0.18, -0.06] as [number, number, number], target: [0.2, 0.08, -0.2] as [number, number, number] },   // Stage 3 Hold: First droplet forms & impacts
  { p: 0.80, pos: [-0.25, 0.28, 0.15] as [number, number, number],  target: [0.0, 0.02, -0.3] as [number, number, number] },  // Stage 4: Rainfall details, panning wet soil
  { p: 0.96, pos: [0.0, 14.0, 6.0] as [number, number, number],     target: [0.0, 0.5, -12.0] as [number, number, number] },  // Stage 5 End: High rise to show rivers & storms
  { p: 1.0,  pos: [0.0, 16.0, 5.0] as [number, number, number],     target: [0.0, 0.5, -18.0] as [number, number, number] }   // Fade out hold
];

function interpolateKeyframes09(p: number) {
  for (let i = 0; i < SCN09_KEYFRAMES.length - 1; i++) {
    const k1 = SCN09_KEYFRAMES[i];
    const k2 = SCN09_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN09_KEYFRAMES[SCN09_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

const SCN10_KEYFRAMES = [
  { p: 0.0,  pos: [0.0, 0.25, 0.6] as [number, number, number],    target: [0.0, 0.05, -0.4] as [number, number, number] },    // Stage 1 Start: Near the ground, sprout is green
  { p: 0.20, pos: [0.1, 0.28, 0.3] as [number, number, number],    target: [0.1, 0.05, -0.4] as [number, number, number] },    // Stage 1 End / Stage 2 Start: Rivers form, grass spreads
  { p: 0.40, pos: [-0.2, 0.35, 0.2] as [number, number, number],   target: [0.0, 0.05, -0.3] as [number, number, number] },    // Stage 2 End / Stage 3 Start: Grass spreads to hills
  { p: 0.60, pos: [0.2, 0.4, 0.1] as [number, number, number],     target: [-0.1, 0.05, -0.5] as [number, number, number] },   // Stage 3 End / Stage 4 Start: Forests appear, sky blue
  { p: 0.72, pos: [0.0, 1.0, -0.1] as [number, number, number],     target: [0.0, 0.05, -0.8] as [number, number, number] },   // Stage 4 End / Stage 5 Start: Lift-off initiates
  { p: 0.88, pos: [0.0, 56.0, -1142.0] as [number, number, number], target: [0.0, 48.0, -1200.0] as [number, number, number] },  // Stage 5 End: Reaching planet curvature high altitude
  { p: 0.95, pos: [0.0, 10.0, -950.0] as [number, number, number],  target: [0.0, 0.0, -1200.0] as [number, number, number] },  // Hero Shot: Glowing blue-green Mars in space
  { p: 1.0,  pos: [0.0, 5.0, -940.0] as [number, number, number],   target: [0.0, 0.0, -1200.0] as [number, number, number] }   // Transition Out: Slow orbital pivot, civ lights twinkle
];

function interpolateKeyframes10(p: number) {
  for (let i = 0; i < SCN10_KEYFRAMES.length - 1; i++) {
    const k1 = SCN10_KEYFRAMES[i];
    const k2 = SCN10_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN10_KEYFRAMES[SCN10_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

const SCN11_KEYFRAMES = [
  { p: 0.0,  pos: [0.0, 5.0, -940.0] as [number, number, number],   target: [0.0, 0.0, -1200.0] as [number, number, number] },    // Stage 1 Start: Orbital view, same as SCN_10 end
  { p: 0.25, pos: [-0.3, 4.8, -942.0] as [number, number, number],  target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 1 End / Stage 2 Start: Sun sets, dusk begins
  { p: 0.50, pos: [-0.6, 4.6, -944.0] as [number, number, number],  target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 2 End / Stage 3 Start: Dark night, first city light
  { p: 0.75, pos: [-0.8, 4.5, -946.0] as [number, number, number],  target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 3 End / Stage 4 Start: Multiple city clusters grow
  { p: 0.90, pos: [-0.9, 4.5, -948.0] as [number, number, number],  target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 4 End / Stage 5 Start: Network grid connects
  { p: 0.98, pos: [-1.2, 5.2, -942.0] as [number, number, number],  target: [8.5, 2.5, -1200.0] as [number, number, number] },   // Stage 5 End / Stage 6 Start: Pan camera to reveal Earth
  { p: 1.0,  pos: [-1.2, 5.2, -942.0] as [number, number, number],  target: [8.5, 2.5, -1200.0] as [number, number, number] }    // Hero: Mars and Earth together in space, fade out
];

function interpolateKeyframes11(p: number) {
  for (let i = 0; i < SCN11_KEYFRAMES.length - 1; i++) {
    const k1 = SCN11_KEYFRAMES[i];
    const k2 = SCN11_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN11_KEYFRAMES[SCN11_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

const SCN12_KEYFRAMES = [
  { p: 0.0,  pos: [-14.5, 1.2, -1140.0] as [number, number, number], target: [-25.0, 0.0, -1200.0] as [number, number, number] }, // Stage 1 Start: Close to Mars
  { p: 0.20, pos: [-13.0, 1.0, -1130.0] as [number, number, number], target: [-25.0, 0.0, -1200.0] as [number, number, number] }, // Stage 1 End / Stage 2 Start: Drift back
  { p: 0.45, pos: [0.0, 0.0, -1115.0] as [number, number, number],    target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 2 End / Stage 3 Start: Symmetrical balance
  { p: 0.60, pos: [0.0, 0.0, -1115.0] as [number, number, number],    target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 3 Hold: Reveal composition
  { p: 0.80, pos: [0.0, 0.0, -1115.0] as [number, number, number],    target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 4 Hold: Synchronized rotation
  { p: 0.95, pos: [0.0, 0.0, -1115.0] as [number, number, number],    target: [0.0, 0.0, -1200.0] as [number, number, number] },   // Stage 5 Hold: Metaphorical filaments
  { p: 1.0,  pos: [0.0, 0.0, -1222.0] as [number, number, number],    target: [0.0, 0.0, -1250.0] as [number, number, number] }    // Transition Out: Zoom past planets into deep space
];

function interpolateKeyframes12(p: number) {
  for (let i = 0; i < SCN12_KEYFRAMES.length - 1; i++) {
    const k1 = SCN12_KEYFRAMES[i];
    const k2 = SCN12_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN12_KEYFRAMES[SCN12_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

const SCN13_KEYFRAMES = [
  { p: 0.0,  pos: [0.0, 0.0, -1120.0] as [number, number, number],    target: [0.0, 0.0, -1200.0] as [number, number, number] }, // Stage 1 Start: Centered
  { p: 0.22, pos: [0.0, 0.0, -950.0] as [number, number, number],     target: [0.0, 0.0, -1200.0] as [number, number, number] },  // Stage 1 End / Stage 2 Start: Drift back, planets fade
  { p: 0.45, pos: [0.0, 2.0, -850.0] as [number, number, number],     target: [12.0, 8.0, -1300.0] as [number, number, number] }, // Stage 2 End / Stage 4 Start: Cosmic ocean drift
  { p: 0.70, pos: [0.0, 0.0, -450.0] as [number, number, number],     target: [0.0, 0.0, -500.0] as [number, number, number] },   // Stage 4 End / Stage 5 Start: Star approach
  { p: 0.83, pos: [0.0, 0.0, -499.5] as [number, number, number],     target: [0.0, 0.0, -500.0] as [number, number, number] },   // Stage 5 End / Stage 6 Start: Plunge into star center
  { p: 0.86, pos: [0.0, 0.0, -95.0] as [number, number, number],      target: [0.0, 0.0, -100.0] as [number, number, number] },    // Stage 6 Reveal: Close up iris reveal
  { p: 1.0,  pos: [0.0, 0.0, -78.0] as [number, number, number],      target: [0.0, 0.0, -100.0] as [number, number, number] }    // Climax hold & pullback
];

function interpolateKeyframes13(p: number) {
  for (let i = 0; i < SCN13_KEYFRAMES.length - 1; i++) {
    const k1 = SCN13_KEYFRAMES[i];
    const k2 = SCN13_KEYFRAMES[i+1];
    if (p >= k1.p && p <= k2.p) {
      const t = (p - k1.p) / (k2.p - k1.p);
      const easeT = t * t * (3.0 - 2.0 * t);
      
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.pos[0], k2.pos[0], easeT),
        THREE.MathUtils.lerp(k1.pos[1], k2.pos[1], easeT),
        THREE.MathUtils.lerp(k1.pos[2], k2.pos[2], easeT)
      );
      
      const target = new THREE.Vector3(
        THREE.MathUtils.lerp(k1.target[0], k2.target[0], easeT),
        THREE.MathUtils.lerp(k1.target[1], k2.target[1], easeT),
        THREE.MathUtils.lerp(k1.target[2], k2.target[2], easeT)
      );
      
      return { pos, target };
    }
  }
  const last = SCN13_KEYFRAMES[SCN13_KEYFRAMES.length - 1];
  return { pos: new THREE.Vector3(...last.pos), target: new THREE.Vector3(...last.target) };
}

export default function CinematicCamera() {
  const { camera } = useThree();
  
  // Track look-at target vector using a ref so we can animate it with GSAP and apply in useFrame
  const targetRef = useRef(new THREE.Vector3(0.1, 1.95, 0.4));

  const currentScene = useStore((state) => state.currentScene);
  const hingePhase = useStore((state) => state.hingePhase);
  const dragProgress = useStore((state) => state.dragProgress);
  const transitProgress = useStore((state) => state.transitProgress);
  const approachProgress = useStore((state) => state.approachProgress);
  const footfallProgress = useStore((state) => state.footfallProgress);
  const rainProgress = useStore((state) => state.rainProgress);
  const awakeningProgress = useStore((state) => state.awakeningProgress);
  const lightsProgress = useStore((state) => state.lightsProgress);
  const reflectionProgress = useStore((state) => state.reflectionProgress);
  const loopProgress = useStore((state) => state.loopProgress);
  const setCurrentScene = useStore((state) => state.setCurrentScene);
  
  useEffect(() => {
    // Force camera initial position to avoid jump (Stage 1 Start)
    camera.position.set(0.22, 2.05, 0.7);
    camera.lookAt(targetRef.current);

    // Create a GSAP timeline synced to page scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 3.5, // High inertia to feel the weighted drag of moving through deep space
        invalidateOnRefresh: true,
      },
    });

    // Define the cinematic camera choreography mapped across 10.0s total duration
    // Scroll progress maps 0% -> 100% to 0.0s -> 10.0s on the timeline

    // -------------------------------------------------------------
    // SCN_02 DEPARTURE CORRIDOR (0.0s -> 5.0s, 0% -> 50% scroll)
    // -------------------------------------------------------------
    
    // Stage 1 (0.0s -> 2.0s): Glide close to cloud level
    tl.to(camera.position, {
      x: 0.7,
      y: 2.02,
      z: 1.1,
      ease: 'power1.inOut',
    }, 0);
    tl.to(targetRef.current, {
      x: 0.1,
      y: 1.7,
      z: 0.3,
      ease: 'power1.inOut',
    }, 0);

    // Stage 2 (2.0s -> 4.5s): Curvature & sunset rim reveal
    tl.to(camera.position, {
      x: 1.9,
      y: 1.6,
      z: 2.3,
      ease: 'power1.inOut',
    }, 2.0);
    tl.to(targetRef.current, {
      x: 0.05,
      y: 0.4,
      z: 0.1,
      ease: 'power1.inOut',
    }, 2.0);

    // Stage 3 (4.5s -> 5.0s): Silhouette emergence
    tl.to(camera.position, {
      x: 2.8,
      y: 1.1,
      z: 3.8,
      ease: 'power1.inOut',
    }, 4.5);
    tl.to(targetRef.current, {
      x: 0.0,
      y: 0.1,
      z: 0.0,
      ease: 'power1.inOut',
    }, 4.5);

    // -------------------------------------------------------------
    // THE VACUUM EVENT: MOTION FREEZE (5.0s -> 5.3s, 50% -> 53% scroll)
    // Camera pauses at orbit height to register the hard acoustic cut
    // -------------------------------------------------------------
    tl.to(camera.position, {
      x: 2.8,
      y: 1.1,
      z: 3.8,
      duration: 0.3,
      ease: 'none',
    }, 5.0);
    tl.to(targetRef.current, {
      x: 0.0,
      y: 0.1,
      z: 0.0,
      duration: 0.3,
      ease: 'none',
    }, 5.0);

    // -------------------------------------------------------------
    // SCN_03 ACOUSTIC VACUUM (5.3s -> 10.0s, 53% -> 100% scroll)
    // Camera retreats into the void, Earth shrinks to < 5% of screen.
    // -------------------------------------------------------------
    
    // Stage 4 (5.3s -> 8.0s): Curvature fades, Earth shrinks, Moon orbit reveals
    tl.to(camera.position, {
      x: 1.0,
      y: 0.5,
      z: 35.0,
      ease: 'power2.inOut',
    }, 5.3);
    tl.to(targetRef.current, {
      x: 0.0,
      y: 0.0,
      z: 0.0,
      ease: 'power2.inOut',
    }, 5.3);

    // Stage 5 (8.0s -> 10.0s): Deep space drift. Earth is a tiny speck
    tl.to(camera.position, {
      x: -0.5,
      y: 0.5,
      z: 95.0,
      ease: 'power3.out', // Decelerate heavily as we reach deep space to simulate resistance
    }, 8.0);
    tl.to(targetRef.current, {
      x: -0.05,
      y: 0.0,
      z: 0.0,
      ease: 'power3.out',
    }, 8.0);

    return () => {
      // Kill ScrollTriggers on unmount
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [camera]);

  // Handle camera flyby snap when user releases mouse in SCN_04
  useEffect(() => {
    if (hingePhase === 'snapped') {
      // Clean previous camera tweens
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(targetRef.current);

      // Accelerate camera violently through space to z: -800 (pass Earth and deep space)
      gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: -800,
        duration: 4.5,
        ease: 'power4.inOut',
        onComplete: () => {
          setCurrentScene('SCN_05');
        },
      });

      // Target faces Mars beacon in front of camera
      gsap.to(targetRef.current, {
        x: 0,
        y: 0,
        z: -900,
        duration: 3.5,
        ease: 'power3.inOut',
      });
    }
  }, [hingePhase, camera, setCurrentScene]);

  // Update lookAt and add camera shake on every single frame rendering tick
  useFrame(() => {
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;

    // Apply shake relative to drag progress during SCN_04 (The Hinge)
    if (currentScene === 'SCN_04') {
      // Maximum shake at peak tension
      const shakeFactor = dragProgress * 0.15;
      shakeX = (Math.random() - 0.5) * shakeFactor;
      shakeY = (Math.random() - 0.5) * shakeFactor;
      shakeZ = (Math.random() - 0.5) * shakeFactor;
    }

    // In SCN_05 (Deep space transit), camera Z drifts forward to Mars linked to transit progress
    if (currentScene === 'SCN_05') {
      const targetZ = -800.0 - transitProgress * 320.0;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.08);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0.0, 0.08);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.0, 0.08);

      // Smoothly direct camera look-at target to Mars center
      targetRef.current.lerp(new THREE.Vector3(0.0, 0.0, -1200.0), 0.08);
    }

    // In SCN_06 (Mars Approach), interpolate camera position and target based on approach progress
    if (currentScene === 'SCN_06') {
      const { pos, target } = interpolateKeyframes(approachProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // In SCN_07 (First Footfall), interpolate camera position and target based on landing progress
    if (currentScene === 'SCN_07') {
      const { pos, target } = interpolateKeyframes07(footfallProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // In SCN_09 (The First Rain), interpolate camera position and target based on rain progress
    if (currentScene === 'SCN_09') {
      const { pos, target } = interpolateKeyframes09(rainProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // In SCN_10 (Azure Awakening), interpolate camera position and target based on awakening progress
    if (currentScene === 'SCN_10') {
      const { pos, target } = interpolateKeyframes10(awakeningProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // In SCN_11 (First Lights), interpolate camera position and target based on lights progress
    if (currentScene === 'SCN_11') {
      const { pos, target } = interpolateKeyframes11(lightsProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // In SCN_12 (Twin Reflection), interpolate camera position and target based on reflection progress
    if (currentScene === 'SCN_12') {
      const { pos, target } = interpolateKeyframes12(reflectionProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // In SCN_13 (The Loop), interpolate camera position and target based on loop progress
    if (currentScene === 'SCN_13') {
      const { pos, target } = interpolateKeyframes13(loopProgress);
      camera.position.lerp(pos, 0.08);
      targetRef.current.lerp(target, 0.08);
    }

    // Clone current target
    const target = targetRef.current.clone();

    // Temporarily apply shake offset to camera position
    camera.position.x += shakeX;
    camera.position.y += shakeY;
    camera.position.z += shakeZ;

    camera.lookAt(target.x + shakeX * 0.5, target.y + shakeY * 0.5, target.z + shakeZ * 0.5);

    // Revert shake offset so it doesn't accumulate and break base coordinates
    camera.position.x -= shakeX;
    camera.position.y -= shakeY;
    camera.position.z -= shakeZ;
  });

  return null;
}
