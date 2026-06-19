'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

// WebGL Simplex 2D noise implementation for procedural terrain
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

// 1. Procedural Footprint Decal component
function Footprint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <mesh position={[0.0, 0.003, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.22, 0.4]} />
      <meshStandardMaterial
        color="#32140d"
        transparent
        opacity={0.8}
        roughness={0.98}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>
            
            // Simplex noise in decal
            float snoise(vec2 v){
              return sin(v.x * 2.0) * cos(v.y * 2.0); // simple fast checker for patterns
            }
            `
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            vec2 localUv = vUv;
            
            // Distance oval mask representing the shape of the astronaut boot sole
            vec2 cUv = (localUv - vec2(0.5)) * vec2(1.0, 0.52);
            float d = length(cUv);
            float shapeMask = smoothstep(0.24, 0.20, d);
            
            // Horizontal shoe tread pattern lines
            float treads = step(0.32, sin(localUv.y * 36.0));
            
            // Heel indentation division
            float heelDivider = step(0.4, localUv.y) * step(localUv.y, 0.45);
            float finalTreads = treads * (1.0 - heelDivider);
            
            float intensity = shapeMask * (0.55 + finalTreads * 0.45);
            
            // Mix dark shadowed compressed sand with reddish base sand
            diffuseColor.rgb = mix(vec3(0.55, 0.24, 0.15), vec3(0.12, 0.06, 0.05), intensity);
            diffuseColor.a = intensity * 0.85;
            `
          );
        }}
      />
    </mesh>
  );
}

// 2. Animated Astronaut Boot component
function AstronautBoot() {
  const bootRef = useRef<THREE.Group>(null);
  const footfallProgress = useStore((state) => state.footfallProgress);

  useFrame(() => {
    if (!bootRef.current) return;

    // Local positions and rotations based on keyframe progress
    const bootPos = new THREE.Vector3(0.25, 2.0, -0.2);
    const bootRot = new THREE.Vector3(-0.35, -0.1, -0.25);

    if (footfallProgress < 0.35) {
      bootPos.set(0.25, 2.0, -0.2);
    } else if (footfallProgress >= 0.35 && footfallProgress <= 0.48) {
      const t = (footfallProgress - 0.35) / 0.13;
      const easeT = t * t * (3.0 - 2.0 * t);
      bootPos.lerpVectors(new THREE.Vector3(0.25, 1.8, -0.2), new THREE.Vector3(0.0, 0.0, -0.4), easeT);
      bootRot.lerpVectors(new THREE.Vector3(-0.35, -0.1, -0.25), new THREE.Vector3(0.0, 0.0, 0.0), easeT);
    } else if (footfallProgress > 0.48 && footfallProgress <= 0.55) {
      bootPos.set(0.0, 0.0, -0.4);
      bootRot.set(0.0, 0.0, 0.0);
    } else if (footfallProgress > 0.55 && footfallProgress <= 0.70) {
      const t = (footfallProgress - 0.55) / 0.15;
      const easeT = t * t * (3.0 - 2.0 * t);
      bootPos.lerpVectors(new THREE.Vector3(0.0, 0.0, -0.4), new THREE.Vector3(-0.25, 1.8, -0.6), easeT);
      bootRot.lerpVectors(new THREE.Vector3(0.0, 0.0, 0.0), new THREE.Vector3(0.2, 0.1, 0.1), easeT);
    } else {
      bootPos.set(-0.25, 2.0, -0.6);
      bootRot.set(0.2, 0.1, 0.1);
    }

    bootRef.current.position.copy(bootPos);
    bootRef.current.rotation.set(bootRot.x, bootRot.y, bootRot.z);
  });

  return (
    <group ref={bootRef} scale={[0.13, 0.13, 0.13]}>
      {/* Sole: thick rubber tread block */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.22, 2.3]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.96} />
      </mesh>
      {/* Fabric foot shell: space dust color */}
      <mesh position={[0, 0.45, 0.25]} castShadow>
        <boxGeometry args={[1.1, 0.7, 2.0]} />
        <meshStandardMaterial color="#dfdfdf" roughness={0.85} />
      </mesh>
      {/* Rounded Toe Cap */}
      <mesh position={[0, 0.35, 1.1]} castShadow>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial color="#cdcdcd" roughness={0.8} />
      </mesh>
      {/* Suit Ankle Cylinder leg shaft */}
      <mesh position={[0, 1.15, -0.2]} castShadow>
        <cylinderGeometry args={[0.54, 0.54, 1.4, 16]} />
        <meshStandardMaterial color="#eaeaea" roughness={0.8} />
      </mesh>
      {/* Ankle lock buckle rings (Golden-brass reflection) */}
      <mesh position={[0.55, 0.55, 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.08, 8]} />
        <meshStandardMaterial color="#c5a059" metalness={0.9} roughness={0.15} />
      </mesh>
      <mesh position={[-0.55, 0.55, 0.55]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.08, 8]} />
        <meshStandardMaterial color="#c5a059" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  );
}

// 3. Drifting Dust particles system
function DustParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 150;
  
  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8.0;
      pos[i * 3 + 1] = Math.random() * 2.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8.0;
      spd[i] = 0.15 + Math.random() * 0.25;
    }
    return [pos, spd];
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      const geo = pointsRef.current.geometry;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        let x = posAttr.getX(i) - speeds[i] * delta;
        let y = posAttr.getY(i) + Math.sin(state.clock.getElapsedTime() * 0.4 + i) * 0.04 * delta;
        let z = posAttr.getZ(i);
        
        if (x < -4.0) x = 4.0;
        posAttr.setXYZ(i, x, y, z);
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#c86d52"
        size={0.016}
        transparent
        opacity={0.28}
        sizeAttenuation
      />
    </points>
  );
}

// 4. Sky Dome showing Mars twilight horizon-to-zenith color gradient
function SkyDome() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const skyUniforms = useMemo(() => ({
    uColorHorizon: { value: new THREE.Color('#381008') }, // Dusty orange-pink horizon
    uColorZenith: { value: new THREE.Color('#010103') }   // Indigo space background
  }), []);

  return (
    <mesh ref={meshRef} scale={[100.0, 100.0, 100.0]}>
      <sphereGeometry args={[1.0, 32, 32]} />
      <shaderMaterial
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPosition;
          uniform vec3 uColorHorizon;
          uniform vec3 uColorZenith;

          void main() {
            vec3 dir = normalize(vWorldPosition);
            // vertical gradient index from horizon (y=0) to zenith (y=1)
            float factor = clamp(dir.y, 0.0, 1.0);
            vec3 skyColor = mix(uColorHorizon, uColorZenith, pow(factor, 0.55));
            gl_FragColor = vec4(skyColor, 1.0);
          }
        `}
        uniforms={skyUniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// 5. Main visual component
export default function MarsSurface() {
  const currentScene = useStore((state) => state.currentScene);
  const footfallProgress = useStore((state) => state.footfallProgress);

  const footprintVisible = footfallProgress >= 0.48;

  if (currentScene !== 'SCN_07') return null;

  return (
    <group>
      {/* Sky environment dome */}
      <SkyDome />

      {/* Earth star in sky (tiny, glowing blue star, backlit to camera during Stage 4 tilt-up) */}
      <mesh position={[8.0, 12.0, -22.0]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={[0.4, 1.0, 4.0]} toneMapped={false} />
      </mesh>

      {/* Atmospheric dust particles */}
      <DustParticles />

      {/* Landing Site Terrain Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20, 128, 128]} />
        <meshStandardMaterial
          color="#55240f"
          roughness={0.98}
          metalness={0.01}
          onBeforeCompile={(shader) => {
            // Inject Simplex Noise
            shader.vertexShader = shader.vertexShader.replace(
              '#include <common>',
              `
              #include <common>
              ${snoiseGLSL}
              `
            );

            // Displace geometry heights dynamically in vertex shader to form dunes
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `
              #include <begin_vertex>
              float h = getGroundHeight(transformed.xy);
              transformed.z += h;
              `
            );

            // Inject fragment variables
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              ${snoiseGLSL}
              `
            );

            // Calculate exact perturbed normals corresponding to displaced heights
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <normal_fragment_begin>',
              `
              #include <normal_fragment_begin>
              
              float eps = 0.008;
              float hC = getGroundHeight(vUv * 20.0);
              float hU = getGroundHeight(vUv * 20.0 + vec2(eps, 0.0));
              float hV = getGroundHeight(vUv * 20.0 + vec2(0.0, eps));
              float dh_du = (hU - hC) / eps;
              float dh_dv = (hV - hC) / eps;

              vec3 N_local = normalize(normal);
              vec3 T_local = normalize(cross(N_local, vec3(0.0, 1.0, 0.0)));
              if (length(T_local) < 0.01) {
                T_local = normalize(cross(N_local, vec3(1.0, 0.0, 0.0)));
              }
              vec3 B_local = cross(N_local, T_local);

              normal = normalize(N_local - (T_local * dh_du + B_local * dh_dv) * 0.7);
              `
            );

            // Apply procedural surface colors (sandy vs basaltic dust)
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              float val = snoise(vUv * 15.0);
              vec3 colorRust = vec3(0.55, 0.24, 0.15); // standard red dust
              vec3 colorDesert = vec3(0.68, 0.32, 0.22); // lighter wind ripples
              vec3 colorBasalt = vec3(0.18, 0.11, 0.10); // dark flat basalt regions

              vec3 baseColor = mix(colorBasalt, colorRust, smoothstep(-0.4, 0.1, val));
              baseColor = mix(baseColor, colorDesert, smoothstep(0.1, 0.6, val));

              diffuseColor.rgb = baseColor;
              `
            );
          }}
        />
      </mesh>

      {/* Procedural Footprint Decal */}
      <Footprint visible={footprintVisible} />

      {/* Animated Spacesuit Boot */}
      <AstronautBoot />
    </group>
  );
}
