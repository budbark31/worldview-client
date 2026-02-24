/**
 * WORLDVIEW GLOBE - Clean Rebuild
 * Minimal, bulletproof implementation.
 */
import { useRef, useEffect, useCallback } from 'react';
import { Viewer } from 'resium';
import {
  Ion,
  Color,
  Cartesian3,
  JulianDate,
  CallbackProperty,
  SampledPositionProperty,
  LagrangePolynomialApproximation,
  ExtrapolationType,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  IonImageryProvider,
  defined,
  Entity
} from 'cesium';
import * as satellite from 'satellite.js';

import 'cesium/Build/Cesium/Widgets/widgets.css';

// Cesium Ion token
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

// Constants
const MAX_SATELLITES = 300;
const PLANE_POLL_INTERVAL = 120000; // 2 minutes - avoid rate limits

export default function WorldviewGlobe({ tooltipRef }) {
  const viewerRef = useRef(null);
  const initRef = useRef(false);
  const handlerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const planeMapRef = useRef(new Map());
  const hoveredRef = useRef(null);

  const viewerCallback = useCallback((vc) => {
    if (!vc || initRef.current) return;
    const viewer = vc.cesiumElement;
    if (!viewer) return;

    viewerRef.current = viewer;
    initRef.current = true;

    console.log('[Globe] Viewer ready');

    // Enable animation
    viewer.clock.shouldAnimate = true;
    viewer.clock.multiplier = 1.0;

    // Fix near-plane clipping when zoomed in close
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;
    viewer.scene.camera.frustum.near = 1.0;
    viewer.scene.logarithmicDepthBuffer = true;

    // Add imagery
    IonImageryProvider.fromAssetId(2).then(provider => {
      viewer.imageryLayers.addImageryProvider(provider);
      console.log('[Globe] Imagery loaded');
    });

    // Initialize data
    loadSatellites(viewer);
    startPlanePolling(viewer);
    setupTooltip(viewer);

  }, [tooltipRef]);

  /**
   * Load satellites with strict validation
   */
  async function loadSatellites(viewer) {
    try {
      console.log('[Globe] Fetching TLEs...');
      
      // Use CORS proxy for Celestrak (they block direct browser requests)
      const proxyUrl = 'https://corsproxy.io/?';
      const celestrakUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
      
      const res = await fetch(proxyUrl + encodeURIComponent(celestrakUrl));
      
      if (!res.ok) {
        console.error('[Globe] TLE fetch failed:', res.status);
        // Load demo satellites if fetch fails
        loadDemoSatellites(viewer);
        return;
      }
      
      const text = await res.text();
      const lines = text.trim().split('\n');
      console.log('[Globe] Got', lines.length, 'lines of TLE data');

      let count = 0;
      let skipped = 0;
      const now = new Date();

      for (let i = 0; i < lines.length - 2 && count < MAX_SATELLITES; i += 3) {
        const name = lines[i].trim();
        const line1 = lines[i + 1]?.trim();
        const line2 = lines[i + 2]?.trim();

        if (!line1 || !line2) continue;

        try {
          const satrec = satellite.twoline2satrec(line1, line2);
          if (!satrec || satrec.error !== 0) {
            skipped++;
            continue;
          }

          // Pre-validate: compute position NOW and check if valid
          const testPos = computeSatPosition(satrec, now);
          if (!testPos) {
            skipped++;
            continue;
          }

          // Create entity with CallbackProperty
          const noradId = line1.substring(2, 7).trim();

          viewer.entities.add({
            id: `sat-${noradId}`,
            position: new CallbackProperty((time) => {
              const jsDate = JulianDate.toDate(time);
              return computeSatPosition(satrec, jsDate);
            }, false),
            point: {
              pixelSize: 4,
              color: Color.ORANGE,
              outlineColor: Color.BLACK,
              outlineWidth: 1
            },
            properties: {
              type: 'satellite',
              name: name,
              noradId: noradId
            }
          });

          count++;
        } catch (e) {
          skipped++;
        }
      }

      console.log(`[Globe] Loaded ${count} satellites, skipped ${skipped}`);
    } catch (err) {
      console.error('[Globe] Satellite load failed:', err);
      loadDemoSatellites(viewer);
    }
  }
  
  /**
   * Load demo satellites using ISS TLE (always works)
   */
  function loadDemoSatellites(viewer) {
    console.log('[Globe] Loading demo satellites...');
    
    // ISS TLE (Two-Line Element) - recent epoch
    const demoTLEs = [
      { name: 'ISS (ZARYA)', line1: '1 25544U 98067A   24054.50000000  .00016717  00000-0  10270-3 0  9993', line2: '2 25544  51.6400 208.9163 0006703  35.7128  51.1877 15.49496033    11' },
      { name: 'STARLINK-1007', line1: '1 44713U 19074A   24054.50000000  .00002500  00000-0  16000-3 0  9999', line2: '2 44713  53.0500 120.0000 0001500  90.0000 270.0000 15.06000000    10' },
      { name: 'HUBBLE', line1: '1 20580U 90037B   24054.50000000  .00000900  00000-0  35000-4 0  9999', line2: '2 20580  28.4700  50.0000 0002800 100.0000 260.0000 15.09000000    10' },
    ];
    
    const now = new Date();
    let count = 0;
    
    for (const tle of demoTLEs) {
      try {
        const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
        if (!satrec) continue;
        
        const testPos = computeSatPosition(satrec, now);
        if (!testPos) continue;
        
        viewer.entities.add({
          id: `sat-demo-${count}`,
          position: new CallbackProperty((time) => {
            return computeSatPosition(satrec, JulianDate.toDate(time));
          }, false),
          point: {
            pixelSize: 6,
            color: Color.ORANGE,
            outlineColor: Color.BLACK,
            outlineWidth: 1
          },
          properties: {
            type: 'satellite',
            name: tle.name,
            noradId: 'DEMO'
          }
        });
        count++;
      } catch (e) {
        console.error('[Globe] Demo sat failed:', e);
      }
    }
    
    console.log(`[Globe] Loaded ${count} demo satellites`);
  }

  /**
   * Compute satellite Cartesian3 position - returns null if invalid
   */
  function computeSatPosition(satrec, jsDate) {
    try {
      const pv = satellite.propagate(satrec, jsDate);
      if (!pv.position || typeof pv.position.x !== 'number') return null;

      const gmst = satellite.gstime(jsDate);
      const geo = satellite.eciToGeodetic(pv.position, gmst);

      const lon = satellite.degreesLong(geo.longitude);
      const lat = satellite.degreesLat(geo.latitude);
      const alt = geo.height; // km

      // Basic bounds check - be more lenient
      if (isNaN(lon) || isNaN(lat) || isNaN(alt)) return null;
      if (lon < -180 || lon > 180) return null;
      if (lat < -90 || lat > 90) return null;
      if (alt < 0 || alt > 100000) return null; // Allow wider range

      return Cartesian3.fromDegrees(lon, lat, alt * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Start polling OpenSky for aircraft
   */
  function startPlanePolling(viewer) {
    console.log('[Globe] Starting plane polling...');
    const MAX_PLANES = 500;
    let backoffTime = PLANE_POLL_INTERVAL;
    let rateLimited = false;
    
    async function poll() {
      try {
        // Use Vite proxy with Basic Auth
        const username = import.meta.env.VITE_OPENSKY_USER;
        const password = import.meta.env.VITE_OPENSKY_PASS;
        const headers = username && password 
          ? { 'Authorization': 'Basic ' + btoa(`${username}:${password}`) }
          : {};
        
        const res = await fetch('/api/opensky', { headers });
        
        if (res.status === 429) {
          if (!rateLimited) {
            console.warn('[Globe] OpenSky rate limited - will retry later');
            rateLimited = true;
          }
          // Exponential backoff, max 5 minutes
          backoffTime = Math.min(backoffTime * 2, 300000);
          setTimeout(poll, backoffTime);
          return;
        }
        
        if (!res.ok) {
          console.error('[Globe] OpenSky error:', res.status);
          setTimeout(poll, backoffTime);
          return;
        }
        
        // Success - reset backoff
        rateLimited = false;
        backoffTime = PLANE_POLL_INTERVAL;
        
        const data = await res.json();
        if (!data?.states) return;
        
        console.log('[Globe] Aircraft:', data.states.length);

        const now = JulianDate.now();
        const seen = new Set();
        let count = 0;

        for (const s of data.states) {
          if (count >= MAX_PLANES) break;
          
          const icao = s[0];
          const lon = s[5];
          const lat = s[6];
          const alt = s[7] || s[13] || 0;
          const onGround = s[8];
          const callsign = (s[1] || '').trim() || icao;

          // Skip invalid
          if (lon === null || lat === null || onGround) continue;
          if (lon < -180 || lon > 180 || lat < -90 || lat > 90) continue;
          if (alt < 0 || alt > 50000) continue;

          seen.add(icao);
          count++;

          const pos = Cartesian3.fromDegrees(lon, lat, alt);

          if (planeMapRef.current.has(icao)) {
            // Update existing
            const { property } = planeMapRef.current.get(icao);
            property.addSample(now, pos);
          } else {
            // Create new
            const property = new SampledPositionProperty();
            property.setInterpolationOptions({
              interpolationDegree: 1,
              interpolationAlgorithm: LagrangePolynomialApproximation
            });
            property.forwardExtrapolationType = ExtrapolationType.EXTRAPOLATE;
            property.forwardExtrapolationDuration = 20;
            property.addSample(now, pos);

            const entity = viewer.entities.add({
              id: `plane-${icao}`,
              position: property,
              point: {
                pixelSize: 4,
                color: Color.CYAN,
                outlineColor: Color.BLACK,
                outlineWidth: 1
              },
              properties: {
                type: 'plane',
                callsign: callsign,
                icao: icao
              }
            });

            planeMapRef.current.set(icao, { entity, property });
          }
        }

        // Remove stale
        for (const [icao, { entity }] of planeMapRef.current) {
          if (!seen.has(icao)) {
            viewer.entities.remove(entity);
            planeMapRef.current.delete(icao);
          }
        }

        console.log(`[Globe] ${seen.size} aircraft`);
        
        // Schedule next poll
        setTimeout(poll, PLANE_POLL_INTERVAL);
      } catch (err) {
        console.error('[Globe] Plane poll error:', err.message);
        setTimeout(poll, backoffTime);
      }
    }

    // Start polling after a delay to let rate limit cool
    setTimeout(poll, 5000);
  }

  /**
   * Setup tooltip handler
   */
  function setupTooltip(viewer) {
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((movement) => {
      const tooltip = tooltipRef?.current;
      if (!tooltip) return;

      // Reset previous hover
      if (hoveredRef.current) {
        hoveredRef.current.point.pixelSize = 3;
        hoveredRef.current.point.color = 
          hoveredRef.current.id.startsWith('sat-') ? Color.ORANGE : Color.CYAN;
        hoveredRef.current = null;
      }

      const picked = viewer.scene.pick(movement.endPosition);

      if (defined(picked) && picked.id instanceof Entity) {
        const entity = picked.id;
        const props = entity.properties;
        if (!props) {
          tooltip.classList.add('hidden');
          return;
        }

        // Highlight
        entity.point.pixelSize = 8;
        entity.point.color = Color.YELLOW;
        hoveredRef.current = entity;

        const type = props.type?.getValue();
        const content = tooltip.querySelector('.tooltip-content');

        if (type === 'satellite') {
          // Get current position for altitude display
          let altKm = '---';
          let latLon = '';
          try {
            const pos = entity.position?.getValue(viewer.clock.currentTime);
            if (pos) {
              const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
              altKm = (carto.height / 1000).toFixed(0);
              const lat = (carto.latitude * 180 / Math.PI).toFixed(2);
              const lon = (carto.longitude * 180 / Math.PI).toFixed(2);
              latLon = `${lat}°, ${lon}°`;
            }
          } catch (e) { /* ignore */ }
          
          content.innerHTML = `
            <div class="text-orange-400 font-bold">${props.name?.getValue() || 'SAT'}</div>
            <div class="text-green-600 text-[10px]">NORAD: ${props.noradId?.getValue()}</div>
            <div class="text-green-600 text-[10px]">ALT: ${altKm} km</div>
            <div class="text-green-600 text-[10px]">${latLon}</div>
          `;
        } else if (type === 'plane') {
          // Get current altitude
          let altFt = '---';
          try {
            const pos = entity.position?.getValue(viewer.clock.currentTime);
            if (pos) {
              const carto = viewer.scene.globe.ellipsoid.cartesianToCartographic(pos);
              altFt = Math.round(carto.height * 3.28084).toLocaleString(); // meters to feet
            }
          } catch (e) { /* ignore */ }
          
          content.innerHTML = `
            <div class="text-cyan-400 font-bold">${props.callsign?.getValue() || 'AIRCRAFT'}</div>
            <div class="text-green-600 text-[10px]">ICAO: ${props.icao?.getValue()}</div>
            <div class="text-green-600 text-[10px]">ALT: ${altFt} ft</div>
          `;
        }

        tooltip.style.transform = `translate3d(${movement.endPosition.x + 15}px, ${movement.endPosition.y + 15}px, 0)`;
        tooltip.classList.remove('hidden');
      } else {
        tooltip.classList.add('hidden');
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (handlerRef.current) handlerRef.current.destroy();
      planeMapRef.current.clear();
      initRef.current = false;
      console.log('[Globe] Cleanup');
    };
  }, []);

  return (
    <Viewer
      ref={viewerCallback}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      animation={false}
      timeline={false}
      baseLayerPicker={false}
      geocoder={false}
      homeButton={false}
      infoBox={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      fullscreenButton={false}
      selectionIndicator={false}
      baseLayer={false}
    />
  );
}
