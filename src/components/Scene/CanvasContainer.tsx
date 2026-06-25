'use client';

import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Line } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { useStore } from '@/store/useStore';
import Earth from './Earth';
import Atmosphere from './Atmosphere';
import CinematicCamera from './CinematicCamera';
import { SpaceDistortion } from './SpaceDistortion';
import MarsApproach from './MarsApproach';
import MarsSurface from './MarsSurface';
import MarsRain from './MarsRain';
import MarsAwakening from './MarsAwakening';
import MarsLights from './MarsLights';
import MarsReflection from './MarsReflection';
import MarsLoop from './MarsLoop';

// Vector representing the Sun's position in deep space
const SUN_POSITION = new THREE.Vector3(-25, 5.8, -25);

// Glowing Sun component that sits behind the Earth to create the eclipse and lens flare
function Sun() {
  return (
    <mesh position={SUN_POSITION}>
      <sphereGeometry args={[3.0, 32, 32]} />
      {/* High-intensity emissive basic material with toneMapped={false} triggers post-process bloom */}
      <meshBasicMaterial color={[15.0, 13.8, 12.0]} toneMapped={false} />
    </mesh>
  );
}

// Procedural cratered Moon component
function Moon() {
  return (
    <mesh position={[14.2, -2.5, -10.0]}>
      <sphereGeometry args={[0.54, 32, 32]} />
      <meshStandardMaterial 
        color="#70757a" 
        roughness={0.95} 
        metalness={0.0} 
      />
    </mesh>
  );
}

// Faint orbit line representing the Moon's orbital plane
function MoonOrbit() {
  const points = [];
  const radius = 17.6; // scaled distance representing orbit path
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
  }

  return (
    <Line
      points={points}
      color="rgba(14, 165, 233, 0.4)" // Cyan orbital glow line
      lineWidth={0.5}
      transparent
      opacity={0.18}
      rotation={[0.25, 0.0, 0.15]} // tilted orbital alignment
    />
  );
}

// Faint reddish point of light far ahead representing Mars (possibility beacon in SCN_03/SCN_04)
function MarsPoint() {
  const meshRef = useRef<THREE.Mesh>(null);
  const hingePhase = useStore((state) => state.hingePhase);
  const currentScene = useStore((state) => state.currentScene);

  useFrame((state) => {
    if (meshRef.current && meshRef.current.material) {
      if (hingePhase === 'snapped') {
        // In snapped phase (before SCN_05 starts), reposition Mars directly ahead in trajectory
        const elapsed = state.clock.getElapsedTime();
        const pulse = 0.65 + Math.sin(elapsed * 3.5) * 0.35;
        
        meshRef.current.position.set(0.0, 0.0, -1200.0);
        meshRef.current.scale.setScalar(5.5);

        if (!Array.isArray(meshRef.current.material)) {
          meshRef.current.material.opacity = pulse * 0.95;
        }
      } else {
        // Default scroll-based visibility in SCN_03
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollFraction = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
        
        meshRef.current.position.set(1.5, 0.8, -130);
        meshRef.current.scale.setScalar(1.0);

        if (scrollFraction > 0.50) {
          const t = (scrollFraction - 0.50) / 0.50;
          const opacity = Math.min(1.0, t * 1.5);
          
          if (!Array.isArray(meshRef.current.material)) {
            meshRef.current.material.opacity = opacity * 0.95;
          }
        } else {
          if (!Array.isArray(meshRef.current.material)) {
            meshRef.current.material.opacity = 0.0;
          }
        }
      }
    }
  });

  const isSCN05 = currentScene === 'SCN_05';

  return (
    <mesh ref={meshRef} position={[1.5, 0.8, -130]} visible={!isSCN05}>
      <sphereGeometry args={[0.35, 8, 8]} />
      <meshBasicMaterial 
        color={[4.5, 0.6, 0.35]}
        toneMapped={false}
        transparent
        opacity={0.0}
      />
    </mesh>
  );
}

// Shaded Mars Planet and Moon Orbits representing the destination system in SCN_05
function MarsPlanet() {
  const currentScene = useStore((state) => state.currentScene);
  const transitProgress = useStore((state) => state.transitProgress);
  
  const glintRef = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  const isSCN05 = currentScene === 'SCN_05';

  // 1. Orbit Trails opacity (fades in during Stage 3: scroll 40% -> 70%)
  const orbitOpacity = isSCN05 ? Math.max(0.0, Math.min(0.22, (transitProgress - 0.40) * 0.75)) : 0.0;

  // 2. Glint indicator opacity (Stage 1-3, fades out in Stage 4 starting at 75%)
  const glintOpacity = isSCN05 
    ? (transitProgress < 0.75 ? 0.9 : Math.max(0.0, 0.9 - (transitProgress - 0.75) * 8.0))
    : 0.0;

  // 3. Realistic Shaded Mars sphere opacity (Stage 4, fades in starting at 72%)
  const marsOpacity = isSCN05
    ? Math.max(0.0, Math.min(1.0, (transitProgress - 0.72) * 5.5))
    : 0.0;

  // Tilted orbital plane circles for Phobos and Deimos
  const innerPoints = [];
  const outerPoints = [];
  const rInner = 14.0;
  const rOuter = 22.0;
  for (let i = 0; i <= 64; i++) {
    const theta = (i / 64) * Math.PI * 2;
    innerPoints.push(new THREE.Vector3(Math.cos(theta) * rInner, 0, Math.sin(theta) * rInner));
    outerPoints.push(new THREE.Vector3(Math.cos(theta) * rOuter, 0, Math.sin(theta) * rOuter));
  }

  useFrame((state) => {
    if (!isSCN05) return;
    const elapsed = state.clock.getElapsedTime();

    // Pulse the faint glint signal in deep space
    if (glintRef.current && glintRef.current.material && !Array.isArray(glintRef.current.material)) {
      const pulse = 0.7 + Math.sin(elapsed * 2.5) * 0.3;
      glintRef.current.material.opacity = glintOpacity * pulse;
    }
  });

  return (
    <group position={[0.0, 0.0, -1200.0]} visible={isSCN05}>
      {/* Tilted planet orbit lines */}
      <group rotation={[0.22, 0.0, 0.18]}>
        <Line 
          points={innerPoints} 
          color="rgba(34, 211, 238, 0.6)" 
          lineWidth={0.5} 
          transparent 
          opacity={orbitOpacity} 
        />
        <Line 
          points={outerPoints} 
          color="rgba(255, 255, 255, 0.4)" 
          lineWidth={0.5} 
          transparent 
          opacity={orbitOpacity} 
        />
      </group>

      {/* Deep-space Red Signal point of light (faint star glint) */}
      <mesh ref={glintRef} scale={[3.0 + transitProgress * 3.5, 3.0 + transitProgress * 3.5, 3.0 + transitProgress * 3.5]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial 
          color={[5.0, 0.65, 0.35]}
          toneMapped={false}
          transparent
          opacity={0.0}
        />
      </mesh>

      {/* Shaded Planetary Sphere (Crescent silhouette lit from left-rear) */}
      <mesh ref={sphereRef} scale={[6.2, 6.2, 6.2]}>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial 
          color="#954231" // Ancient oxidized iron/rust
          roughness={0.92}
          metalness={0.03}
          transparent
          opacity={marsOpacity}
        />
      </mesh>
    </group>
  );
}

// Multi-layered starfield with parallax rotation
function Starfield() {
  const layer1Ref = useRef<THREE.Group>(null);
  const layer2Ref = useRef<THREE.Group>(null);
  const layer3Ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    
    // Slow, independent rotations to create deep parallax when camera moves
    if (layer1Ref.current) {
      layer1Ref.current.rotation.y = elapsed * 0.002;
      layer1Ref.current.rotation.x = elapsed * 0.0006;
    }
    if (layer2Ref.current) {
      layer2Ref.current.rotation.y = -elapsed * 0.001;
      layer2Ref.current.rotation.z = elapsed * 0.0003;
    }
    if (layer3Ref.current) {
      layer3Ref.current.rotation.y = elapsed * 0.0004;
      layer3Ref.current.rotation.x = -elapsed * 0.0002;
    }
  });

  return (
    <group>
      {/* Layer 1: Background stars (deepest space, dense, tiny) */}
      <group ref={layer1Ref}>
        <Stars
          radius={380}
          depth={50}
          count={3000}
          factor={4}
          saturation={0.7}
          fade
          speed={0} // Disable sparkle to avoid flickering, use rotation for life
        />
      </group>

      {/* Layer 2: Midground stars (medium depth, bright) */}
      <group ref={layer2Ref}>
        <Stars
          radius={220}
          depth={45}
          count={1500}
          factor={6}
          saturation={0.5}
          fade
          speed={0}
        />
      </group>

      {/* Layer 3: Foreground dust / close stars (creates localized parallax movement) */}
      <group ref={layer3Ref}>
        <Stars
          radius={85}
          depth={30}
          count={500}
          factor={8}
          saturation={0.3}
          fade
          speed={0}
        />
      </group>
    </group>
  );
}

// Shader uniform controller for SCN_04 Hinge distortions & SCN_05 Nebulae
function HingeController() {
  const dragProgress = useStore((state) => state.dragProgress);
  const hingePhase = useStore((state) => state.hingePhase);
  const currentScene = useStore((state) => state.currentScene);
  const transitProgress = useStore((state) => state.transitProgress);
  const effectRef = useRef<any>(null);

  const valuesRef = useRef({ distortion: 0.0, zoomBlur: 0.0, nebulaStrength: 0.0 });

  useEffect(() => {
    if (hingePhase === 'snapped') {
      // Instantly implode space and trigger streak radial blur
      valuesRef.current.distortion = -0.65;
      valuesRef.current.zoomBlur = 1.5;

      // Smoothly resolve the distortion to baseline
      gsap.killTweensOf(valuesRef.current);
      gsap.to(valuesRef.current, {
        distortion: 0.0,
        zoomBlur: 0.0,
        duration: 3.8,
        ease: 'power3.out',
      });
    }
  }, [hingePhase]);

  useFrame(() => {
    // During manual click-and-drag build up
    if (hingePhase === 'dragging' || hingePhase === 'holding') {
      valuesRef.current.distortion = dragProgress * 0.38;
      valuesRef.current.zoomBlur = dragProgress * 0.07;
    }

    // In SCN_05, fade in nebula clouds from 0.0 to 0.85
    if (currentScene === 'SCN_05') {
      valuesRef.current.nebulaStrength = transitProgress * 0.85;
    } else {
      valuesRef.current.nebulaStrength = 0.0;
    }

    // Directly update custom WebGL effect uniforms on GPU
    if (effectRef.current) {
      const uniforms = effectRef.current.uniforms;
      if (uniforms) {
        const distUni = uniforms.get('uDistortion');
        const blurUni = uniforms.get('uZoomBlur');
        const nebUni = uniforms.get('uNebulaStrength');
        if (distUni) distUni.value = valuesRef.current.distortion;
        if (blurUni) blurUni.value = valuesRef.current.zoomBlur;
        if (nebUni) nebUni.value = valuesRef.current.nebulaStrength;
      }
    }
  });

  return <SpaceDistortion ref={effectRef} />;
}

export default function CanvasContainer() {
  const hingePhase = useStore((state) => state.hingePhase);
  const currentScene = useStore((state) => state.currentScene);

  // Instantly collapse/hide the Earth System on Snap
  const hideEarthSystem = hingePhase === 'snapped' || currentScene === 'SCN_05' || currentScene === 'SCN_06' || currentScene === 'SCN_07' || currentScene === 'SCN_09' || currentScene === 'SCN_10' || currentScene === 'SCN_11' || currentScene === 'SCN_12' || currentScene === 'SCN_13';

  return (
    <div className="canvas-wrapper">
      <Canvas
        camera={{ position: [0.22, 2.05, 0.7], fov: 45, near: 0.05, far: 1800 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
      >
        {/* Deep Cinematic Space Background */}
        <color attach="background" args={['#020204']} />
        
        {/* Parallax Starfield */}
        <Starfield />

        {/* Cinematic Light Sources */}
        
        {/* Primary Sun Light for Earth (behind the Earth, pointing forward-right) */}
        <directionalLight
          position={SUN_POSITION}
          intensity={hideEarthSystem ? 0 : 5.5}
          color="#fff6e8"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* Ambient Dark-side Space Fill (faint blue/indigo space bounce) */}
        <ambientLight intensity={hideEarthSystem ? 0.006 : 0.035} color="#080e21" />
        
        {/* Secondary Rim Fill (subtle atmospheric backlight scatter) */}
        <directionalLight
          position={[10, -5, 10]}
          intensity={hideEarthSystem ? 0 : 0.15}
          color="#0ea5e9"
        />

        {/* Sun Light for Mars in SCN_05/SCN_06 (placed far behind Mars at z: -1500) */}
        <directionalLight
          position={[-300, 80, -1500]}
          intensity={currentScene === 'SCN_05' || currentScene === 'SCN_06' ? 7.0 : 0.0}
          color="#ffe5cc"
        />

        {/* Low-angle Sun Light for Mars Landing Site in SCN_07 */}
        <directionalLight
          position={[-5.0, 4.0, -8.0]}
          intensity={currentScene === 'SCN_07' ? 4.5 : 0.0}
          color="#ffdcd0"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.1}
          shadow-camera-far={25}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
        />

        {/* Scene Models */}
        <Suspense fallback={null}>
          {/* Earth System (visible until Snap occurs) */}
          <group visible={!hideEarthSystem}>
            <group rotation={[0, 0, 0.4]}> {/* Realistic Earth axial tilt */}
              <Earth />
              <Atmosphere />
              <Moon />
              <MoonOrbit />
            </group>
            <Sun />
          </group>

          {/* Mars glint (always loaded, fades/repositions during scroll & snap) */}
          <MarsPoint />

          {/* Shaded Mars planet with progressive scroll-based reveal */}
          <MarsPlanet />

          {/* Detailed Mars Approach system for SCN_06 */}
          <MarsApproach />

          {/* Detailed Mars Landing site surface for SCN_07 */}
          <MarsSurface />

          {/* Detailed Mars First Rain scene for SCN_09 */}
          <MarsRain />

          {/* Detailed Mars Awakening scene for SCN_10 */}
          <MarsAwakening />

          {/* Detailed Mars First Lights scene for SCN_11 */}
          <MarsLights />

          {/* Detailed Mars Twin Reflection scene for SCN_12 */}
          <MarsReflection />

          {/* Detailed Mars Loop scene for SCN_13 */}
          <MarsLoop />
        </Suspense>

        {/* Custom GSAP camera sequence linked to document scroll */}
        <CinematicCamera />

        {/* Post-Processing Effects */}
        <EffectComposer>
          <Bloom
            intensity={1.8}
            luminanceThreshold={0.15}
            luminanceSmoothing={0.85}
            mipmapBlur
          />
          <HingeController />
          <Vignette eskil={false} offset={0.05} darkness={0.75} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
