'use client';

import dynamic from 'next/dynamic';
import Overlay from '@/components/UI/Overlay';

// Dynamically import CanvasContainer with SSR disabled to ensure client-side WebGL execution
const CanvasContainer = dynamic(
  () => import('@/components/Scene/CanvasContainer'),
  { ssr: false }
);

export default function Home() {
  return (
    <main style={{ position: 'relative', width: '100vw', minHeight: '1000vh', backgroundColor: '#020204' }}>
      {/* Fixed viewport container for WebGL Canvas and Overlay */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}>
          <CanvasContainer />
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <Overlay />
        </div>
      </div>
    </main>
  );
}
