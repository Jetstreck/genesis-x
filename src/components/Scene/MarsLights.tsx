'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

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

// 1. Shaded Atmospheric Glow shell around Mars
function AtmosphereGlow({ sunPos }: { sunPos: THREE.Vector3 }) {
  const glowRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    uColorDay: { value: new THREE.Color('#38bdf8') }, // cyan atmospheric daylight
    uColorTerminator: { value: new THREE.Color('#ea580c') }, // orange sunset terminator
    uSunPosition: { value: new THREE.Vector3() }
  }), []);

  useFrame(() => {
    uniforms.uSunPosition.value.copy(sunPos);
  });

  return (
    <mesh ref={glowRef} position={[0.0, 0.0, -1200.0]} scale={[61.2, 61.2, 61.2]}>
      <sphereGeometry args={[1.0, 32, 32]} />
      <shaderMaterial
        vertexShader={`
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            vWorldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPosition;
          varying vec3 vWorldNormal;
          uniform vec3 uColorDay;
          uniform vec3 uColorTerminator;
          uniform vec3 uSunPosition;

          void main() {
            vec3 normal = normalize(vWorldNormal);
            vec3 toCamera = normalize(cameraPosition - vWorldPosition);
            vec3 toSun = normalize(uSunPosition - vWorldPosition);

            // Fresnel rim glow
            float ndotv = dot(normal, toCamera);
            float rim = clamp(1.0 + ndotv, 0.0, 1.0);
            float rimGlow = pow(rim, 10.0);
            float edgeFade = smoothstep(0.0, 0.04, rim);

            // Sunset terminator glow index
            float ndots = dot(normal, toSun);
            float terminator = smoothstep(0.18, -0.02, ndots) * smoothstep(-0.02, 0.08, ndots);
            float daySide = smoothstep(-0.25, 0.25, ndots);

            vec3 atmColor = mix(uColorDay, uColorTerminator, terminator * 0.95);
            float intensity = rimGlow * edgeFade * (daySide * 0.5 + terminator * 1.5 + 0.1) * 0.95;

            gl_FragColor = vec4(atmColor * intensity, rimGlow * edgeFade * 0.88);
          }
        `}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// 2. Terraformed Mars Globe featuring sunset and city lights
function TerraformedMars({ progress, sunPos }: { progress: number; sunPos: THREE.Vector3 }) {
  const globeRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const uniformsRef = useRef({
    uTime: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3() },
    uProgress: { value: 0.0 }
  });

  useFrame((state) => {
    // Slowly rotate Mars to simulate orbital motion
    if (globeRef.current) {
      globeRef.current.rotation.y = 0.88 + state.clock.getElapsedTime() * 0.0006;
      globeRef.current.rotation.z = -0.44; // Slanted axis
    }

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = 0.94 + state.clock.getElapsedTime() * 0.0009;
      cloudsRef.current.rotation.z = -0.44;
    }

    // Update uniform values
    uniformsRef.current.uTime.value = state.clock.getElapsedTime();
    uniformsRef.current.uProgress.value = progress;
    
    // View-space sun direction updates
    const sunDir = sunPos.clone().applyMatrix4(state.camera.matrixWorldInverse).normalize();
    uniformsRef.current.uSunDirection.value.copy(sunDir);
  });

  return (
    <group position={[0.0, 0.0, -1200.0]} scale={[60.0, 60.0, 60.0]}>
      {/* Landmass Shaded Globe */}
      <mesh ref={globeRef} castShadow receiveShadow>
        <sphereGeometry args={[1.0, 128, 128]} />
        <meshStandardMaterial
          roughness={0.94}
          metalness={0.02}
          onBeforeCompile={(shader) => {
            shader.uniforms.uTime = uniformsRef.current.uTime;
            shader.uniforms.uSunDirection = uniformsRef.current.uSunDirection;
            shader.uniforms.uProgress = uniformsRef.current.uProgress;

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform float uTime;
              uniform vec3 uSunDirection;
              uniform float uProgress;

              ${snoiseGLSL}
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <roughnessmap_fragment>',
              `
              #include <roughnessmap_fragment>
              float h = getMarsHeight(vUv);
              float waterMask = smoothstep(-0.02, -0.08, h);
              roughnessFactor = mix(0.85, 0.05, waterMask);
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <metalnessmap_fragment>',
              `
              #include <metalnessmap_fragment>
              float h2 = getMarsHeight(vUv);
              float waterMask2 = smoothstep(-0.02, -0.08, h2);
              metalnessFactor = mix(0.02, 0.8, waterMask2);
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              float h = getMarsHeight(vUv);

              // Terraformed palette: Blue Oceans, Green Forests, Green Highlands
              vec3 colorOcean = vec3(0.05, 0.15, 0.35); 
              vec3 colorForest = vec3(0.08, 0.38, 0.16); 
              vec3 colorLawn = vec3(0.24, 0.52, 0.22); 
              vec3 colorPeak = vec3(0.48, 0.42, 0.38); 

              vec3 baseColor = mix(colorOcean, colorForest, smoothstep(-0.05, -0.02, h));
              baseColor = mix(baseColor, colorLawn, smoothstep(-0.02, 0.12, h));
              baseColor = mix(baseColor, colorPeak, smoothstep(0.12, 0.32, h));

              // North and South Polar Ice Caps
              float northCap = smoothstep(0.85, 0.88, vUv.y + 0.012 * snoise(vUv * 6.0));
              float southCap = smoothstep(0.15, 0.12, vUv.y + 0.010 * snoise(vUv * 8.0));
              float polarCap = max(northCap, southCap);
              vec3 frostColor = vec3(0.95, 0.96, 0.98); 
              baseColor = mix(baseColor, frostColor, polarCap * 0.92);

              // Glowing cyan-green polar auroras
              float auroraBand = smoothstep(0.84, 0.86, abs(vUv.y - 0.5) * 2.0);
              float auroraPulse = 0.5 + 0.5 * sin(uTime * 1.5);
              vec3 auroraColor = vec3(0.1, 0.98, 0.65) * auroraPulse * 0.35;
              baseColor += auroraColor * auroraBand;

              // Shading terminator mask for dark side city lights
              float ndots = dot(normalize(normal), uSunDirection);
              float darkSideFactor = smoothstep(0.05, -0.15, ndots);

              // 1. Stage 3 (0.35 - 0.50): The First Light (a single discovered gold dot near Valles Marineris)
              float firstLightProgress = smoothstep(0.35, 0.50, uProgress);
              vec2 firstLightCoord = vec2(0.48, 0.52);
              float firstLightGlow = smoothstep(0.022, 0.0, distance(vUv, firstLightCoord));
              
              // 2. Stage 4 (0.50 - 0.70): Secondary Lights (multiple clusters in highlands/valleys)
              float secondaryProgress = smoothstep(0.50, 0.70, uProgress);
              float landMask = step(-0.02, h); // only on land
              // Procedural highland cities
              float cityGridNoise = smoothstep(0.38, 0.44, snoise(vUv * 85.0)) * smoothstep(0.34, 0.44, snoise(vUv * 150.0));
              float secondaryLights = cityGridNoise * landMask;

              // 3. Stage 5 (0.70 - 0.90): Trade Routes connections (network corridors)
              float networkProgress = smoothstep(0.70, 0.90, uProgress);
              // Grid lines that act as a connecting transportation filaments
              float lineFilaments1 = smoothstep(0.395, 0.40, sin(vUv.x * 240.0) * cos(vUv.y * 240.0));
              float lineFilaments2 = smoothstep(0.392, 0.40, sin((vUv.x - vUv.y) * 180.0));
              float networks = max(lineFilaments1 * 0.35, lineFilaments2 * 0.45) * landMask;

              // Synthesize total light output
              vec3 warmCityColor = vec3(1.0, 0.72, 0.30); // Warm fragile gold lights
              float lightsIntensity = firstLightGlow * 12.0 * firstLightProgress +
                                      secondaryLights * 15.0 * secondaryProgress +
                                      networks * 8.0 * networkProgress;

              baseColor += warmCityColor * lightsIntensity * darkSideFactor;

              diffuseColor.rgb = baseColor;
              `
            );

            // Shading terminator transition shifts from deep sunset orange to gold
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <opaque_fragment>',
              `
              float ndots = dot(normalize(normal), uSunDirection);
              float terminator = smoothstep(0.18, -0.02, ndots) * smoothstep(-0.02, 0.08, ndots);
              outgoingLight += vec3(1.0, 0.60, 0.22) * terminator * 1.5;

              #include <opaque_fragment>
              `
            );
          }}
        />
      </mesh>

      {/* Cloud layer globe */}
      <mesh ref={cloudsRef} scale={[1.012, 1.012, 1.012]}>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          opacity={0.72}
          onBeforeCompile={(shader) => {
            shader.uniforms.uTime = uniformsRef.current.uTime;
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform float uTime;
              ${snoiseGLSL}
              `
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              vec2 cloudUv = vUv * 5.0 + vec2(uTime * 0.008, uTime * 0.003);
              float cloudNoise = snoise(cloudUv) * 0.5 + snoise(cloudUv * 2.5) * 0.25;
              float alpha = smoothstep(-0.05, 0.45, cloudNoise) * 0.8;

              diffuseColor.rgb = vec3(0.95, 0.96, 0.98);
              diffuseColor.a = alpha;
              `
            );
          }}
        />
      </mesh>
    </group>
  );
}

// 3. Small distant Earth that slide-pans into frame in Stage 6
function DistantEarth() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Load Earth texture
  const earthDiffuse = useTexture('/textures/earth_diffuse.png');
  earthDiffuse.wrapS = THREE.RepeatWrapping;
  earthDiffuse.minFilter = THREE.LinearMipmapLinearFilter;

  useFrame((state) => {
    if (meshRef.current) {
      // Earth spins slowly
      meshRef.current.rotation.y = 1.45 + state.clock.getElapsedTime() * 0.0012;
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      position={[55.0, 18.0, -1350.0]} 
      scale={[3.8, 3.8, 3.8]}
    >
      <sphereGeometry args={[1.0, 32, 32]} />
      <meshStandardMaterial
        map={earthDiffuse}
        roughness={0.75}
        metalness={0.05}
      />
    </mesh>
  );
}

// Main exporter component
export default function MarsLights() {
  const currentScene = useStore((state) => state.currentScene);
  const lightsProgress = useStore((state) => state.lightsProgress);

  const sunPos = useMemo(() => new THREE.Vector3(), []);

  // Calculate dynamic sunset sun vector based on lightsProgress (Stage 1 & 2)
  // Day-side Sun is at [-300, 80, -1500].
  // As lightsProgress goes from 0.0 to 0.45, the Sun rotates 150 degrees, moving to [300, 80, -1500] (casting dark shadow)
  useFrame(() => {
    const angle = mix(Math.PI, Math.PI * 2.15, Math.min(0.50, lightsProgress) / 0.50);
    const radius = 1500.0;
    sunPos.set(Math.cos(angle) * radius, 80.0, Math.sin(angle) * radius);
  });

  if (currentScene !== 'SCN_11') return null;

  // Sunset light dimming
  const daySunIntensity = mix(6.0, 0.05, Math.min(1.0, lightsProgress / 0.42));

  return (
    <group>
      {/* Dynamic atmospheric rim glow */}
      <AtmosphereGlow sunPos={sunPos} />

      {/* Dynamic sunlight */}
      <directionalLight
        position={sunPos}
        intensity={daySunIntensity}
        color="#fff0d8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Soft blue twilight fill light */}
      <ambientLight intensity={mix(0.04, 0.008, Math.min(1.0, lightsProgress / 0.5))} color="#080e21" />

      {/* Shaded terraformed Mars globe with city lights */}
      <TerraformedMars progress={lightsProgress} sunPos={sunPos} />

      {/* Small blue Earth sliding into view in stage 6 */}
      <DistantEarth />
    </group>
  );
}

// Helper interpolation method
function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}
