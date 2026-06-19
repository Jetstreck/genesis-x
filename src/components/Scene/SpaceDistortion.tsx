'use client';

import { Effect } from 'postprocessing';
import { extend } from '@react-three/fiber';
import { forwardRef, useImperativeHandle, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Custom WebGL Fragment Shader for SCN_04/SCN_05 screen-space distortions and cosmic nebulae
const fragmentShader = `
  uniform float uDistortion;
  uniform float uZoomBlur;
  uniform float uNebulaStrength;
  uniform float uTime;

  // Pseudo-random noise helper
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // 2D Value Noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  // Fractional Brownian Motion (fBm) for smoke/nebula look
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotation matrix to reduce grid artifacts
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 center = vec2(0.5, 0.5);
    vec2 toCenter = uv - center;
    float dist = length(toCenter);
    
    // 1. Gravitational lens radial warp
    vec2 distortedUv = uv + toCenter * uDistortion * (1.0 - dist);
    
    // 2. Radial zoom blur (star streaks)
    vec4 colorAccum = vec4(0.0);
    float totalWeight = 0.0;
    
    int numSamples = 12;
    float stepSize = uZoomBlur * 0.012;
    
    for (int i = 0; i < 12; i++) {
      float weight = 1.0 - (float(i) / 12.0);
      vec2 sampleUv = distortedUv - toCenter * (float(i) * stepSize);
      
      // Shift Red and Blue channels slightly to create chromatic aberration on the streaks
      float rOffset = float(i) * stepSize * 0.15;
      vec4 rChan = texture2D(inputBuffer, sampleUv - toCenter * rOffset);
      vec4 gChan = texture2D(inputBuffer, sampleUv);
      vec4 bChan = texture2D(inputBuffer, sampleUv + toCenter * rOffset);
      
      colorAccum += vec4(rChan.r, gChan.g, bChan.b, 1.0) * weight;
      totalWeight += weight;
    }
    
    vec4 baseColor = colorAccum / totalWeight;
    
    // 3. Cosmic Nebula overlay (only active in SCN_05)
    // We add a soft colored gas cloud in dark space areas
    float luminance = max(baseColor.r, max(baseColor.g, baseColor.b));
    
    if (uNebulaStrength > 0.001 && luminance < 0.25) {
      // Dynamic noise UVs animated by time
      vec2 nebulaUv1 = distortedUv * 2.5 + vec2(uTime * 0.007, uTime * 0.004);
      vec2 nebulaUv2 = distortedUv * 1.4 - vec2(uTime * 0.003, uTime * 0.005);
      
      float n1 = fbm(nebulaUv1);
      float n2 = fbm(nebulaUv2);
      
      // Indigo and dark violet color maps
      vec3 colorIndigo = vec3(0.015, 0.035, 0.075);
      vec3 colorViolet = vec3(0.055, 0.015, 0.085);
      vec3 colorRedGlow = vec3(0.095, 0.025, 0.02); // Distant red signal scattering
      
      vec3 nebulaGlow = mix(colorIndigo, colorViolet, n1) + colorRedGlow * n2;
      float nebulaMask = smoothstep(0.25, 0.0, luminance) * (n1 * 0.7 + n2 * 0.3);
      
      baseColor.rgb += nebulaGlow * nebulaMask * uNebulaStrength * 2.2;
    }
    
    outputColor = baseColor;
  }
`;

// Extends postprocessing's base Effect class
export class SpaceDistortionEffect extends Effect {
  constructor({ distortion = 0.0, zoomBlur = 0.0, nebulaStrength = 0.0 } = {}) {
    super('SpaceDistortionEffect', fragmentShader, {
      uniforms: new Map([
        ['uDistortion', new THREE.Uniform(distortion)],
        ['uZoomBlur', new THREE.Uniform(zoomBlur)],
        ['uNebulaStrength', new THREE.Uniform(nebulaStrength)],
        ['uTime', new THREE.Uniform(0.0)],
      ]),
    });
  }

  // Increment shader time automatically every frame tick
  update(renderer: any, inputBuffer: any, deltaTime: number) {
    const timeUni = this.uniforms.get('uTime');
    if (timeUni) {
      timeUni.value += deltaTime;
    }
  }
}

// Register the custom post-processing effect with React Three Fiber
extend({ SpaceDistortionEffect });

interface SpaceDistortionProps {
  distortion?: number;
  zoomBlur?: number;
  nebulaStrength?: number;
}

export const SpaceDistortion = forwardRef<any, SpaceDistortionProps>(
  ({ distortion = 0.0, zoomBlur = 0.0, nebulaStrength = 0.0 }, ref) => {
    const effectRef = useRef<any>(null);
    const effect = useMemo(() => new SpaceDistortionEffect({ distortion, zoomBlur, nebulaStrength }), []);

    useImperativeHandle(ref, () => effectRef.current, []);

    // Push new uniform values on updates
    useEffect(() => {
      if (effectRef.current) {
        const distUniform = effectRef.current.uniforms.get('uDistortion');
        if (distUniform) distUniform.value = distortion;
      }
    }, [distortion]);

    useEffect(() => {
      if (effectRef.current) {
        const blurUniform = effectRef.current.uniforms.get('uZoomBlur');
        if (blurUniform) blurUniform.value = zoomBlur;
      }
    }, [zoomBlur]);

    useEffect(() => {
      if (effectRef.current) {
        const nebulaUniform = effectRef.current.uniforms.get('uNebulaStrength');
        if (nebulaUniform) nebulaUniform.value = nebulaStrength;
      }
    }, [nebulaStrength]);

    return <primitive ref={effectRef} object={effect} />;
  }
);

SpaceDistortion.displayName = 'SpaceDistortion';
