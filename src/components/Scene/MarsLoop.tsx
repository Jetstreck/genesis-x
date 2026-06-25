'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

// Simplex noise GLSL functions for procedural texturing (Mars and Iris)
const noiseGLSL = `
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

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  float getMarsHeight(vec2 uv) {
    float base = fbm(uv * 3.8) * 0.35;
    float detail = fbm(uv * 12.0) * 0.07;
    float crater = snoise(uv * 24.0);
    float craterH = smoothstep(0.38, 0.45, abs(crater)) * 0.035;

    float canyonCenter = 0.48 + 0.026 * sin(uv.x * 10.0) + 0.01 * sin(uv.x * 25.0);
    float distToCanyon = abs(uv.y - canyonCenter);
    float longMask = smoothstep(0.20, 0.28, uv.x) * smoothstep(0.58, 0.50, uv.x);
    float canyonDepth = smoothstep(0.038, 0.003, distToCanyon) * longMask;

    return base + detail - craterH - canyonDepth * 0.32;
  }
`;

// Procedural Nebulae Background mesh (Stage 2 & 3)
function CosmicNebulae({ loopProgress }: { loopProgress: number }) {
  const nebRef = useRef<THREE.Mesh>(null);
  
  const opacity = useMemo(() => {
    if (loopProgress < 0.15) return 0.0;
    if (loopProgress < 0.35) return (loopProgress - 0.15) / 0.20;
    if (loopProgress < 0.70) return 1.0;
    if (loopProgress < 0.85) return 1.0 - (loopProgress - 0.70) / 0.15;
    return 0.0;
  }, [loopProgress]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0.0 },
    uOpacity: { value: 0.0 }
  }), []);

  useFrame((state) => {
    if (opacity <= 0) return;
    uniforms.uTime.value = state.clock.getElapsedTime();
    uniforms.uOpacity.value = opacity;
    if (nebRef.current) {
      nebRef.current.rotation.z = state.clock.getElapsedTime() * 0.012;
    }
  });

  if (opacity <= 0) return null;

  return (
    <mesh ref={nebRef} position={[0.0, 0.0, -1350.0]}>
      <planeGeometry args={[600, 450]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          uniform float uOpacity;

          ${noiseGLSL}

          void main() {
            vec2 uv = vUv - 0.5;
            
            // Cosmic FBM gas clouds
            float n1 = fbm(uv * 1.8 + vec2(uTime * 0.015, uTime * 0.005));
            float n2 = fbm(uv * 3.5 - vec2(uTime * 0.008, uTime * 0.012));
            
            float gas = clamp(n1 * 0.6 + n2 * 0.4 + 0.3, 0.0, 1.0);
            
            // Neon space colors: deep purple to warm magenta/indigo
            vec3 spaceBlack = vec3(0.01, 0.01, 0.02);
            vec3 colorViolet = vec3(0.18, 0.05, 0.32);
            vec3 colorMagenta = vec3(0.42, 0.08, 0.35);
            vec3 colorCyan = vec3(0.05, 0.28, 0.42);

            vec3 color = mix(spaceBlack, colorViolet, gas);
            color = mix(color, colorMagenta, n1 * gas * 0.8);
            color = mix(color, colorCyan, n2 * gas * 0.5);

            gl_FragColor = vec4(color * uOpacity, uOpacity);
          }
        `}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// Procedural living human iris eye reflecting a spiral galaxy (Stage 6)
function ProceduralEye({ loopProgress }: { loopProgress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const opacity = useMemo(() => {
    if (loopProgress < 0.82) return 0.0;
    if (loopProgress < 0.88) return (loopProgress - 0.82) / 0.06;
    return 1.0;
  }, [loopProgress]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0.0 },
    uOpacity: { value: 0.0 }
  }), []);

  useFrame((state) => {
    if (opacity <= 0) return;
    uniforms.uTime.value = state.clock.getElapsedTime();
    uniforms.uOpacity.value = opacity;
  });

  if (opacity <= 0) return null;

  return (
    <mesh ref={meshRef} position={[0.0, 0.0, -100.0]} scale={[12.5, 12.5, 1.0]}>
      <planeGeometry args={[1.0, 1.0]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          uniform float uOpacity;

          ${noiseGLSL}

          void main() {
            vec2 st = vUv - 0.5;
            float r = length(st) * 2.0;       // radial distance (0.0 to 1.0 inside bounds)
            float theta = atan(st.y, st.x);   // angle (-PI to PI)

            if (r > 1.0) {
              discard; // Keep it circular
            }

            // 1. Sclera (White of the eye) border fade
            float scleraMask = smoothstep(0.85, 0.95, r);
            vec3 scleraColor = vec3(0.92, 0.93, 0.96);

            // 2. Pupil (Dark black center)
            float pupilMask = smoothstep(0.32, 0.30, r);

            // 3. Iris radial fibers (procedural striations)
            // Combine noise and trigonometric waves to map radial fibers
            float fiberFreq = 75.0;
            float fiberNoise = snoise(vec2(r * 22.0, theta * 8.0)) * 0.15;
            float fiberStripes = sin(theta * fiberFreq + fiberNoise * 20.0) * 0.4 + 0.6;
            
            // Blending colors representing Earth/Mars hybrid generation (Green-teal & amber gold)
            vec3 baseTeal = vec3(0.06, 0.38, 0.46);
            vec3 baseGold = vec3(0.88, 0.58, 0.18);
            vec3 pupilRing = vec3(0.24, 0.16, 0.06);

            // Inner collar vs outer iris color mix
            float collarMask = smoothstep(0.55, 0.35, r);
            vec3 irisColor = mix(baseTeal, baseGold, fiberStripes * 0.55);
            irisColor = mix(irisColor, pupilRing, collarMask * 0.88);

            // 4. Galaxy cosmic reflection on the cornea
            // A faint, rotating spiral galaxy overlaid on top
            float spiralAngle = theta - r * 5.5 + uTime * 0.18;
            float spiralArms = sin(spiralAngle * 2.0) * 0.5 + 0.5;
            float spiralGlow = smoothstep(0.6, 0.1, abs(r - 0.42)) * spiralArms;
            vec3 reflectionColor = vec3(0.72, 0.88, 1.0) * spiralGlow * 0.35;

            // Combine layers
            vec3 finalColor = vec3(0.0);
            
            if (r < 0.30) {
              // Pure black pupil
              finalColor = vec3(0.02, 0.02, 0.02);
            } else if (r < 0.85) {
              // Iris fibers + reflections
              finalColor = irisColor + reflectionColor;
              // shadow ring around pupil
              finalColor *= smoothstep(0.30, 0.36, r);
              // dark ring at outer iris boundary
              finalColor *= smoothstep(0.85, 0.78, r);
            } else {
              // White sclera
              finalColor = scleraColor;
            }

            // Alpha fade in
            gl_FragColor = vec4(finalColor * uOpacity, uOpacity);
          }
        `}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// Main exporter component
export default function MarsLoop() {
  const currentScene = useStore((state) => state.currentScene);
  const loopProgress = useStore((state) => state.loopProgress);

  // References for spinning/animating planets
  const marsRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Mesh>(null);

  // Load Earth texture
  const [earthDiffuse, earthNormal, earthClouds] = useTexture([
    '/textures/earth_diffuse.png',
    '/textures/earth_normal.png',
    '/textures/earth_clouds.png'
  ]);

  // Configure texture parameters
  [earthDiffuse, earthNormal, earthClouds].forEach((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  });

  // Calculate Sun position (fixed soft ambient light)
  const sunPos = useMemo(() => new THREE.Vector3(-45.0, 15.0, -1120.0), []);

  // Earth/Mars drift position coordinates
  const marsX = -25.0 - loopProgress * 65.0;
  const earthX = 25.0 + loopProgress * 65.0;
  const planetOpacity = Math.max(0.0, 1.0 - loopProgress / 0.24);

  // Target star scale
  const starScale = useMemo(() => {
    if (loopProgress < 0.40) return 0.0;
    const t = (loopProgress - 0.40) / 0.45; // 0.0 to 1.0
    // Exponential scale up as camera approaches
    return Math.pow(t, 4.0) * 110.0 + t * 4.0;
  }, [loopProgress]);

  const starOpacity = useMemo(() => {
    if (loopProgress < 0.40) return 0.0;
    if (loopProgress < 0.45) return (loopProgress - 0.40) / 0.05;
    if (loopProgress < 0.80) return 1.0;
    return Math.max(0.0, 1.0 - (loopProgress - 0.80) / 0.05); // Fade star out as white fills screen
  }, [loopProgress]);

  useFrame((state) => {
    if (currentScene !== 'SCN_13') return;
    const elapsed = state.clock.getElapsedTime();

    // Rotate planets slowly in drift
    if (marsRef.current) {
      marsRef.current.rotation.y = 1.0 + elapsed * 0.0004;
    }
    if (earthRef.current) {
      earthRef.current.rotation.y = 2.0 + elapsed * 0.0005;
    }

    // Pulse the target star
    if (starRef.current && starOpacity > 0) {
      const pulse = 0.85 + Math.sin(elapsed * 4.5) * 0.15;
      starRef.current.scale.setScalar(starScale * pulse);
      if (starRef.current.material && !Array.isArray(starRef.current.material)) {
        starRef.current.material.opacity = starOpacity;
      }
    }
  });

  if (currentScene !== 'SCN_13') return null;

  return (
    <group>
      {/* --------------------------------------------------- */}
      {/* STAGE 1 — THE DEPARTURE: FADING DRIFTING PLANETS */}
      {/* --------------------------------------------------- */}
      {planetOpacity > 0 && (
        <group>
          {/* MARS (LEFT) */}
          <group ref={marsRef} position={[marsX, 0.0, -1200.0]} scale={[12.0, 12.0, 12.0]}>
            <mesh>
              <sphereGeometry args={[1.0, 64, 64]} />
              <meshStandardMaterial
                roughness={0.92}
                metalness={0.03}
                transparent
                opacity={planetOpacity}
                onBeforeCompile={(shader) => {
                  shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `
                    float h = 0.5 * sin(vUv.x * 12.0) * cos(vUv.y * 12.0);
                    // Standard green-blue terraformed color approximation
                    vec3 baseColor = mix(vec3(0.05, 0.15, 0.35), vec3(0.08, 0.38, 0.16), smoothstep(-0.2, 0.1, h));
                    
                    // Simple ambient cities glowing
                    float cityGrid = smoothstep(0.40, 0.44, sin(vUv.x * 200.0) * cos(vUv.y * 200.0));
                    baseColor += vec3(1.0, 0.72, 0.35) * cityGrid * 0.6;

                    diffuseColor.rgb = baseColor;
                    `
                  );
                }}
              />
            </mesh>
          </group>

          {/* EARTH (RIGHT) */}
          <group ref={earthRef} position={[earthX, 0.0, -1200.0]} scale={[12.0, 12.0, 12.0]}>
            <mesh>
              <sphereGeometry args={[1.0, 64, 64]} />
              <meshStandardMaterial
                map={earthDiffuse}
                normalMap={earthNormal}
                normalScale={new THREE.Vector2(1.2, 1.2)}
                roughness={0.72}
                metalness={0.05}
                transparent
                opacity={planetOpacity}
              />
            </mesh>
            <mesh scale={[1.015, 1.015, 1.015]}>
              <sphereGeometry args={[1.0, 64, 64]} />
              <meshStandardMaterial
                map={earthClouds}
                alphaMap={earthClouds}
                transparent
                depthWrite={false}
                opacity={planetOpacity * 0.75}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* SCN_13 Lights */}
      <directionalLight position={sunPos} intensity={mix(5.0, 0.5, loopProgress)} color="#fffaf0" />
      <ambientLight intensity={0.005} color="#080e21" />

      {/* --------------------------------------------------- */}
      {/* STAGE 2 & 3 — THE COSMIC OCEAN: NEBULAE BACKDROP */}
      {/* --------------------------------------------------- */}
      <CosmicNebulae loopProgress={loopProgress} />

      {/* --------------------------------------------------- */}
      {/* STAGE 4 & 5 — THE NEW STAR: GLOWING ZOOM POINT */}
      {/* --------------------------------------------------- */}
      {starOpacity > 0 && (
        <mesh ref={starRef} position={[0.0, 0.0, -500.0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial 
            color={[18.0, 18.0, 18.0]} // Hyper-bright bloom trigger
            toneMapped={false}
            transparent
            opacity={0.0} 
          />
        </mesh>
      )}

      {/* --------------------------------------------------- */}
      {/* STAGE 6 — THE REVEAL: LIVING HUMAN IRIS EYE */}
      {/* --------------------------------------------------- */}
      <ProceduralEye loopProgress={loopProgress} />
    </group>
  );
}

function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
