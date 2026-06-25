'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { rainSynth } from '@/lib/rainSynth';

// Simplex 2D noise shader function
const snoiseGLSL = `
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    vec3 o5 = m * ( a0 * a0 + h * h );
    return 130.0 * dot(m, x * 1.6 - h);
  }

  float getGroundHeight(vec2 p) {
    float h = snoise(p * 0.18) * 0.16;   // wide dunes
    h += snoise(p * 0.7) * 0.028;       // minor wind ripples
    return h;
  }
`;

// 1. Sky Dome component with shifting lights and procedural cloud generation
function SkyDome({ rainProgress }: { rainProgress: number }) {
  const skyUniforms = useMemo(() => ({
    uColorHorizonDry: { value: new THREE.Color('#381008') },
    uColorHorizonWet: { value: new THREE.Color('#10131a') },
    uColorZenithDry: { value: new THREE.Color('#010103') },
    uColorZenithWet: { value: new THREE.Color('#050608') },
    uRainProgress: { value: 0.0 },
    uTime: { value: 0.0 }
  }), []);

  useFrame((state) => {
    skyUniforms.uRainProgress.value = rainProgress;
    skyUniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={[100.0, 100.0, 100.0]}>
      <sphereGeometry args={[1.0, 32, 32]} />
      <shaderMaterial
        vertexShader={`
          varying vec3 vWorldPosition;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPosition;
          varying vec2 vUv;
          uniform vec3 uColorHorizonDry;
          uniform vec3 uColorHorizonWet;
          uniform vec3 uColorZenithDry;
          uniform vec3 uColorZenithWet;
          uniform float uRainProgress;
          uniform float uTime;

          ${snoiseGLSL}

          void main() {
            vec3 dir = normalize(vWorldPosition);
            float factor = clamp(dir.y, 0.0, 1.0);

            // Shifting horizons as atmosphere stabilizes
            vec3 colorHorizon = mix(uColorHorizonDry, uColorHorizonWet, uRainProgress);
            vec3 colorZenith = mix(uColorZenithDry, uColorZenithWet, uRainProgress);
            vec3 baseSky = mix(colorHorizon, colorZenith, pow(factor, 0.5));

            // Procedural clouds that build density with rainProgress
            vec2 cloudUv = vUv * 4.5 + vec2(uTime * 0.015, uTime * 0.005);
            float cloudNoise = snoise(cloudUv) * 0.5 + snoise(cloudUv * 2.2) * 0.25;
            
            // Clouds build up gradually (Stages 1 and 2)
            float cloudDensity = smoothstep(0.15, 0.8, cloudNoise + uRainProgress * 0.55);
            vec3 cloudColor = mix(vec3(0.08, 0.06, 0.05), vec3(0.02, 0.03, 0.05), uRainProgress);

            vec3 finalColor = mix(baseSky, cloudColor, cloudDensity * 0.8 * clamp(dir.y + 0.1, 0.0, 1.0));

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
        uniforms={skyUniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// 2. The First Seed Sprout model in the foreground
function SeedSprout() {
  const sproutRef = useRef<THREE.Group>(null);
  const rainProgress = useStore((state) => state.rainProgress);

  useFrame((state) => {
    if (sproutRef.current) {
      // Gentle breathing animation, seed reacts slightly to rain presence
      const elapsed = state.clock.getElapsedTime();
      const scaleVal = 1.0 + Math.sin(elapsed * 1.5) * 0.025 + rainProgress * 0.15;
      sproutRef.current.scale.set(scaleVal, scaleVal, scaleVal);
    }
  });

  return (
    <group ref={sproutRef} position={[0.0, 0.05, 0.0]} scale={[1, 1, 1]}>
      {/* Small dry pod casing at base */}
      <mesh position={[0, -0.02, 0]} castShadow>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color="#301c15" roughness={0.9} />
      </mesh>
      
      {/* Primary sprout stem */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.006, 0.08, 8]} />
        <meshStandardMaterial 
          color="#06b6d4" // Glowing teal
          emissive="#0891b2" 
          emissiveIntensity={0.65} 
          roughness={0.2}
        />
      </mesh>

      {/* Sprout leaf 1 */}
      <mesh position={[0.015, 0.045, 0]} rotation={[0.4, 0, -0.5]} castShadow>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial 
          color="#22d3ee" 
          emissive="#06b6d4" 
          emissiveIntensity={0.8}
          roughness={0.1}
        />
      </mesh>

      {/* Sprout leaf 2 */}
      <mesh position={[-0.012, 0.052, 0.005]} rotation={[-0.3, 0.2, 0.7]} castShadow>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshStandardMaterial 
          color="#a5f3fc" 
          emissive="#22d3ee" 
          emissiveIntensity={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Little aura light representing hope */}
      <pointLight position={[0, 0.05, 0]} color="#22d3ee" intensity={0.4} distance={1.0} />
    </group>
  );
}

// 3. Falling Rain Particle System (Renders lines representing falling droplets)
function RainParticles({ rainProgress }: { rainProgress: number }) {
  const meshRef = useRef<THREE.LineSegments>(null);
  
  const count = 350; // Max raindrops visible
  
  const [positions, targetY] = useMemo(() => {
    const pos = new Float32Array(count * 2 * 3); // Segment: start and end points
    const targ = new Float32Array(count); // Target Y height for reset
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * 6.0;
      const rz = (Math.random() - 0.5) * 6.0;
      const ry = Math.random() * 4.0 + 0.1; // fall height limit
      
      // Start point
      pos[i * 6] = rx;
      pos[i * 6 + 1] = ry;
      pos[i * 6 + 2] = rz;
      
      // End point (slightly lower to represent speed streak)
      pos[i * 6 + 3] = rx;
      pos[i * 6 + 4] = ry - 0.15;
      pos[i * 6 + 5] = rz;
      
      targ[i] = ry;
    }
    return [pos, targ];
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Only animate in Stage 4 & 5
    if (rainProgress < 0.55) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    // Density of rain increases over Stage 4 [0.55 - 0.80]
    const densityFraction = Math.min(1.0, (rainProgress - 0.55) / 0.25);
    const activeCount = Math.floor(densityFraction * count);

    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    
    const fallSpeed = 7.5; // Fast rainfall

    for (let i = 0; i < count; i++) {
      let startY = posAttr.getY(i * 2);
      let endY = posAttr.getY(i * 2 + 1);

      if (i < activeCount) {
        // Fall down
        startY -= fallSpeed * delta;
        endY -= fallSpeed * delta;

        // Reset to top if touches ground
        if (endY < -0.05) {
          startY = 3.5 + Math.random() * 1.5;
          endY = startY - 0.15;
          // Randomize grid coordinates slightly on reset
          const rx = (Math.random() - 0.5) * 6.0;
          const rz = (Math.random() - 0.5) * 6.0;
          posAttr.setX(i * 2, rx);
          posAttr.setX(i * 2 + 1, rx);
          posAttr.setZ(i * 2, rz);
          posAttr.setZ(i * 2 + 1, rz);
        }

        posAttr.setY(i * 2, startY);
        posAttr.setY(i * 2 + 1, endY);
      } else {
        // Hide inactive particles far below
        posAttr.setY(i * 2, -100);
        posAttr.setY(i * 2 + 1, -100);
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <lineSegments ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial 
        color="#a5f3fc" 
        transparent 
        opacity={0.35} 
        linewidth={1} 
      />
    </lineSegments>
  );
}

// 4. Detailed Rock where the very first rain droplet impacts
function LandingRock({ rainProgress }: { rainProgress: number }) {
  const dropletRef = useRef<THREE.Mesh>(null);
  const rippleRef = useRef<THREE.Mesh>(null);
  const rockPos = new THREE.Vector3(0.2, 0.08, -0.2);

  useFrame(() => {
    // 1. Animating the single first drop during Stage 3 [0.45 - 0.55]
    if (dropletRef.current) {
      if (rainProgress >= 0.45 && rainProgress <= 0.50) {
        dropletRef.current.visible = true;
        // Map [0.45 - 0.50] to fall height [1.6 -> 0.10]
        const t = (rainProgress - 0.45) / 0.05; // 0.0 -> 1.0
        const easeFall = t * t; // accelerate downwards
        const height = THREE.MathUtils.lerp(1.8, 0.13, easeFall);
        dropletRef.current.position.set(rockPos.x, height, rockPos.z);
      } else {
        dropletRef.current.visible = false;
      }
    }

    // 2. Animating the splash impact ripple [0.50 - 0.55]
    if (rippleRef.current) {
      if (rainProgress > 0.50 && rainProgress < 0.55) {
        rippleRef.current.visible = true;
        const t = (rainProgress - 0.50) / 0.05; // 0.0 -> 1.0
        const scaleVal = t * 0.35; // Expand ripple
        const opacityVal = 1.0 - t; // Fade out
        rippleRef.current.scale.set(scaleVal, scaleVal, scaleVal);
        if (!Array.isArray(rippleRef.current.material)) {
          rippleRef.current.material.opacity = opacityVal * 0.8;
        }
      } else {
        rippleRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      {/* The Rock silhouette (faceted box/sphere blend) */}
      <mesh position={rockPos} rotation={[0.4, 0.5, 0.25]} castShadow receiveShadow>
        <dodecahedronGeometry args={[0.07, 1]} />
        <meshStandardMaterial 
          color="#38201a" 
          roughness={0.95} 
          onBeforeCompile={(shader) => {
            // Darken rock as rain falls
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.05, 0.04), ${rainProgress} * 0.7);
              `
            );
          }}
        />
      </mesh>

      {/* The Single droplet mesh (tear/egg shape) */}
      <mesh ref={dropletRef} scale={[0.007, 0.012, 0.007]}>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.88} />
      </mesh>

      {/* The first impact ripple plane */}
      <mesh 
        ref={rippleRef} 
        position={[rockPos.x, 0.128, rockPos.z]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.08, 0.1, 32]} />
        <meshBasicMaterial color="#e0f2fe" transparent opacity={0.0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// 5. Dynamic terrain component that darkens and creates puddles
function RainyTerrain({ rainProgress }: { rainProgress: number }) {
  const terrainMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const uniforms = useMemo(() => ({
    uRainProgress: { value: 0.0 },
    uTime: { value: 0.0 }
  }), []);

  useFrame((state) => {
    uniforms.uRainProgress.value = rainProgress;
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[22, 22, 128, 128]} />
      <meshStandardMaterial
        ref={terrainMaterialRef}
        color="#55240f"
        roughness={0.98}
        metalness={0.01}
        onBeforeCompile={(shader) => {
          // Pass custom uniforms
          shader.uniforms.uRainProgress = uniforms.uRainProgress;
          shader.uniforms.uTime = uniforms.uTime;

          // Inject Simplex Noise libraries
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            ${snoiseGLSL}
            `
          );

          // Displace vertices to form dunes
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float h = getGroundHeight(transformed.xy);
            transformed.z += h;
            `
          );

          // Fragment declarations
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>
            ${snoiseGLSL}
            uniform float uRainProgress;
            uniform float uTime;
            `
          );

          // Normal perturbation calculation
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_begin>',
            `
            #include <normal_fragment_begin>
            
            float eps = 0.008;
            float hC = getGroundHeight(vUv * 22.0);
            float hU = getGroundHeight(vUv * 22.0 + vec2(eps, 0.0));
            float hV = getGroundHeight(vUv * 22.0 + vec2(0.0, eps));
            float dh_du = (hU - hC) / eps;
            float dh_dv = (hV - hC) / eps;

            vec3 N_local = normalize(normal);
            vec3 T_local = normalize(cross(N_local, vec3(0.0, 1.0, 0.0)));
            if (length(T_local) < 0.01) {
              T_local = normalize(cross(N_local, vec3(1.0, 0.0, 0.0)));
            }
            vec3 B_local = cross(N_local, T_local);

            // Terrain normals get smoother as muddy clay gets saturated
            float normalSmooth = mix(0.7, 0.2, uRainProgress);
            normal = normalize(N_local - (T_local * dh_du + B_local * dh_dv) * normalSmooth);
            `
          );

          // Diffuse colors, specularity updates, cloud shadows and puddle creation
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            // Base procedural dry soil
            float val = snoise(vUv * 12.0);
            vec3 colorRust = vec3(0.55, 0.24, 0.15); 
            vec3 colorDesert = vec3(0.68, 0.32, 0.22); 
            vec3 colorBasalt = vec3(0.18, 0.11, 0.10); 
            vec3 baseColor = mix(colorBasalt, colorRust, smoothstep(-0.4, 0.1, val));
            baseColor = mix(baseColor, colorDesert, smoothstep(0.1, 0.6, val));

            // Saturated wet muddy soil colors (Darker, brown-clay)
            vec3 wetRust = vec3(0.18, 0.09, 0.06);
            vec3 wetDesert = vec3(0.24, 0.12, 0.09);
            vec3 wetBasalt = vec3(0.07, 0.05, 0.05);
            vec3 wetColor = mix(wetBasalt, wetRust, smoothstep(-0.4, 0.1, val));
            wetColor = mix(wetColor, wetDesert, smoothstep(0.1, 0.6, val));

            // Mix dry and wet soil based on rain progression
            vec3 groundColor = mix(baseColor, wetColor, uRainProgress);

            // Cloud Shadows (projected from sky noise drifting over ground)
            vec2 windOffset = vec2(uTime * 0.015, uTime * 0.005);
            float shadowNoise = snoise((vUv * 1.5) + windOffset);
            // Shadow factor darkens landscape up to 45% based on cloud thickness
            float shadowFactor = mix(1.0, 0.55, smoothstep(0.0, 0.5, shadowNoise + uRainProgress * 0.45));
            groundColor *= shadowFactor;

            // Specular roughness modulation: wet soil gets shiny
            float wetRoughness = mix(0.98, 0.55, uRainProgress);

            // Procedural Puddles & Rivers forming in low-lying valleys (Stage 4 and 5)
            // Low-lying height map threshold (valleys)
            float lowVal = snoise(vUv * 2.8);
            
            // Submerge logic: as rain progress advances, puddle fill thresholds expand
            float puddleFill = smoothstep(0.55, 0.90, uRainProgress); // fills between 55% and 90% scroll
            float puddleThreshold = -0.42 + puddleFill * 0.28; // valleys fill up
            
            if (lowVal < puddleThreshold) {
              // Liquid water coloring (dark mirror reflecting sky)
              vec3 waterColor = mix(vec3(0.04, 0.05, 0.07), vec3(0.01, 0.01, 0.02), uRainProgress * 0.5);
              
              // Ripple animation normals inside the puddle
              vec2 rippleUv = vUv * 64.0;
              float ripple = sin(rippleUv.x * 2.0 + uTime * 6.0) * cos(rippleUv.y * 2.0 + uTime * 5.0) * 0.12;
              
              // Blend water colors and make it extremely reflective/smooth
              diffuseColor.rgb = mix(groundColor, waterColor, 0.9);
              roughnessFactor = 0.04;
              metalnessFactor = 0.85;
            } else {
              diffuseColor.rgb = groundColor;
              roughnessFactor = wetRoughness;
            }
            `
          );
        }}
      />
    </mesh>
  );
}

// 6. Horizon massive storms that fade in during Stage 5 ascent
function HorizonStorms({ rainProgress }: { rainProgress: number }) {
  const stormRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (stormRef.current) {
      const elapsed = state.clock.getElapsedTime();
      // Storm slowly rotates in the distance
      stormRef.current.rotation.y = elapsed * 0.015;
      
      // Storm clouds become visible as camera ascends (rainProgress > 0.8)
      if (rainProgress > 0.75) {
        const factor = (rainProgress - 0.75) / 0.25; // 0.0 -> 1.0
        stormRef.current.position.y = THREE.MathUtils.lerp(-1.0, 1.5, factor);
        stormRef.current.scale.setScalar(factor);
      } else {
        stormRef.current.position.y = -100;
      }
    }
  });

  return (
    <group ref={stormRef} position={[0, -2, -18]} scale={[0, 0, 0]}>
      {/* Layers of dark massive clouds far in background */}
      <mesh position={[0, 1.0, -10]} rotation={[0.2, 0, 0]}>
        <planeGeometry args={[65, 12]} />
        <meshStandardMaterial 
          color="#06080d" 
          transparent 
          opacity={0.72} 
          roughness={0.9} 
          depthWrite={false} 
        />
      </mesh>
      <mesh position={[5, 1.8, -12]} rotation={[-0.1, 0.2, 0.1]}>
        <planeGeometry args={[55, 14]} />
        <meshStandardMaterial 
          color="#030406" 
          transparent 
          opacity={0.8} 
          roughness={0.95} 
          depthWrite={false} 
        />
      </mesh>
    </group>
  );
}

// Main component exporter
export default function MarsRain() {
  const currentScene = useStore((state) => state.currentScene);
  const rainProgress = useStore((state) => state.rainProgress);
  const hasTriggeredFirstDrop = useRef(false);

  // Precision audio synchronizer inside useFrame
  useFrame(() => {
    if (currentScene !== 'SCN_09') return;

    // Trigger procedural loud single droplet sound at exactly 50% scroll
    if (rainProgress >= 0.50 && rainProgress <= 0.55 && !hasTriggeredFirstDrop.current) {
      hasTriggeredFirstDrop.current = true;
      rainSynth.playDroplet(true);
    } else if (rainProgress < 0.45) {
      // Allow re-trigger if they scroll backwards
      hasTriggeredFirstDrop.current = false;
    }
  });

  if (currentScene !== 'SCN_09') return null;

  // Cinematic mood lightning: dims and cools colors as clouds block light
  const lightIntensity = mix(3.5, 0.42, rainProgress);
  const lightColor = mixColor(new THREE.Color('#ffdcd0'), new THREE.Color('#788ba3'), rainProgress);

  return (
    <group>
      {/* Sky box / dome gradient */}
      <SkyDome rainProgress={rainProgress} />

      {/* Atmospheric lighting */}
      <directionalLight
        position={[-3.0, 5.0, -5.0]}
        intensity={lightIntensity}
        color={lightColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      
      {/* Soft blue-ish atmospheric fill light */}
      <ambientLight intensity={mix(0.04, 0.15, rainProgress)} color="#0b172a" />

      {/* Volumetric-like falling rain segments */}
      <RainParticles rainProgress={rainProgress} />

      {/* The Miracle Sprout (First Seed) */}
      <SeedSprout />

      {/* The landing rock where the first rain drop forms */}
      <LandingRock rainProgress={rainProgress} />

      {/* Displaced terrain clay */}
      <RainyTerrain rainProgress={rainProgress} />

      {/* Far horizon storm clouds (Stage 5 rise reveal) */}
      <HorizonStorms rainProgress={rainProgress} />
    </group>
  );
}

// Helper linear interpolation for colors/intensities
function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function mixColor(start: THREE.Color, end: THREE.Color, progress: number) {
  return new THREE.Color().lerpColors(start, end, progress);
}
