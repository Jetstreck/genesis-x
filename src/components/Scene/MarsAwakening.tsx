'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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

  float getGroundHeight(vec2 p) {
    float h = snoise(p * 0.18) * 0.16;   // dunes
    h += snoise(p * 0.7) * 0.028;       // ripples
    return h;
  }
`;

// 1. Shifting Sky Dome
function SkyDome({ progress }: { progress: number }) {
  const skyUniforms = useMemo(() => ({
    uColorHorizonDry: { value: new THREE.Color('#10131a') }, // Storm blue-gray
    uColorHorizonWet: { value: new THREE.Color('#7dd3fc') }, // Sky cyan-blue
    uColorZenithDry: { value: new THREE.Color('#050608') },
    uColorZenithWet: { value: new THREE.Color('#0f172a') },
    uProgress: { value: 0.0 },
    uTime: { value: 0.0 }
  }), []);

  useFrame((state) => {
    skyUniforms.uProgress.value = progress;
    skyUniforms.uTime.value = state.clock.getElapsedTime();
  });

  // Dome fades out during Stage 5 ascension (progress > 0.75)
  const opacity = progress > 0.75 ? Math.max(0.0, 1.0 - (progress - 0.75) / 0.10) : 1.0;

  return (
    <mesh scale={[100.0, 100.0, 100.0]} visible={opacity > 0.01}>
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
          uniform float uProgress;
          uniform float uTime;
          uniform float uOpacity;

          ${snoiseGLSL}

          void main() {
            vec3 dir = normalize(vWorldPosition);
            float factor = clamp(dir.y, 0.0, 1.0);

            vec3 colorHorizon = mix(uColorHorizonDry, uColorHorizonWet, uProgress);
            vec3 colorZenith = mix(uColorZenithDry, uColorZenithWet, uProgress);
            vec3 baseSky = mix(colorHorizon, colorZenith, pow(factor, 0.45));

            // Fading storm clouds, turning into large bright white cumulus layers
            vec2 cloudUv = vUv * 3.8 + vec2(uTime * 0.012, uTime * 0.003);
            float cloudNoise = snoise(cloudUv) * 0.5 + snoise(cloudUv * 2.5) * 0.25;

            float cloudDensity = smoothstep(0.4 - uProgress * 0.25, 0.8, cloudNoise);
            vec3 cloudColor = mix(vec3(0.04, 0.05, 0.07), vec3(0.92, 0.95, 0.98), uProgress);

            vec3 finalColor = mix(baseSky, cloudColor, cloudDensity * 0.65 * clamp(dir.y + 0.1, 0.0, 1.0));

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `}
        uniforms={{
          ...skyUniforms,
          uOpacity: { value: opacity }
        }}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// 2. Instanced Pine Trees (Stage 4 forests grow)
function ForestTrees({ progress }: { progress: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  const count = 300;
  const tempObject = new THREE.Object3D();

  // Create static positions on terrain dunes
  const treeData = useMemo(() => {
    const data = [];
    // Distribute trees around the edges of valleys
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.55 + Math.random() * 2.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      // Sample ground height
      const noiseVal = Math.sin(x * 2.0) * Math.cos(z * 2.0); // low lying area check
      const terrainHeight = (Math.sin(x * 0.18 * 20.0) * 0.16) + (Math.sin(x * 0.7 * 20.0) * 0.028); // dummy height
      
      const y = terrainHeight * 0.18 + 0.005; 
      
      // Randomize scales and rotations
      const scaleX = 0.016 + Math.random() * 0.012;
      const scaleY = 0.038 + Math.random() * 0.025;
      const rotY = Math.random() * Math.PI;

      data.push({ x, y, z, scaleX, scaleY, rotY });
    }
    return data;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;

    // Forests grow between 50% and 72% scroll
    const growthProgress = Math.max(0.0, Math.min(1.0, (progress - 0.50) / 0.22));

    treeData.forEach((tree, i) => {
      tempObject.position.set(tree.x, tree.y, tree.z);
      tempObject.rotation.set(0, tree.rotY, 0);

      // Scale height depending on growth progress
      const finalHeight = tree.scaleY * growthProgress;
      const finalWidth = tree.scaleX * Math.min(1.0, growthProgress * 1.5);
      tempObject.scale.set(finalWidth, finalHeight, finalWidth);
      
      tempObject.updateMatrix();
      meshRef.current?.setMatrixAt(i, tempObject.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Hide trees as the ground plane fades out (progress > 0.75)
  const isVisible = progress < 0.78;

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[null as any, null as any, count]} 
      visible={isVisible}
      castShadow
    >
      <coneGeometry args={[0.28, 1.0, 4]} />
      <meshStandardMaterial 
        color="#1b4332" // Pine green
        roughness={0.92} 
        flatShading
      />
    </instancedMesh>
  );
}

// 3. Sprouting Seed (still visible at the origin, blooming into a small bush)
function SproutingSeed({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Seed blooms and scales up as life expands
      const scaleVal = 1.15 + progress * 1.8;
      groupRef.current.scale.set(scaleVal, scaleVal, scaleVal);
      // Gentle wind breeze sway
      groupRef.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 2.0) * 0.05;
    }
  });

  const isVisible = progress < 0.78;

  return (
    <group ref={groupRef} position={[0.0, 0.05, 0.0]} visible={isVisible}>
      {/* Bioluminescent core */}
      <mesh castShadow>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.8} />
      </mesh>
      {/* Spreading leaves */}
      <mesh position={[0.01, 0.012, 0]} rotation={[0, 0, -0.6]} castShadow>
        <boxGeometry args={[0.005, 0.038, 0.02]} />
        <meshStandardMaterial color="#0891b2" roughness={0.1} />
      </mesh>
      <mesh position={[-0.01, 0.012, 0.004]} rotation={[0, 0, 0.6]} castShadow>
        <boxGeometry args={[0.005, 0.034, 0.02]} />
        <meshStandardMaterial color="#0891b2" roughness={0.1} />
      </mesh>
    </group>
  );
}

// 4. Ground Terrain Plane ( morphs clay -> rivers -> forests )
function AwakeningTerrain({ progress }: { progress: number }) {
  const terrainMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0.0 },
    uTime: { value: 0.0 }
  }), []);

  useFrame((state) => {
    uniforms.uProgress.value = progress;
    uniforms.uTime.value = state.clock.getElapsedTime();
  });

  // Terrain fades out during Stage 5 ascension (progress > 0.75)
  const opacity = progress > 0.75 ? Math.max(0.0, 1.0 - (progress - 0.75) / 0.05) : 1.0;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow visible={opacity > 0.01}>
      <planeGeometry args={[22, 22, 128, 128]} />
      <meshStandardMaterial
        ref={terrainMaterialRef}
        color="#180b07" // Deep wet brown mud baseline
        roughness={0.65}
        metalness={0.01}
        transparent
        opacity={opacity}
        onBeforeCompile={(shader) => {
          shader.uniforms.uProgress = uniforms.uProgress;
          shader.uniforms.uTime = uniforms.uTime;

          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            ${snoiseGLSL}
            `
          );

          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            float h = getGroundHeight(transformed.xy);
            transformed.z += h;
            `
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>
            ${snoiseGLSL}
            uniform float uProgress;
            uniform float uTime;
            `
          );

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

            normal = normalize(N_local - (T_local * dh_du + B_local * dh_dv) * 0.28);
            `
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            // Base procedurally wet muddy soil color
            float val = snoise(vUv * 12.0);
            vec3 colorWetRust = vec3(0.18, 0.09, 0.06); 
            vec3 colorWetDesert = vec3(0.24, 0.12, 0.09); 
            vec3 colorWetBasalt = vec3(0.07, 0.05, 0.05); 
            vec3 mudColor = mix(colorWetBasalt, colorWetRust, smoothstep(-0.4, 0.1, val));
            mudColor = mix(mudColor, colorWetDesert, smoothstep(0.1, 0.6, val));

            // Green moss/grass colors
            vec3 colorMoss = vec3(0.08, 0.22, 0.10); // Deep dark forest green
            vec3 colorGrass = vec3(0.15, 0.42, 0.18); // Rich light grass green
            vec3 grassColor = mix(colorMoss, colorGrass, smoothstep(-0.3, 0.5, val));

            // low lying valley index
            float lowVal = snoise(vUv * 2.8);

            // 1. Water spreads (Stage 1: progress 0.0 -> 0.20)
            float waterFill = smoothstep(0.0, 0.20, uProgress);
            float waterThreshold = -0.18 + waterFill * 0.18; // water level rises

            // 2. Green spreads around shores (Stage 2: progress 0.20 -> 0.50)
            float grassSpread = smoothstep(0.20, 0.50, uProgress);
            // Grass grows near water edges (lowVal between waterThreshold and threshold+0.35)
            float distanceToWater = lowVal - waterThreshold;
            float grassMask = smoothstep(0.42, 0.0, distanceToWater) * step(0.0, distanceToWater);
            // Blend in extra grass patch noises everywhere at Stage 4 forests (progress > 0.5)
            float forestNoise = snoise(vUv * 16.0);
            float generalGrassMask = smoothstep(0.50, 0.75, uProgress) * smoothstep(0.0, 0.5, forestNoise);
            
            float finalGrassFactor = clamp(grassMask * grassSpread + generalGrassMask * 0.85, 0.0, 1.0);

            vec3 baseGround = mix(mudColor, grassColor, finalGrassFactor);

            // Cloud Shadows
            vec2 windOffset = vec2(uTime * 0.015, uTime * 0.005);
            float shadowNoise = snoise((vUv * 1.5) + windOffset);
            float shadowFactor = mix(1.0, 0.58, smoothstep(0.0, 0.45, shadowNoise));
            baseGround *= shadowFactor;

            // Specular roughness
            float wetRoughness = mix(0.55, 0.90, finalGrassFactor); // Grass is rough, mud is slick

            if (lowVal < waterThreshold) {
              // Deep reflective blue ocean water
              vec3 waterColor = vec3(0.03, 0.04, 0.08);
              vec2 rippleUv = vUv * 64.0;
              float ripple = sin(rippleUv.x * 2.0 + uTime * 5.0) * cos(rippleUv.y * 2.0 + uTime * 4.0) * 0.12;

              diffuseColor.rgb = waterColor;
              roughnessFactor = 0.03;
              metalnessFactor = 0.88;
            } else {
              diffuseColor.rgb = baseGround;
              roughnessFactor = wetRoughness;
              metalnessFactor = 0.02;
            }
            `
          );
        }}
      />
    </mesh>
  );
}

// 5. High-Fidelity Atmosphere Outer Glow shell for planetary Hero Shot
function AtmosphereRimGlow({ progress }: { progress: number }) {
  const rimUniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#38bdf8') }, // Radiant cyan-blue atmosphere glow
    uSunPosition: { value: new THREE.Vector3(-300, 80, -1500) }
  }), []);

  // Rim glow fades in as camera ascends (progress > 0.72)
  const opacity = progress > 0.72 ? Math.min(1.0, (progress - 0.72) / 0.16) : 0.0;

  return (
    <mesh position={[0.0, 0.0, -1200.0]} scale={[61.2, 61.2, 61.2]} visible={opacity > 0.01}>
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
          uniform vec3 uColor;
          uniform vec3 uSunPosition;
          uniform float uOpacity;

          void main() {
            vec3 normal = normalize(vWorldNormal);
            vec3 toCamera = normalize(cameraPosition - vWorldPosition);
            vec3 toSun = normalize(uSunPosition - vWorldPosition);

            // Fresnel rim intensity
            float ndotv = dot(normal, toCamera);
            float rim = clamp(1.0 + ndotv, 0.0, 1.0);
            float rimGlow = pow(rim, 9.0); // Thick glowing halo shell
            float edgeFade = smoothstep(0.0, 0.04, rim);

            // Sunlight day/night fade
            float ndots = dot(normal, toSun);
            float daySide = smoothstep(-0.25, 0.25, ndots);

            // Additive glow
            gl_FragColor = vec4(uColor * rimGlow * edgeFade * (daySide * 0.6 + 0.4), rimGlow * edgeFade * uOpacity);
          }
        `}
        uniforms={{
          ...rimUniforms,
          uOpacity: { value: opacity }
        }}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// 6. Terraformed Planetary Sphere (The Hero Shot)
function TerraformedMars({ progress }: { progress: number }) {
  const marsRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const uniformsRef = useRef({
    uTime: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3() },
    uProgress: { value: 0.0 }
  });

  useFrame((state, delta) => {
    // Slowly rotate Mars to simulate orbital motion
    if (marsRef.current) {
      marsRef.current.rotation.y = 0.85 + progress * 0.03 + state.clock.getElapsedTime() * 0.0006;
      marsRef.current.rotation.z = -0.44; // Slanted axis
    }

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = 0.90 + progress * 0.045 + state.clock.getElapsedTime() * 0.001;
      cloudsRef.current.rotation.z = -0.44;
    }

    // Update uniform parameters
    uniformsRef.current.uTime.value = state.clock.getElapsedTime();
    uniformsRef.current.uProgress.value = progress;
    
    // Update view-space sun direction
    const sunPos = new THREE.Vector3(-300, 80, -1500);
    sunPos.applyMatrix4(state.camera.matrixWorldInverse).normalize();
    uniformsRef.current.uSunDirection.value.copy(sunPos);
  });

  // Planet sphere fades in during Stage 5 ascension (progress > 0.72)
  const opacity = progress > 0.72 ? Math.min(1.0, (progress - 0.72) / 0.16) : 0.0;

  return (
    <group position={[0.0, 0.0, -1200.0]} scale={[60.0, 60.0, 60.0]} visible={opacity > 0.01}>
      {/* Ground Shaded Globe */}
      <mesh ref={marsRef} castShadow receiveShadow>
        <sphereGeometry args={[1.0, 128, 128]} />
        <meshStandardMaterial
          roughness={0.94}
          metalness={0.02}
          transparent
          opacity={opacity}
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

              // WebGL Simplex 2D noise implementation
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
              `
            );

            // Specular highlighting on lakes/oceans (lower roughness, higher metalness)
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <roughnessmap_fragment>',
              `
              #include <roughnessmap_fragment>
              float h = getMarsHeight(vUv);
              // Oceans are regions below -0.05 height
              float waterMask = smoothstep(-0.02, -0.08, h);
              // Specular highlights on water (smooth = 0.05), rough land (0.85)
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

            // Dynamic color morphing in sphere fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              float h = getMarsHeight(vUv);

              // 1. Base dry Mars mineral palette
              vec3 colorBasalt = vec3(0.16, 0.12, 0.11); 
              vec3 colorRust = vec3(0.55, 0.24, 0.15);   
              vec3 colorHighlands = vec3(0.68, 0.36, 0.24); 
              vec3 dryColor = mix(colorBasalt, colorRust, smoothstep(-0.25, 0.05, h));
              dryColor = mix(dryColor, colorHighlands, smoothstep(0.05, 0.28, h));

              // 2. Terraformed palette: Blue Oceans, Green Forests, Green Highlands
              vec3 colorOcean = vec3(0.05, 0.15, 0.35); // Blue ocean
              vec3 colorForest = vec3(0.08, 0.38, 0.16); // Lush green trees
              vec3 colorLawn = vec3(0.24, 0.52, 0.22); // Highlands grass green
              vec3 colorPeak = vec3(0.48, 0.42, 0.38); // High mountains clay/basalt

              // Map colors based on altitude
              vec3 terraColor = mix(colorOcean, colorForest, smoothstep(-0.05, -0.02, h));
              terraColor = mix(terraColor, colorLawn, smoothstep(-0.02, 0.12, h));
              terraColor = mix(terraColor, colorPeak, smoothstep(0.12, 0.32, h));

              // Mix dry and terraformed planets based on progress [0.72 -> 0.90]
              float terraFraction = smoothstep(0.72, 0.90, uProgress);
              vec3 baseColor = mix(dryColor, terraColor, terraFraction);

              // 3. Polar Ice Caps (Water cycles to caps)
              float capProgress = mix(0.15, 0.35, terraFraction); // Ice caps swell and stabilize
              float northCap = smoothstep(0.85 - capProgress * 0.04, 0.88, vUv.y + 0.012 * snoise(vUv * 6.0));
              float southCap = smoothstep(0.15 + capProgress * 0.04, 0.12, vUv.y + 0.010 * snoise(vUv * 8.0));
              float polarCap = max(northCap, southCap);
              vec3 frostColor = vec3(0.95, 0.96, 0.98); 
              baseColor = mix(baseColor, frostColor, polarCap * 0.92);

              // 4. Subtle glowing auroras near poles (Stage 5/6: additive green/cyan aurora bands)
              float auroraBand = smoothstep(0.84, 0.86, abs(vUv.y - 0.5) * 2.0);
              float auroraPulse = 0.5 + 0.5 * sin(uTime * 1.5);
              vec3 auroraColor = vec3(0.1, 0.98, 0.65) * auroraPulse * 0.35 * terraFraction; // cyan-green auroral light
              baseColor += auroraColor * auroraBand;

              // 5. Twinkling Civilization Lights on the dark side (Stage 6 > 0.94)
              float ndots = dot(normalize(normal), uSunDirection);
              float darkSideFactor = smoothstep(0.04, -0.16, ndots); // Only visible on dark hemisphere
              float civProgress = smoothstep(0.94, 0.99, uProgress); // Swell lights

              // High frequency grid noise representing cities
              float cityGrid = smoothstep(0.38, 0.44, snoise(vUv * 90.0)) * smoothstep(0.32, 0.44, snoise(vUv * 160.0));
              vec3 cityLightsColor = vec3(1.0, 0.72, 0.32) * cityGrid * 15.0 * civProgress * darkSideFactor;
              baseColor += cityLightsColor;

              diffuseColor.rgb = baseColor;
              `
            );

            // Shaded planet terminator transition shifts from red to a crisp blue/gold atmosphere rim scattering
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <opaque_fragment>',
              `
              float ndots = dot(normalize(normal), uSunDirection);
              float terminator = smoothstep(0.18, -0.02, ndots) * smoothstep(-0.02, 0.08, ndots);
              
              // Shift terminator light scatter from red-orange to a beautiful golden rim light
              vec3 dryTerminator = vec3(0.15, 0.45, 0.95) * 0.85; // blue approach
              vec3 wetTerminator = vec3(1.0, 0.65, 0.28) * 1.6; // rich golden sun glow
              vec3 scatterColor = mix(dryTerminator, wetTerminator, smoothstep(0.72, 0.90, uProgress));

              outgoingLight += scatterColor * terminator;

              #include <opaque_fragment>
              `
            );
          }}
        />
      </mesh>

      {/* Volumetric Clouds sphere layer */}
      <mesh ref={cloudsRef} scale={[1.012, 1.012, 1.012]}>
        <sphereGeometry args={[1.0, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          opacity={opacity * 0.75}
          onBeforeCompile={(shader) => {
            shader.uniforms.uTime = uniformsRef.current.uTime;
            shader.uniforms.uProgress = uniformsRef.current.uProgress;

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform float uTime;
              uniform float uProgress;

              // Simplex 2D noise shader function
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
              `
            );

            // Create procedural swirling cloud coverage maps
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              vec2 cloudUv = vUv * 5.0 + vec2(uTime * 0.008, uTime * 0.003);
              float cloudNoise = fbm(cloudUv);

              // Clouds shift from dusty orange haze to white, swirling storm systems
              float densityThreshold = mix(0.12, -0.05, smoothstep(0.72, 0.90, uProgress));
              float alpha = smoothstep(densityThreshold, 0.45, cloudNoise) * 0.85;

              vec3 cloudBaseColor = mix(vec3(0.82, 0.65, 0.54), vec3(0.95, 0.96, 0.98), smoothstep(0.72, 0.90, uProgress));

              diffuseColor.rgb = cloudBaseColor;
              // Modulate alpha map
              diffuseColor.a = alpha * opacity;
              `
            );
          }}
        />
      </mesh>
    </group>
  );
}

// Main visual scene component exporter
export default function MarsAwakening() {
  const currentScene = useStore((state) => state.currentScene);
  const awakeningProgress = useStore((state) => state.awakeningProgress);

  if (currentScene !== 'SCN_10') return null;

  // Cinematic mood lighting: shifts from dim storm levels to warm, vibrant golden hour sunlight
  const lightIntensity = mix(0.42, 6.0, awakeningProgress);
  const lightColor = mixColor(new THREE.Color('#788ba3'), new THREE.Color('#fff0d8'), awakeningProgress);

  return (
    <group>
      {/* Sky Box dome */}
      <SkyDome progress={awakeningProgress} />

      {/* Main directional golden sunlight */}
      <directionalLight
        position={[-300, 80, -1500]}
        intensity={lightIntensity}
        color={lightColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Blue atmospheric bounce fill light */}
      <ambientLight intensity={mix(0.15, 0.04, awakeningProgress)} color="#0b172a" />

      {/* Sprouting Seed at origin */}
      <SproutingSeed progress={awakeningProgress} />

      {/* Instanced Forest Trees on ground dunes */}
      <ForestTrees progress={awakeningProgress} />

      {/* Morphed ground plane dunes */}
      <AwakeningTerrain progress={awakeningProgress} />

      {/* Detailed Terraformed Globe sphere (Ascension orbital reveal) */}
      <TerraformedMars progress={awakeningProgress} />

      {/* Atmospheric Scattering Glow Shell */}
      <AtmosphereRimGlow progress={awakeningProgress} />
    </group>
  );
}

// Helper linear interpolation for values
function mix(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function mixColor(start: THREE.Color, end: THREE.Color, progress: number) {
  return new THREE.Color().lerpColors(start, end, progress);
}
