'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

// Custom Rayleigh & Mie scattering shader for thin Martian atmosphere
const MarsAtmosphereShader = {
  uniforms: {
    uColor: { value: new THREE.Color('#c26a50') }, // Dusty Mars atmosphere color
    uSunPosition: { value: new THREE.Vector3(-300, 80, -1500) } // Position of the Sun behind Mars
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vWorldNormal;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vWorldNormal = normalize(modelMatrix * vec4(normal, 0.0)).xyz;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vWorldNormal;

    uniform vec3 uColor;
    uniform vec3 uSunPosition;

    void main() {
      vec3 normal = normalize(vWorldNormal);
      vec3 toCamera = normalize(cameraPosition - vWorldPosition);
      vec3 toSun = normalize(uSunPosition - vWorldPosition);

      // Fresnel edge glow
      float ndotv = dot(normal, toCamera);
      float rim = 1.0 + ndotv;
      
      // Pow curve to make Martian atmosphere thin and crisp
      float rimGlow = pow(max(0.0, rim), 11.0);
      float edgeFade = smoothstep(0.0, 0.05, rim);

      // Light/shadow side of the planet
      float ndots = dot(normal, toSun);
      float daySide = smoothstep(-0.2, 0.2, ndots);

      // Sunset terminator transition (gives Martian blue sunsets!)
      float sunsetFactor = smoothstep(0.2, 0.0, abs(ndots - 0.01));

      // Forward scattering halo
      float forwardScattering = max(0.0, -dot(toCamera, toSun));
      float halo = pow(forwardScattering, 5.0) * 2.0;

      // Base atmosphere is dusty orange-red, sunset is blue scattering
      vec3 baseAtmosphereColor = uColor;
      vec3 sunsetColor = vec3(0.2, 0.48, 0.95); // Deep blue sunset scattering
      vec3 finalColor = mix(baseAtmosphereColor, sunsetColor, sunsetFactor * 0.9);

      // Combine factors
      float intensity = rimGlow * edgeFade * (daySide * 0.6 + halo * 2.2) * 0.32;
      float alpha = rimGlow * edgeFade * (daySide * 0.4 + halo * 2.2) * 0.32;

      gl_FragColor = vec4(finalColor * intensity, alpha);
    }
  `
};

export default function MarsApproach() {
  const marsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const currentScene = useStore((state) => state.currentScene);
  const approachProgress = useStore((state) => state.approachProgress);

  const uniformsRef = useRef({
    uTime: { value: 0.0 },
    uSunDirection: { value: new THREE.Vector3() }
  });

  useFrame((state, delta) => {
    if (currentScene !== 'SCN_06') return;

    // Slowly rotate Mars to simulate orbital motion
    if (marsRef.current) {
      marsRef.current.rotation.y = 0.85 + approachProgress * 0.04 + state.clock.getElapsedTime() * 0.0006;
      // Slanted polar tilt (25.19 degrees)
      marsRef.current.rotation.z = -0.44;
    }

    // Update uniform parameters
    uniformsRef.current.uTime.value = state.clock.getElapsedTime();
    
    // Update view-space sun direction relative to camera
    const sunPos = new THREE.Vector3(-300, 80, -1500);
    sunPos.applyMatrix4(state.camera.matrixWorldInverse).normalize();
    uniformsRef.current.uSunDirection.value.copy(sunPos);
  });

  if (currentScene !== 'SCN_06') return null;

  return (
    <group position={[0.0, 0.0, -1200.0]} scale={[60.0, 60.0, 60.0]}>
      {/* High-Fidelity Mars Sphere */}
      <mesh ref={marsRef} castShadow receiveShadow>
        <sphereGeometry args={[1.0, 128, 128]} />
        <meshStandardMaterial
          roughness={0.94}
          metalness={0.02}
          onBeforeCompile={(shader) => {
            // Inject uniforms
            shader.uniforms.uTime = uniformsRef.current.uTime;
            shader.uniforms.uSunDirection = uniformsRef.current.uSunDirection;

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform float uTime;
              uniform vec3 uSunDirection;

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

              // Fractal noise (fBm)
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

              // Procedural Mars heightmap
              float getMarsHeight(vec2 uv) {
                // Large scale highlands/lowlands
                float base = fbm(uv * 3.8) * 0.35;
                
                // Medium scale detail
                float detail = fbm(uv * 12.0) * 0.07;
                
                // Small scale craters
                float crater = snoise(uv * 24.0);
                float craterH = smoothstep(0.38, 0.45, abs(crater)) * 0.035;

                // Valles Marineris Canyon system (curved equatorial slash)
                float canyonCenter = 0.48 + 0.026 * sin(uv.x * 10.0) + 0.01 * sin(uv.x * 25.0);
                float distToCanyon = abs(uv.y - canyonCenter);
                float longMask = smoothstep(0.20, 0.28, uv.x) * smoothstep(0.58, 0.50, uv.x);
                float canyonDepth = smoothstep(0.038, 0.003, distToCanyon) * longMask;

                return base + detail - craterH - canyonDepth * 0.32;
              }
              `
            );

            // Perturb normal in fragment shader using heightmap derivatives
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <normal_fragment_begin>',
              `
              #include <normal_fragment_begin>

              float eps = 0.0012;
              float hC = getMarsHeight(vUv);
              float hU = getMarsHeight(vUv + vec2(eps, 0.0));
              float hV = getMarsHeight(vUv + vec2(0.0, eps));
              float dh_du = (hU - hC) / eps;
              float dh_dv = (hV - hC) / eps;

              // Tangent/Bitangent calculation relative to view-space sphere normal
              vec3 N_local = normalize(normal);
              vec3 T_local = normalize(cross(N_local, vec3(0.0, 1.0, 0.0)));
              if (length(T_local) < 0.01) {
                T_local = normalize(cross(N_local, vec3(1.0, 0.0, 0.0)));
              }
              vec3 B_local = cross(N_local, T_local);

              // Perturb normal
              normal = normalize(N_local - (T_local * dh_du + B_local * dh_dv) * 1.8);
              `
            );

            // Assign base procedural colors
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `
              float h = getMarsHeight(vUv);

              // Martian mineral palette
              vec3 colorBasalt = vec3(0.16, 0.12, 0.11); // Dark volcanic basalt plains
              vec3 colorRust = vec3(0.55, 0.24, 0.15);   // Dusty terracotta iron-oxide
              vec3 colorHighlands = vec3(0.68, 0.36, 0.24); // Terracotta sand dunes/highlands

              // Blend colors based on height
              vec3 baseColor = mix(colorBasalt, colorRust, smoothstep(-0.25, 0.05, h));
              baseColor = mix(baseColor, colorHighlands, smoothstep(0.05, 0.28, h));

              // Color Valles Marineris canyon interiors
              float canyonCenter = 0.48 + 0.026 * sin(vUv.x * 10.0) + 0.01 * sin(vUv.x * 25.0);
              float distToCanyon = abs(vUv.y - canyonCenter);
              float longMask = smoothstep(0.20, 0.28, vUv.x) * smoothstep(0.58, 0.50, vUv.x);
              float canyonDepth = smoothstep(0.038, 0.003, distToCanyon) * longMask;
              vec3 colorCanyonFloor = vec3(0.08, 0.06, 0.05); // Dark basalt shadows
              baseColor = mix(baseColor, colorCanyonFloor, canyonDepth * 0.9);

              // Add North and South Polar Ice Caps
              float northCap = smoothstep(0.85, 0.88, vUv.y + 0.015 * snoise(vUv * 6.0));
              float southCap = smoothstep(0.15, 0.12, vUv.y + 0.012 * snoise(vUv * 8.0));
              float polarCap = max(northCap, southCap);
              vec3 frostColor = vec3(0.92, 0.94, 0.98); // Carbon dioxide ice cap
              baseColor = mix(baseColor, frostColor, polarCap * 0.92);

              // Add moving atmospheric dust clouds
              vec2 cloudUv = vUv * 4.5 + vec2(uTime * 0.005, uTime * 0.002);
              float cloudNoise = fbm(cloudUv);
              float cloudMask = smoothstep(0.05, 0.45, cloudNoise) * 0.26;
              vec3 cloudColor = vec3(0.82, 0.65, 0.54); // Pale copper dust clouds
              baseColor = mix(baseColor, cloudColor, cloudMask);

              diffuseColor.rgb = baseColor;
              `
            );

            // Add Martian atmospheric blue sunset along the terminator edge
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <opaque_fragment>',
              `
              float ndots = dot(normalize(normal), uSunDirection);
              
              // Define sunset terminator boundary
              float terminator = smoothstep(0.18, -0.02, ndots) * smoothstep(-0.02, 0.08, ndots);
              
              // Inject glowing Martian blue sunset light scattering
              outgoingLight += vec3(0.15, 0.45, 0.95) * terminator * 0.85;

              #include <opaque_fragment>
              `
            );
          }}
        />
      </mesh>

      {/* Thin Martian Atmosphere Glow */}
      <mesh ref={atmosphereRef} scale={[1.018, 1.018, 1.018]}>
        <sphereGeometry args={[1.0, 64, 64]} />
        <shaderMaterial
          vertexShader={MarsAtmosphereShader.vertexShader}
          fragmentShader={MarsAtmosphereShader.fragmentShader}
          uniforms={MarsAtmosphereShader.uniforms}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent={true}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
