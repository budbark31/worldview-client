import React, { forwardRef } from 'react';

/**
 * High-performance HUD tooltip component.
 * Styled as a classified military datapad with phosphor glow effect.
 * Uses direct DOM manipulation for position updates (no React state).
 */
const HudTooltip = forwardRef((props, ref) => {
  return (
    <div
      ref={ref}
      className="absolute bg-black/80 border border-green-500 text-green-400 font-mono text-xs p-3 backdrop-blur-sm hidden phosphor-glow rounded"
      style={{
        top: 0,
        left: 0,
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
        zIndex: 100,
        minWidth: '180px',
        boxShadow: '0 0 10px rgba(74, 222, 128, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.5)'
      }}
    >
      <div className="tooltip-content">
        {/* Content will be populated via direct DOM manipulation */}
      </div>
    </div>
  );
});

HudTooltip.displayName = 'HudTooltip';

export default HudTooltip;
