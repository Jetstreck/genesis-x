'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

// Custom Atmosphere Material Shader
const AtmosphereShader = {
  uniforms: {
    uColor: { value: new THREE.Color('#0ea5e9') },
    uGlow: { value: 1.1 },
    uSunPosition: { value: new THREE.Vector3(-25, 5.8, -25) } // Align with the Sun's position
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
    uniform float uGlow;
    uniform vec3 uSunPosition;

    void main() {
      vec3 normal = normalize(vWorldNormal);
      vec3 toCamera = normalize(cameraPosition - vWorldPosition);
      vec3 toSun = normalize(uSunPosition - vWorldPosition);

      // Rim glow (fresnel): brightest at limb where normal is perpendicular to camera view
      // BackSide rendering means normal points away, so dot(normal, toCamera) is negative.
      // At limb, it's 0.0. At center, it's -1.0.
      float ndotv = dot(normal, toCamera);
      float rim = 1.0 + ndotv;
      
      // Power curves to control edge sharpness and falloff - increased to 8.0 for thinness
      float rimGlow = pow(max(0.0, rim), 8.0);
      float edgeFade = smoothstep(0.0, 0.04, rim); // tighter fade at the outer edge

      // Day vs Night side of the atmosphere
      float ndots = dot(normal, toSun);
      float daySide = smoothstep(-0.15, 0.15, ndots);

      // Sunset terminator transition (where ndots is close to 0)
      float sunsetFactor = smoothstep(0.25, 0.0, abs(ndots - 0.02));

      // Forward scattering (halo when looking towards the sun)
      float forwardScattering = max(0.0, -dot(toCamera, toSun));
      float halo = pow(forwardScattering, 6.0) * 2.5;

      // Mix atmosphere colors: base blue/cyan with golden sunset at the terminator
      vec3 baseAtmosphereColor = uColor;
      vec3 sunsetColor = vec3(1.0, 0.42, 0.1); // Delicate, deep golden sunset
      vec3 finalColor = mix(baseAtmosphereColor, sunsetColor, sunsetFactor * 0.8);

      // Combine components with 0.35 factor to make it thinner, realistic, and elegant
      float intensity = rimGlow * edgeFade * (daySide * 0.7 + halo * 2.5) * uGlow * 0.35;

      // Alpha controls transparency
      float alpha = rimGlow * edgeFade * (daySide * 0.5 + halo * 2.5) * uGlow * 0.35;

      gl_FragColor = vec4(finalColor * intensity, alpha);
    }
  `
};

export default function Atmosphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Subscribe to Zustand store changes
  const atmosphereColor = useStore((state) => state.atmosphereColor);
  const atmosphereGlow = useStore((state) => state.atmosphereGlow);

  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (materialRef.current) {
      // Update color and glow intensity in real time from store
      materialRef.current.uniforms.uColor.value.set(atmosphereColor);
      materialRef.current.uniforms.uGlow.value = atmosphereGlow;
    }
  });

  return (
    <mesh ref={meshRef} scale={[1.05, 1.05, 1.05]}>
      <sphereGeometry args={[2, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={AtmosphereShader.vertexShader}
        fragmentShader={AtmosphereShader.fragmentShader}
        uniforms={AtmosphereShader.uniforms}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        transparent={true}
        depthWrite={false}
      />
    </mesh>
  );
}
