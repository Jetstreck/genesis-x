'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';

export default function Earth() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Subscribe to store states
  const isRotating = useStore((state) => state.isRotating);
  const rotationSpeed = useStore((state) => state.rotationSpeed);
  const cloudsSpeed = useStore((state) => state.cloudsSpeed);
  const updateCoordinates = useStore((state) => state.updateCoordinates);

  const uniformsRef = useRef({
    uSunDirection: { value: new THREE.Vector3() }
  });

  // Load textures
  const [diffuseMap, normalMap, cloudsMap] = useTexture([
    '/textures/earth_diffuse.png',
    '/textures/earth_normal.png',
    '/textures/earth_clouds.png',
  ]);

  // Configure texture parameters for clean wrapping and filtering
  [diffuseMap, normalMap, cloudsMap].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
  });

  useFrame((state, delta) => {
    // Update view-space sun direction uniform
    const sunPos = new THREE.Vector3(-25, 5.8, -25);
    sunPos.applyMatrix4(state.camera.matrixWorldInverse).normalize();
    uniformsRef.current.uSunDirection.value.copy(sunPos);

    if (!isRotating) return;

    // Standardize rotation per frame based on delta time
    const baseRotation = rotationSpeed * delta;
    
    if (earthRef.current) {
      earthRef.current.rotation.y += baseRotation;
      
      // Calculate fake real-time orbital coordinates for HUD based on rotation
      const rawLong = -((earthRef.current.rotation.y * (180 / Math.PI)) % 360);
      const longitude = rawLong < -180 ? rawLong + 360 : rawLong > 180 ? rawLong - 360 : rawLong;
      const latitude = 28.5721 + Math.sin(state.clock.getElapsedTime() * 0.05) * 5.0; // slight orbital wobble
      
      updateCoordinates(latitude, longitude);
    }

    if (cloudsRef.current) {
      // Rotate clouds slightly faster than the Earth to simulate atmosphere circulation
      cloudsRef.current.rotation.y += baseRotation * cloudsSpeed;
      // Also apply a very minor tilt wobble for cloud movement realism
      cloudsRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.01) * 0.05;
    }
  });

  return (
    <group>
      {/* Base Earth Sphere */}
      <mesh ref={earthRef} castShadow receiveShadow scale={[1, 1, 1]}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={diffuseMap}
          normalMap={normalMap}
          normalScale={new THREE.Vector2(1.2, 1.2)}
          roughness={0.7}
          metalness={0.05}
          onBeforeCompile={(shader) => {
            // Pass the custom uniform
            shader.uniforms.uSunDirection = uniformsRef.current.uSunDirection;
            
            // Declare the uniform in GLSL code
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `
              #include <common>
              uniform vec3 uSunDirection;
              `
            );
            
            // 1. Specular highlight on oceans (lower roughness)
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <roughnessmap_fragment>',
              `
              #include <roughnessmap_fragment>
              vec4 earthTexel = texture2D( map, vMapUv );
              // Oceans are dark blue/black (low red channel value)
              float oceanMask = smoothstep(0.12, 0.03, earthTexel.r);
              // Ocean is smooth (roughness = 0.15), land is rough (0.9)
              roughnessFactor = mix(0.9, 0.15, oceanMask);
              `
            );

            // 2. Specular highlight on oceans (higher metalness to catch sun glint)
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <metalnessmap_fragment>',
              `
              #include <metalnessmap_fragment>
              vec4 earthTexel2 = texture2D( map, vMapUv );
              float oceanMask2 = smoothstep(0.12, 0.03, earthTexel2.r);
              metalnessFactor = mix(0.02, 0.75, oceanMask2);
              `
            );

            // 3. Golden sunset glow along the terminator line
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <opaque_fragment>',
              `
              // Angle between normal and view-space sun direction
              float ndots = dot(normalize(normal), uSunDirection);
              
              // Define the sunset terminator zone
              float terminator = smoothstep(0.16, -0.04, ndots) * smoothstep(-0.04, 0.08, ndots);
              
              // Inject glowing golden-orange sunset color into the outgoing light
              outgoingLight += vec3(1.0, 0.40, 0.12) * terminator * 0.95;
              
              #include <opaque_fragment>
              `
            );
          }}
        />
      </mesh>

      {/* Clouds Layer */}
      <mesh ref={cloudsRef} scale={[1.015, 1.015, 1.015]}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={cloudsMap}
          alphaMap={cloudsMap}
          transparent={true}
          depthWrite={false}
          blending={THREE.NormalBlending}
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
