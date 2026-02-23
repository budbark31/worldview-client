import React from 'react';
import { Viewer } from 'resium';
import { Ion } from 'cesium';

// REQUIRED: The stylesheet so the globe actually looks like a globe
import "cesium/Build/Cesium/Widgets/widgets.css";

// Cesium Ion token loaded from environment variables
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

export default function WorldviewGlobe() {
  return (
    // We force the container to take up the whole screen with a black background
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}>
      <Viewer 
        full
        // The settings below strip away all of Cesium's default UI 
        // to give you a clean, cinematic canvas for your custom dashboard.
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        navigationHelpButton={false}
        fullscreenButton={false}
      >
        {/* Phase 2: We will map our live flight and satellite data layers here */}
      </Viewer>
    </div>
  );
}