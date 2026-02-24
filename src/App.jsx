/**
 * WORLDVIEW APP
 * Enterprise geospatial intelligence dashboard.
 *
 * DOM Architecture:
 * - Layer 0: Cesium canvas (3D globe) with CRT scanline effect
 * - Layer 50: UI overlay (tooltips, HUD) - crisp typography, no CRT blur
 */
import { useRef } from 'react';
import WorldviewGlobe from './WorldviewGlobe';
import './index.css';

export default function App() {
  const tooltipRef = useRef(null);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* ============================================
          LAYER 0: Cesium 3D Canvas
          CRT scanlines applied via ::after pseudo-element
          ============================================ */}
      <div id="cesium-container" className="absolute inset-0 z-0 crt-canvas">
        <WorldviewGlobe tooltipRef={tooltipRef} />
      </div>

      {/* ============================================
          LAYER 50: UI Overlay
          pointer-events-none so clicks pass through to Cesium
          NO CRT effects - crisp typography guaranteed
          ============================================ */}
      <div id="ui-layer" className="absolute inset-0 z-50 pointer-events-none">
        
        {/* === HEADER HUD === */}
        <header className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
          <div className="hud-panel">
            <h1 className="text-green-400 text-lg font-bold tracking-[0.3em] uppercase">
              WORLDVIEW
            </h1>
            <p className="text-green-600 text-[10px] tracking-widest mt-0.5">
              GLOBAL INTELLIGENCE DASHBOARD
            </p>
          </div>

          <div className="hud-panel text-right">
            <div className="text-green-400 text-xs font-mono" id="utc-clock">
              --:--:-- UTC
            </div>
            <div className="text-green-600 text-[10px] mt-0.5">
              SYSTEM NOMINAL
            </div>
          </div>
        </header>

        {/* === LEGEND === */}
        <div className="absolute bottom-4 left-4 hud-panel">
          <div className="text-green-600 text-[10px] uppercase tracking-wider mb-2">Assets</div>
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-cyan-400">Aircraft</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span>
              <span className="text-orange-400">Satellites</span>
            </div>
          </div>
        </div>

        {/* === ENTITY TOOLTIP ===
            Positioned via direct DOM manipulation in WorldviewGlobe.jsx
            pointer-events-none inherited from parent */}
        <div
          ref={tooltipRef}
          className="absolute hidden bg-slate-950/95 border border-green-500/70 p-2.5 rounded shadow-xl shadow-green-900/20 backdrop-blur-sm"
          style={{
            top: 0,
            left: 0,
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            minWidth: '180px'
          }}
        >
          <div className="tooltip-content text-[11px] leading-relaxed font-mono text-green-400">
            {/* Content injected via direct DOM manipulation */}
          </div>
        </div>
      </div>
    </main>
  );
}

// UTC Clock updater
if (typeof window !== 'undefined') {
  setInterval(() => {
    const clockEl = document.getElementById('utc-clock');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toISOString().slice(11, 19) + ' UTC';
    }
  }, 1000);
}
