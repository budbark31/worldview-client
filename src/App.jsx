import React from 'react';
import WorldviewGlobe from './WorldviewGlobe'; // This is the import!
import './crt-styles.css'; // Phase 4: CRT overlay aesthetic

export default function App() {
  return (
    // CRT container wraps the entire application
    <div className="crt-container">
      {/* The 3D globe renders underneath */}
      <WorldviewGlobe />
      
      {/* CRT overlay effects - stacked on top with pointer-events: none */}
      <div className="crt-interlace" />
      <div className="crt-screen-curve" />
      <div className="crt-vignette" />
      <div className="crt-overlay" />
    </div>
  );
}