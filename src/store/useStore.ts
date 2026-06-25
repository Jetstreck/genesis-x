import { create } from 'zustand';

interface EarthState {
  rotationSpeed: number;
  isRotating: boolean;
  atmosphereGlow: number;
  atmosphereColor: string;
  cloudsSpeed: number;
  latitude: number;
  longitude: number;
  timelineProgress: number;
  audioState: 'ambience' | 'vacuum-drop' | 'vacuum';
  currentScene: 'SCN_02' | 'SCN_03' | 'SCN_04' | 'SCN_05' | 'SCN_06' | 'SCN_07' | 'SCN_09' | 'SCN_10' | 'SCN_11' | 'SCN_12' | 'SCN_13';
  hingePhase: 'idle' | 'dragging' | 'holding' | 'snapped';
  dragProgress: number;
  transitProgress: number;
  approachProgress: number;
  footfallProgress: number;
  rainProgress: number;
  awakeningProgress: number;
  lightsProgress: number;
  reflectionProgress: number;
  mousePosition: { x: number; y: number };
  loopProgress: number;
  
  // Actions
  setRotationSpeed: (speed: number) => void;
  toggleRotating: () => void;
  setAtmosphereGlow: (glow: number) => void;
  setAtmosphereColor: (color: string) => void;
  setCloudsSpeed: (speed: number) => void;
  updateCoordinates: (lat: number, lng: number) => void;
  setTimelineProgress: (progress: number) => void;
  setAudioState: (state: 'ambience' | 'vacuum-drop' | 'vacuum') => void;
  setCurrentScene: (scene: 'SCN_02' | 'SCN_03' | 'SCN_04' | 'SCN_05' | 'SCN_06' | 'SCN_07' | 'SCN_09' | 'SCN_10' | 'SCN_11' | 'SCN_12' | 'SCN_13') => void;
  setHingePhase: (phase: 'idle' | 'dragging' | 'holding' | 'snapped') => void;
  setDragProgress: (progress: number) => void;
  setTransitProgress: (progress: number) => void;
  setApproachProgress: (progress: number) => void;
  setFootfallProgress: (progress: number) => void;
  setRainProgress: (progress: number) => void;
  setAwakeningProgress: (progress: number) => void;
  setLightsProgress: (progress: number) => void;
  setReflectionProgress: (progress: number) => void;
  setMousePosition: (pos: { x: number; y: number }) => void;
  setLoopProgress: (progress: number) => void;
}

export const useStore = create<EarthState>((set) => ({
  rotationSpeed: 0.05,
  isRotating: true,
  atmosphereGlow: 1.1,
  atmosphereColor: '#0ea5e9',
  cloudsSpeed: 1.15,
  latitude: 28.5721, // Kennedy Space Center coordinates as starter
  longitude: -80.6480,
  timelineProgress: 0.35,
  audioState: 'ambience',
  currentScene: 'SCN_02',
  hingePhase: 'idle',
  dragProgress: 0,
  transitProgress: 0,
  approachProgress: 0,
  footfallProgress: 0,
  rainProgress: 0,
  awakeningProgress: 0,
  lightsProgress: 0,
  reflectionProgress: 0,
  mousePosition: { x: 0, y: 0 },
  loopProgress: 0,

  setRotationSpeed: (speed) => set({ rotationSpeed: speed }),
  toggleRotating: () => set((state) => ({ isRotating: !state.isRotating })),
  setAtmosphereGlow: (glow) => set({ atmosphereGlow: glow }),
  setAtmosphereColor: (color) => set({ atmosphereColor: color }),
  setCloudsSpeed: (speed) => set({ cloudsSpeed: speed }),
  updateCoordinates: (lat, lng) => set({ latitude: lat, longitude: lng }),
  setTimelineProgress: (progress) => set({ timelineProgress: progress }),
  setAudioState: (state) => set({ audioState: state }),
  setCurrentScene: (scene) => set({ currentScene: scene }),
  setHingePhase: (phase) => set({ hingePhase: phase }),
  setDragProgress: (progress) => set({ dragProgress: progress }),
  setTransitProgress: (progress) => set({ transitProgress: progress }),
  setApproachProgress: (progress) => set({ approachProgress: progress }),
  setFootfallProgress: (progress) => set({ footfallProgress: progress }),
  setRainProgress: (progress) => set({ rainProgress: progress }),
  setAwakeningProgress: (progress) => set({ awakeningProgress: progress }),
  setLightsProgress: (progress) => set({ lightsProgress: progress }),
  setReflectionProgress: (progress) => set({ reflectionProgress: progress }),
  setMousePosition: (pos) => set({ mousePosition: pos }),
  setLoopProgress: (progress) => set({ loopProgress: progress }),
}));
