'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

// Simplex 2D noise shader function for Mars surface generation
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

// Shared Atmosphere Glow shader component
function AtmosphereGlow({ position, scale, colorDay, colorTerminator, sunPos }: {
  position: [number, number, number];
  scale: [number, number, number];
  colorDay: string;
  colorTerminator: string;
  sunPos: THREE.Vector3;
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    uColorDay: { value: new THREE.Color(colorDay) },
    uColorTerminator: { value: new THREE.Color(colorTerminator) },
    uSunPosition: { value: new THREE.Vector3() }
  }), [colorDay, colorTerminator]);

  useFrame(() => {
    uniforms.uSunPosition.value.copy(sunPos);
  });

  return (
    <mesh ref={glowRef} position={position} scale={scale}>
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
            float rimGlow = pow(rim, 8.0);
            float edgeFade = smoothstep(0.0, 0.05, rim);

            // Sunset terminator glow index
            float ndots = dot(normal, toSun);
            float terminator = smoothstep(0.18, -0.02, ndots) * smoothstep(-0.02, 0.08, ndots);
            float daySide = smoothstep(-0.25, 0.25, ndots);

            vec3 atmColor = mix(uColorDay, uColorTerminator, terminator * 0.95);
            float intensity = rimGlow * edgeFade * (daySide * 0.4 + terminator * 1.5 + 0.1) * 0.85;

            gl_FragColor = vec4(atmColor * intensity, rimGlow * edgeFade * 0.8);
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

// Glowing curved line component representing paths of connection (filaments)
function HumanityFootprints({ reflectionProgress }: { reflectionProgress: number }) {
  const pointsRef = useRef<THREE.Group>(null);
  const opacity = useMemo(() => {
    return Math.max(0.0, Math.min(1.0, (reflectionProgress - 0.78) / 0.12));
  }, [reflectionProgress]);

  // Generate 6 beautiful bezier curves bridging the two worlds
  const linesData = useMemo(() => {
    const data = [];
    const marsPos = new THREE.Vector3(-25.0, 0.0, -1200.0);
    const earthPos = new THREE.Vector3(25.0, 0.0, -1200.0);

    const curvesCount = 6;
    for (let i = 0; i < curvesCount; i++) {
      // Calculate start and end coordinates on planetary spheres facing center
      const angleMars = (i / curvesCount) * Math.PI * 2;
      const angleEarth = ((i + 1) / curvesCount) * Math.PI * 2;
      
      const startPoint = new THREE.Vector3(
        marsPos.x + 12.0 * Math.cos(angleMars) * 0.25 + 11.5,
        marsPos.y + 12.0 * Math.sin(angleMars) * 0.6,
        marsPos.z + 12.0 * Math.cos(angleMars) * 0.6
      );

      const endPoint = new THREE.Vector3(
        earthPos.x - 12.0 * Math.cos(angleEarth) * 0.25 - 11.5,
        earthPos.y + 12.0 * Math.sin(angleEarth) * 0.6,
        earthPos.z + 12.0 * Math.cos(angleEarth) * 0.6
      );

      // Create a sweeping control point to bow the curve
      const heightOffset = 18.0 + (i % 3) * 8.0;
      const depthOffset = (i % 2 === 0 ? 1 : -1) * (12.0 + i * 5.0);
      const controlPoint = new THREE.Vector3(0.0, heightOffset, -1200.0 + depthOffset);

      const curve = new THREE.QuadraticBezierCurve3(startPoint, controlPoint, endPoint);
      const points = curve.getPoints(50);
      
      data.push({
        curve,
        points,
        speed: 0.12 + (i * 0.02),
        offset: i * 0.15
      });
    }
    return data;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current || opacity <= 0) return;
    
    const children = pointsRef.current.children;
    const elapsed = state.clock.getElapsedTime();

    linesData.forEach((line, idx) => {
      const dotMesh = children[idx] as THREE.Mesh;
      if (!dotMesh) return;
      
      // Animate dot coordinate along curve
      const t = (elapsed * line.speed + line.offset) % 1.0;
      const pos = line.curve.getPointAt(t);
      dotMesh.position.copy(pos);
    });
  });

  if (opacity <= 0) return null;

  return (
    <group>
      {/* Background trade/exploration filaments */}
      {linesData.map((line, idx) => (
        <line key={`line-${idx}`}>
          <bufferGeometry attach="geometry" onUpdate={(geom) => geom.setFromPoints(line.points)} />
          <lineBasicMaterial 
            attach="material" 
            color="#22d3ee" 
            transparent 
            opacity={opacity * 0.18} 
            linewidth={1}
          />
        </line>
      ))}

      {/* Animated glowing dots representing humanity's transit / messages */}
      <group ref={pointsRef}>
        {linesData.map((_, idx) => (
          <mesh key={`dot-${idx}`}>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshBasicMaterial 
              color={[15.0, 10.0, 3.5]} // bright glowing gold
              toneMapped={false}
              transparent
              opacity={opacity * 0.9} 
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Main exporter component
export default function MarsReflection() {
  const currentScene = useStore((state) => state.currentScene);
  const reflectionProgress = useStore((state) => state.reflectionProgress);
  const mousePosition = useStore((state) => state.mousePosition);

  // Rotation parameters
  const mouseRotRef = useRef(0);
  const marsRef = useRef<THREE.Mesh>(null);
  const marsCloudsRef = useRef<THREE.Mesh>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  const earthCloudsRef = useRef<THREE.Mesh>(null);

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

  // Calculate sun position in SCN_12 (gives soft, uniform illumination from left-front)
  const sunPos = useMemo(() => new THREE.Vector3(-45.0, 15.0, -1120.0), []);

  const uniformsRef = useRef({
    uTime: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3() },
    uProgress: { value: 1.0 } // Mars is fully terraformed in SCN_12
  });

  useFrame((state, delta) => {
    if (currentScene !== 'SCN_12') return;

    const t = state.clock.getElapsedTime();
    uniformsRef.current.uTime.value = t;

    // View-space sun direction updates
    const sunDir = sunPos.clone().applyMatrix4(state.camera.matrixWorldInverse).normalize();
    uniformsRef.current.uSunDirection.value.copy(sunDir);

    // Synchronized mouse movement rotations
    // Map mouse X (-1.0 to 1.0) to rotation.
    const targetMouseRotY = mousePosition.x * Math.PI * 0.45;
    mouseRotRef.current = THREE.MathUtils.lerp(mouseRotRef.current, targetMouseRotY, 0.05);

    // Apply rotations
    const baseMarsRot = 0.55 + t * 0.0006;
    if (marsRef.current) {
      marsRef.current.rotation.y = baseMarsRot + mouseRotRef.current;
      marsRef.current.rotation.z = -0.44; // match axis slant
    }
    if (marsCloudsRef.current) {
      marsCloudsRef.current.rotation.y = baseMarsRot + t * 0.0004 + mouseRotRef.current;
      marsCloudsRef.current.rotation.z = -0.44;
    }

    const baseEarthRot = 1.6 + t * 0.0008;
    if (earthRef.current) {
      earthRef.current.rotation.y = baseEarthRot + mouseRotRef.current;
      earthRef.current.rotation.z = 0.4;
    }
    if (earthCloudsRef.current) {
      earthCloudsRef.current.rotation.y = baseEarthRot + t * 0.0005 + mouseRotRef.current;
      earthCloudsRef.current.rotation.z = 0.4;
    }
  });

  if (currentScene !== 'SCN_12') return null;

  return (
    <group>
      {/* Dynamic atmospheric rim glows */}
      <AtmosphereGlow 
        position={[-25.0, 0.0, -1200.0]} 
        scale={[12.24, 12.24, 12.24]} 
        colorDay="#38bdf8" 
        colorTerminator="#ea580c" 
        sunPos={sunPos} 
      />
      <AtmosphereGlow 
        position={[25.0, 0.0, -1200.0]} 
        scale={[12.24, 12.24, 12.24]} 
        colorDay="#0ea5e9" 
        colorTerminator="#fdba74" 
        sunPos={sunPos} 
      />

      {/* Main lights for SCN_12 */}
      <directionalLight
        position={sunPos}
        intensity={6.0}
        color="#fffaf0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <ambientLight intensity={0.008} color="#080e21" />

      {/* --------------------------------------------------- */}
      {/* 1. TERRAFORMED MARS (LEFT) */}
      {/* --------------------------------------------------- */}
      <group position={[-25.0, 0.0, -1200.0]} scale={[12.0, 12.0, 12.0]}>
        <mesh ref={marsRef} castShadow receiveShadow>
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

                // Full civilization lights (SCN_12 climax)
                float landMask = step(-0.02, h);
                float cityGridNoise = smoothstep(0.38, 0.44, snoise(vUv * 85.0)) * smoothstep(0.34, 0.44, snoise(vUv * 150.0));
                float secondaryLights = cityGridNoise * landMask;

                // Trade Route connections (filaments)
                float lineFilaments1 = smoothstep(0.395, 0.40, sin(vUv.x * 240.0) * cos(vUv.y * 240.0));
                float lineFilaments2 = smoothstep(0.392, 0.40, sin((vUv.x - vUv.y) * 180.0));
                float networks = max(lineFilaments1 * 0.35, lineFilaments2 * 0.45) * landMask;

                // First colony beacon
                vec2 firstLightCoord = vec2(0.48, 0.52);
                float firstLightGlow = smoothstep(0.022, 0.0, distance(vUv, firstLightCoord));

                vec3 warmCityColor = vec3(1.0, 0.75, 0.35); // Warm gold lights
                float lightsIntensity = firstLightGlow * 12.0 + secondaryLights * 15.0 + networks * 8.0;

                baseColor += warmCityColor * lightsIntensity * darkSideFactor;

                diffuseColor.rgb = baseColor;
                `
              );

              // Glowing sunset terminator
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

        {/* Mars Cloud sphere */}
        <mesh ref={marsCloudsRef} scale={[1.012, 1.012, 1.012]}>
          <sphereGeometry args={[1.0, 64, 64]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
            opacity={0.7}
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

      {/* --------------------------------------------------- */}
      {/* 2. BEAUTIFUL EARTH (RIGHT) */}
      {/* --------------------------------------------------- */}
      <group position={[25.0, 0.0, -1200.0]} scale={[12.0, 12.0, 12.0]}>
        <mesh ref={earthRef} castShadow receiveShadow>
          <sphereGeometry args={[1.0, 64, 64]} />
          <meshStandardMaterial
            map={earthDiffuse}
            normalMap={earthNormal}
            normalScale={new THREE.Vector2(1.2, 1.2)}
            roughness={0.7}
            metalness={0.05}
            onBeforeCompile={(shader) => {
              shader.uniforms.uSunDirection = uniformsRef.current.uSunDirection;
              
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform vec3 uSunDirection;
                `
              );
              
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `
                #include <roughnessmap_fragment>
                vec4 earthTexel = texture2D( map, vMapUv );
                float oceanMask = smoothstep(0.12, 0.03, earthTexel.r);
                roughnessFactor = mix(0.9, 0.15, oceanMask);
                `
              );

              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <metalnessmap_fragment>',
                `
                #include <metalnessmap_fragment>
                vec4 earthTexel2 = texture2D( map, vMapUv );
                float oceanMask2 = smoothstep(0.12, 0.03, earthTexel2.r);
                metalnessFactor = mix(0.02, 0.75, oceanMask2);
                `
              );

              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                `
                float ndots = dot(normalize(normal), uSunDirection);
                float terminator = smoothstep(0.16, -0.04, ndots) * smoothstep(-0.04, 0.08, ndots);
                // Glowing golden terminator ring on Earth as well
                outgoingLight += vec3(1.0, 0.40, 0.12) * terminator * 0.95;
                
                #include <opaque_fragment>
                `
              );
            }}
          />
        </mesh>

        {/* Earth Cloud sphere */}
        <mesh ref={earthCloudsRef} scale={[1.015, 1.015, 1.015]}>
          <sphereGeometry args={[1.0, 64, 64]} />
          <meshStandardMaterial
            map={earthClouds}
            alphaMap={earthClouds}
            transparent={true}
            depthWrite={false}
            blending={THREE.NormalBlending}
            opacity={0.75}
          />
        </mesh>
      </group>

      {/* --------------------------------------------------- */}
      {/* 3. METAPHORICAL EXPLORATION FILAMENTS */}
      {/* --------------------------------------------------- */}
      <HumanityFootprints reflectionProgress={reflectionProgress} />
    </group>
  );
}
