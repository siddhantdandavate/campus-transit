import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Bus } from '../../types/index.ts';

interface LiveBusMapProps {
  buses: Bus[];
  isLoading: boolean;
  onRefresh: () => void;
}

// Campus route corridors configured from available stop coordinates
// Lines follow the configured sequence of stops without inventing unverified road geometry
const ROUTE_CORRIDORS: Record<string, { stops: Array<{ name: string; lat: number; lon: number }> }> = {
  'BUS-01': {
    stops: [
      { name: 'Main Campus Gate', lat: 18.5204, lon: 73.8567 },
      { name: 'Central Library', lat: 18.5250, lon: 73.8580 },
      { name: 'Academic Complex', lat: 18.5280, lon: 73.8600 },
      { name: 'North Hostel', lat: 18.5320, lon: 73.8620 },
    ],
  },
  'BUS-02': {
    stops: [
      { name: 'Central Library', lat: 18.5250, lon: 73.8580 },
      { name: 'University Circle', lat: 18.5210, lon: 73.8615 },
      { name: 'Pune Station Junction', lat: 18.5160, lon: 73.8660 },
    ],
  },
  'BUS-03': {
    stops: [
      { name: 'Main Campus Gate', lat: 18.5204, lon: 73.8567 },
      { name: 'Sports Pavilion', lat: 18.5175, lon: 73.8545 },
      { name: 'South Hostel', lat: 18.5150, lon: 73.8530 },
    ],
  },
  'BUS-04': {
    stops: [
      { name: 'Academic Complex', lat: 18.5280, lon: 73.8600 },
      { name: 'Central Library', lat: 18.5250, lon: 73.8580 },
      { name: 'Main Campus Gate', lat: 18.5204, lon: 73.8567 },
    ],
  },
};

export const LiveBusMap: React.FC<LiveBusMapProps> = ({ buses, isLoading, onRefresh }) => {
  const [selectedBusId, setSelectedBusId] = useState<number>(buses[0]?.id || 1);
  const [isDemoSimActive, setIsDemoSimActive] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [hasTileError, setHasTileError] = useState<boolean>(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const layersRef = useRef<{
    routeLine?: L.Polyline;
    routeCasing?: L.Polyline;
    stopMarkers: L.Marker[];
    busMarker?: L.Marker;
  }>({ stopMarkers: [] });

  const selectedBus = buses.find((b) => b.id === selectedBusId) || buses[0];
  const corridor = ROUTE_CORRIDORS[selectedBus?.bus_code] || ROUTE_CORRIDORS['BUS-01'];
  const routeCoords: [number, number][] = corridor.stops.map((s) => [s.lat, s.lon]);

  const hasGps = Boolean(selectedBus?.latest_gps);
  const isStale = Boolean(selectedBus?.latest_gps?.is_stale);

  // 1. Initialize Leaflet Map with keyless OpenStreetMap tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapInstance) return;

    const initialCenter: [number, number] = [18.5240, 73.8590];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });

    // Zoom control on bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Standard OpenStreetMap real-world tile layer: keyless, free, shows roads/streets/buildings
    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    tileLayer.on('tileerror', () => {
      setHasTileError(true);
    });
    tileLayer.on('load', () => {
      setHasTileError(false);
    });

    tileLayerRef.current = tileLayer;
    setMapInstance(map);

    return () => {
      map.remove();
      setMapInstance(null);
      tileLayerRef.current = null;
    };
  }, []);

  // 2. Demo simulation stepper along configured stop waypoints
  useEffect(() => {
    if (!isDemoSimActive) return;
    const interval = setInterval(() => {
      setDemoStep((prev) => (prev + 1) % corridor.stops.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isDemoSimActive, corridor]);

  // 3. Draw route line, stop markers, and bus marker when map or selected bus changes
  useEffect(() => {
    if (!mapInstance || !selectedBus) return;
    const map = mapInstance;

    map.invalidateSize();

    // Clear previous layers
    if (layersRef.current.routeCasing) map.removeLayer(layersRef.current.routeCasing);
    if (layersRef.current.routeLine) map.removeLayer(layersRef.current.routeLine);
    layersRef.current.stopMarkers.forEach((m) => map.removeLayer(m));
    layersRef.current.stopMarkers = [];
    if (layersRef.current.busMarker) map.removeLayer(layersRef.current.busMarker);

    // A. Outer route casing for contrast against road street lines
    const routeCasing = L.polyline(routeCoords, {
      color: '#ffffff',
      weight: 8,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // B. Inner route line (Swiggy / Uber style vibrant route corridor)
    const routeLine = L.polyline(routeCoords, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    layersRef.current.routeCasing = routeCasing;
    layersRef.current.routeLine = routeLine;

    // C. Render Stop Markers with non-overlapping label bubbles
    corridor.stops.forEach((stop, index) => {
      const isOrigin = index === 0;
      const isDestination = index === corridor.stops.length - 1;

      // Smart label placement alternates top/bottom/left/right to prevent overlap
      const labelPlacementClass = isOrigin
        ? 'label-top'
        : isDestination
        ? 'label-bottom'
        : index % 2 === 1
        ? 'label-right'
        : 'label-left';

      const stopIcon = L.divIcon({
        className: 'leaflet-stop-container',
        html: `
          <div class="swiggy-stop-node ${labelPlacementClass} ${isDestination ? 'destination' : isOrigin ? 'origin' : 'intermediate'}">
            <span class="stop-dot"></span>
            <div class="stop-label-bubble">${stop.name}</div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(map);
      layersRef.current.stopMarkers.push(marker);
    });

    // D. Initialize Bus Marker
    const targetPos: [number, number] = isDemoSimActive
      ? [
          corridor.stops[demoStep % corridor.stops.length].lat,
          corridor.stops[demoStep % corridor.stops.length].lon,
        ]
      : selectedBus.latest_gps
      ? [selectedBus.latest_gps.latitude, selectedBus.latest_gps.longitude]
      : routeCoords[0];

    const initialIcon = L.divIcon({
      className: 'leaflet-bus-container animated-bus-marker',
      html: `
        <div class="swiggy-bus-marker ${isDemoSimActive ? 'demo-sim-mode' : (hasGps ? (isStale ? 'stale' : 'live') : 'offline')}">
          ${!isDemoSimActive && hasGps && !isStale ? '<span class="radar-ping-ring"></span>' : ''}
          <div class="bus-badge-pin ${isDemoSimActive ? 'demo-pin' : ''}">
            <span class="bus-emoji">🚌</span>
          </div>
          ${isDemoSimActive
            ? '<div class="demo-persistent-tag">DEMO SIMULATION</div>'
            : `<div class="bus-badge-label">${selectedBus.bus_code}</div>`
          }
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const busMarker = L.marker(targetPos, {
      icon: initialIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    layersRef.current.busMarker = busMarker;

    // Fit map bounds to configured route corridor with padding away from overlays
    const bounds = L.latLngBounds(routeCoords);
    if (selectedBus.latest_gps) {
      const busLat = selectedBus.latest_gps.latitude;
      const busLon = selectedBus.latest_gps.longitude;
      const dLat = Math.abs(busLat - routeCoords[0][0]);
      const dLon = Math.abs(busLon - routeCoords[0][1]);
      if (dLat < 0.05 && dLon < 0.05) {
        bounds.extend([busLat, busLon]);
      }
    }
    const isDesktop = window.innerWidth > 900;
    map.fitBounds(bounds, {
      paddingTopLeft: isDesktop ? [420, 60] : [20, 80],
      paddingBottomRight: isDesktop ? [60, 60] : [20, 360],
      maxZoom: 16,
      animate: false,
    });
  }, [mapInstance, selectedBus?.id, selectedBus?.bus_code]);

  // 4. Smoothly update bus marker position and icon when GPS telemetry or demo step changes
  useEffect(() => {
    if (!mapInstance || !selectedBus) return;
    const busMarker = layersRef.current.busMarker;
    if (!busMarker) return;

    // Target position: animated demo waypoint, or actual GPS coords, or origin stop
    const targetPos: [number, number] = isDemoSimActive
      ? [
          corridor.stops[demoStep % corridor.stops.length].lat,
          corridor.stops[demoStep % corridor.stops.length].lon,
        ]
      : hasGps && selectedBus.latest_gps
      ? [selectedBus.latest_gps.latitude, selectedBus.latest_gps.longitude]
      : routeCoords[0];

    const busIcon = L.divIcon({
      className: 'leaflet-bus-container animated-bus-marker',
      html: `
        <div class="swiggy-bus-marker ${isDemoSimActive ? 'demo-sim-mode' : (hasGps ? (isStale ? 'stale' : 'live') : 'offline')}">
          ${!isDemoSimActive && hasGps && !isStale ? '<span class="radar-ping-ring"></span>' : ''}
          <div class="bus-badge-pin ${isDemoSimActive ? 'demo-pin' : ''}">
            <span class="bus-emoji">🚌</span>
          </div>
          ${isDemoSimActive
            ? '<div class="demo-persistent-tag">DEMO SIMULATION</div>'
            : `<div class="bus-badge-label">${selectedBus.bus_code}</div>`
          }
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    busMarker.setIcon(busIcon);
    busMarker.setLatLng(targetPos);
    busMarker.setZIndexOffset(1000);

    busMarker.bindPopup(`
      <div class="bus-map-popup">
        <strong>${selectedBus.bus_code} — ${selectedBus.route_name}</strong>
        <p>${selectedBus.status} • ${selectedBus.eta_display}</p>
        <small>${
          isDemoSimActive
            ? 'DEMO SIMULATION (Fictional telemetry)'
            : hasGps
            ? `Latest GPS: ${targetPos[0].toFixed(4)}°, ${targetPos[1].toFixed(4)}° (${selectedBus.latest_gps?.age_seconds ?? 0}s ago)`
            : 'Hardware GPS Inactive on Vehicle'
        }</small>
      </div>
    `);
  }, [mapInstance, selectedBus?.id, selectedBus?.latest_gps, isDemoSimActive, demoStep, selectedBus?.status, selectedBus?.bus_code, selectedBus?.route_name, selectedBus?.eta_display]);

  // Recenter Map Handler
  const handleRecenter = () => {
    if (!mapInstance || !selectedBus) return;
    mapInstance.invalidateSize();
    const bounds = L.latLngBounds(routeCoords);
    if (selectedBus.latest_gps) {
      const busLat = selectedBus.latest_gps.latitude;
      const busLon = selectedBus.latest_gps.longitude;
      const dLat = Math.abs(busLat - routeCoords[0][0]);
      const dLon = Math.abs(busLon - routeCoords[0][1]);
      if (dLat < 0.05 && dLon < 0.05) {
        bounds.extend([busLat, busLon]);
      }
    }
    const isDesktop = window.innerWidth > 900;
    mapInstance.fitBounds(bounds, {
      paddingTopLeft: isDesktop ? [420, 60] : [20, 80],
      paddingBottomRight: isDesktop ? [60, 60] : [20, 360],
      maxZoom: 16,
      animate: true,
    });
  };

  return (
    <div className="swiggy-map-experience">
      {/* 1. Map Viewport Container */}
      <div className="map-canvas-wrapper">
        <div ref={mapContainerRef} className="leaflet-map-element" />

        {/* Tile Offline / Error Fallback Banner (Requirement 8) */}
        {hasTileError && (
          <div className="map-tile-fallback-banner" role="alert">
            <span className="fallback-icon">⚠️</span>
            <span className="fallback-text">
              Map tiles temporarily unavailable offline. Real-time telemetry and route markers remain operational.
            </span>
            <button
              type="button"
              className="fallback-retry-btn"
              onClick={() => {
                setHasTileError(false);
                tileLayerRef.current?.redraw();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Floating Top Controls: Bus Selector & Recenter Button */}
        <div className="map-floating-top-bar">
          <div className="bus-selector-pill-group" role="tablist" aria-label="Select Campus Bus">
            {buses.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={b.id === selectedBusId}
                id={`bus-pill-${b.bus_code}`}
                className={`bus-quick-pill ${b.id === selectedBusId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedBusId(b.id);
                  setDemoStep(0);
                }}
              >
                <span className="pill-code">{b.bus_code}</span>
                {b.latest_gps && !b.latest_gps.is_stale && (
                  <span className="live-dot-indicator" title="Live GPS Active" />
                )}
              </button>
            ))}
          </div>

          <div className="map-top-actions">
            <button
              type="button"
              className="map-control-btn recenter-btn"
              onClick={handleRecenter}
              title="Recenter map to visible route"
              aria-label="Recenter map"
              id="recenter-map-btn"
            >
              <span className="btn-icon">🎯</span>
              <span className="btn-text">Recenter</span>
            </button>

            <button
              type="button"
              className="map-control-btn refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh vehicle telemetry"
              aria-label="Refresh telemetry"
              id="refresh-telemetry-btn"
            >
              <span className="btn-icon">{isLoading ? '⏳' : '↻'}</span>
            </button>
          </div>
        </div>

        {/* 2. Floating Swiggy / Zepto Style Information Sheet */}
        {selectedBus && (
          <aside className="swiggy-tracking-sheet" aria-label="Vehicle Tracking Information">
            <div className="sheet-drag-handle" />

            {/* ETA / Arrival Status Banner */}
            <div className="tracking-eta-header">
              <div className="eta-badge-row">
                <span className={`status-pill status-${selectedBus.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  {selectedBus.status}
                </span>

                {/* Persistent Simulation Badge (Requirement 6) */}
                {isDemoSimActive ? (
                  <span className="sim-badge-alert" id="demo-sim-persistent-badge">
                    DEMO SIMULATION
                  </span>
                ) : hasGps && !isStale ? (
                  <span className="live-gps-badge">LIVE GPS</span>
                ) : null}
              </div>

              <h2 className="eta-headline">
                {selectedBus.status === 'On time' && `Arriving at ${selectedBus.scheduled_arrival}`}
                {selectedBus.status === 'Delayed' && `Delayed by ${selectedBus.delay_minutes} mins`}
                {selectedBus.status === 'Breakdown' && 'Service Interrupted (Breakdown)'}
                {selectedBus.status === 'Route change' && `Detour (+${selectedBus.delay_minutes}m)`}
                {selectedBus.status === 'Service cancelled' && 'Service Cancelled Today'}
              </h2>

              <p className="eta-destination">
                to <strong>{selectedBus.destination}</strong> • from {selectedBus.origin}
              </p>
            </div>

            {/* Vehicle & Operator Identification Card */}
            <div className="vehicle-driver-card">
              <div className="driver-avatar-box">
                <span className="avatar-icon">🚌</span>
              </div>
              <div className="driver-details">
                <strong className="vehicle-name">{selectedBus.bus_code} — {selectedBus.route_name}</strong>
                <span className="driver-sub">Assigned Driver: {selectedBus.updated_by}</span>
              </div>
              <div className="vehicle-badge-pill">
                <span>Bus #{selectedBus.id}</span>
              </div>
            </div>

            {/* GPS Telemetry & Freshness Status Panel */}
            <div className="telemetry-honesty-panel">
              {isDemoSimActive ? (
                <div className="gps-signal-box demo-active">
                  <div className="signal-status-line">
                    <span className="signal-purple-dot">🟣</span>
                    <strong className="signal-title">DEMO SIMULATION ACTIVE</strong>
                  </div>
                  <p className="signal-unavailable-note">
                    Displaying illustrative route movement. Never conflated with real vehicle GPS.
                  </p>
                </div>
              ) : hasGps && selectedBus.latest_gps ? (
                <div className={`gps-signal-box ${isStale ? 'stale' : 'live'}`}>
                  <div className="signal-status-line">
                    <span className="signal-pulse-dot" />
                    <strong className="signal-title">
                      {isStale ? 'STALE GPS LOCATION' : 'LIVE DEVICE TELEMETRY'}
                    </strong>
                    <span className="signal-time">
                      {selectedBus.latest_gps.age_seconds !== undefined
                        ? `${selectedBus.latest_gps.age_seconds}s ago`
                        : 'Just now'}
                    </span>
                  </div>

                  <div className="signal-details-row">
                    <span>
                      Coords: <strong>{selectedBus.latest_gps.latitude.toFixed(4)}°, {selectedBus.latest_gps.longitude.toFixed(4)}°</strong>
                    </span>
                    <span>
                      Accuracy: <strong>±{Math.round(selectedBus.latest_gps.accuracy_meters)}m</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="gps-signal-box unavailable">
                  <div className="signal-status-line">
                    <span className="signal-gray-dot">⚪</span>
                    <strong className="signal-title">GPS INACTIVE ON VEHICLE</strong>
                  </div>
                  <p className="signal-unavailable-note">
                    Driver has not enabled phone location sharing. Real-time pin will appear once driver starts GPS transmission.
                  </p>
                </div>
              )}
            </div>

            {/* Latest Notice or Disruption Warning */}
            {selectedBus.current_note && (
              <div className="sheet-service-note">
                <span className="note-icon">💬</span>
                <p className="note-text">{selectedBus.current_note}</p>
              </div>
            )}

            {/* Demo Simulation Mode Toggle Switch (Requirement 6) */}
            <div className="demo-sim-switch-box">
              <label htmlFor="sim-toggle-checkbox" className="sim-switch-label">
                <input
                  id="sim-toggle-checkbox"
                  type="checkbox"
                  checked={isDemoSimActive}
                  onChange={(e) => setIsDemoSimActive(e.target.checked)}
                />
                <span className="switch-text">
                  <strong>Simulate vehicle movement</strong> (demo route animation)
                </span>
              </label>
              <small className="sim-disclaimer">
                Fictional demo demonstration • Never conflated with genuine GPS
              </small>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
