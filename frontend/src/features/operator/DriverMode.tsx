import React, { useState, useEffect, useRef } from 'react';
import type { Bus, BusUpdatePayload, UserProfile } from '../../types/index.ts';
import { publishUpdate, submitGpsTelemetry } from '../../lib/api.ts';

interface DriverModeProps {
  buses: Bus[];
  currentUser: UserProfile | null;
  onOpenLogin: () => void;
  onSuccess: () => void;
}

type IncidentType = 'delay' | 'breakdown' | 'detour' | 'resume';
type Language = 'en' | 'mr';

interface IncidentConfig {
  status: 'Delayed' | 'Breakdown' | 'Route change' | 'On time';
  defaultDelay: number;
  labelEn: string;
  labelMr: string;
  subEn: string;
  subMr: string;
  defaultNoteEn: string;
  defaultNoteMr: string;
  icon: string;
}

const INCIDENTS: Record<IncidentType, IncidentConfig> = {
  delay: {
    status: 'Delayed',
    defaultDelay: 15,
    labelEn: 'Traffic Delay',
    labelMr: 'वाहतूक कोंडी (Delay)',
    subEn: 'Heavy road traffic or campus congestion',
    subMr: 'रस्त्यावर जास्त वाहतूक कोंडी आहे',
    defaultNoteEn: 'Heavy traffic congestion encountered along route.',
    defaultNoteMr: 'रस्त्यावर जास्त वाहतूक कोंडीमुळे उशीर होत आहे.',
    icon: '🚦',
  },
  breakdown: {
    status: 'Breakdown',
    defaultDelay: 0,
    labelEn: 'Vehicle Breakdown',
    labelMr: 'गाडी बिघाड (Breakdown)',
    subEn: 'Mechanical fault, vehicle stopped (ETA Unknown)',
    subMr: 'यांत्रिक बिघाड, गाडी थांबलेली आहे (वेळ अनिश्चित)',
    defaultNoteEn: 'Vehicle mechanical breakdown. Stationary; awaiting assistance.',
    defaultNoteMr: 'गाडीमध्ये यांत्रिक बिघाड झाला आहे; दुरुस्ती पथकाची प्रतीक्षा.',
    icon: '⚠️',
  },
  detour: {
    status: 'Route change',
    defaultDelay: 10,
    labelEn: 'Route Detour',
    labelMr: 'मार्ग बदल / वळण (Detour)',
    subEn: 'Road closed or diverted path (+10m)',
    subMr: 'रस्त्यावरील कामामुळे पर्यायी मार्गाने वळण (+१० मिनिटे)',
    defaultNoteEn: 'Route diversion in effect due to road obstacle or construction.',
    defaultNoteMr: 'रस्त्यावरील कामामुळे पर्यायी मार्गाने वळण घेतलेले आहे.',
    icon: '↪️',
  },
  resume: {
    status: 'On time',
    defaultDelay: 0,
    labelEn: 'Resume Service',
    labelMr: 'सेवा पूर्ववत (Resume Service)',
    subEn: 'Road clear, operating on regular schedule',
    subMr: 'रस्ता मोकळा, नियमित वेळापत्रकानुसार सुरू',
    defaultNoteEn: 'Service resumed on regular scheduled operations.',
    defaultNoteMr: 'रस्ता मोकळा झाला आहे. गाडी नियमित वेळेनुसार सुरू आहे.',
    icon: '✅',
  },
};

export const DriverMode: React.FC<DriverModeProps> = ({
  buses,
  currentUser,
  onOpenLogin,
  onSuccess,
}) => {
  const [lang, setLang] = useState<Language>('en');
  const [selectedIncident, setSelectedIncident] = useState<IncidentType>('delay');
  const [delayMinutes, setDelayMinutes] = useState<number>(15);
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live GPS Tracking State
  const [isSharingLocation, setIsSharingLocation] = useState<boolean>(false);
  const [gpsShareMode, setGpsShareMode] = useState<'real' | 'simulated' | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [latestGpsCoords, setLatestGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    timestamp: string;
  } | null>(null);
  const [gpsPacketCount, setGpsPacketCount] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<number | null>(null);

  const assignedBusId = currentUser?.assigned_bus_id || 1;
  const assignedBus = buses.find((b) => b.id === assignedBusId) || buses[0];

  // Cleanup GPS watchers on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simIntervalRef.current !== null) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  const handleStartRealGps = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your device or browser.');
      return;
    }

    setGpsError(null);

    const onLocationSuccess = async (pos: GeolocationPosition) => {
      const deviceIso = new Date(pos.timestamp).toISOString();
      const posData = {
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Number(pos.coords.accuracy.toFixed(1)),
        speed: pos.coords.speed !== null ? Number(pos.coords.speed.toFixed(1)) : null,
        timestamp: deviceIso,
      };

      setLatestGpsCoords(posData);
      setIsSharingLocation(true);
      setGpsShareMode('real');

      try {
        await submitGpsTelemetry(assignedBusId, {
          latitude: posData.latitude,
          longitude: posData.longitude,
          accuracy_meters: posData.accuracy,
          speed_mps: posData.speed,
          device_timestamp: posData.timestamp,
        });
        setGpsPacketCount((prev) => prev + 1);
        setGpsError(null);
        onSuccess();
      } catch (err: unknown) {
        setGpsError(err instanceof Error ? err.message : 'Failed to transmit GPS coordinates.');
      }
    };

    const onLocationError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGpsError('Location permission denied. Please allow location access in your device settings.');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setGpsError('GPS signal unavailable. Ensure device location is enabled.');
      } else if (err.code === err.TIMEOUT) {
        setGpsError('Location request timed out. Retrying…');
      }
      setIsSharingLocation(false);
      setGpsShareMode(null);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onLocationSuccess,
      onLocationError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  };

  const handleStartDemoSim = () => {
    handleStopSharing();
    setGpsError(null);
    setIsSharingLocation(true);
    setGpsShareMode('simulated');

    const demoWaypoints = [
      { lat: 18.5204, lon: 73.8567 },
      { lat: 18.5250, lon: 73.8580 },
      { lat: 18.5280, lon: 73.8600 },
      { lat: 18.5320, lon: 73.8620 },
      { lat: 18.5290, lon: 73.8520 },
    ];

    let step = 0;
    const transmitSimStep = async () => {
      const pt = demoWaypoints[step % demoWaypoints.length];
      step++;
      const nowIso = new Date().toISOString();
      const posData = {
        latitude: pt.lat,
        longitude: pt.lon,
        accuracy: 10.0,
        speed: 6.2,
        timestamp: nowIso,
      };
      setLatestGpsCoords(posData);

      try {
        await submitGpsTelemetry(assignedBusId, {
          latitude: pt.lat,
          longitude: pt.lon,
          accuracy_meters: 10.0,
          speed_mps: 6.2,
          device_timestamp: nowIso,
        });
        setGpsPacketCount((prev) => prev + 1);
        onSuccess();
      } catch (err: unknown) {
        setGpsError(err instanceof Error ? err.message : 'Demo transmission failed.');
      }
    };

    transmitSimStep();
    simIntervalRef.current = window.setInterval(transmitSimStep, 5000);
  };

  const handleStopSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current !== null) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSharingLocation(false);
    setGpsShareMode(null);
  };

  // Set default note when incident changes
  useEffect(() => {
    const cfg = INCIDENTS[selectedIncident];
    setCustomNote(lang === 'mr' ? cfg.defaultNoteMr : cfg.defaultNoteEn);
    if (selectedIncident === 'delay') {
      setDelayMinutes(cfg.defaultDelay);
    } else if (selectedIncident === 'detour') {
      setDelayMinutes(cfg.defaultDelay);
    } else {
      setDelayMinutes(0);
    }
  }, [selectedIncident, lang]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    if (!assignedBus) {
      setErrorMessage('No bus assigned to your account.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const cfg = INCIDENTS[selectedIncident];
    const finalNote = customNote.trim() || (lang === 'mr' ? cfg.defaultNoteMr : cfg.defaultNoteEn);

    const payload: BusUpdatePayload = {
      status: cfg.status,
      delay_minutes: selectedIncident === 'delay' || selectedIncident === 'detour' ? delayMinutes : 0,
      note: finalNote,
      updated_by: `${currentUser.full_name} (${assignedBus.bus_code})`,
      is_correction: false,
    };

    try {
      await publishUpdate(assignedBus.id, payload);
      setIsSubmitting(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setStatusMessage(
        lang === 'mr'
          ? `अहवाल यशस्वीरीत्या पाठवला (${timeStr}): ${cfg.labelMr}`
          : `Report published successfully at ${timeStr}: ${cfg.labelEn} (${cfg.status})`
      );
      onSuccess();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Error submitting report');
    }
  };

  return (
    <div className="driver-dashboard" style={{ maxWidth: '680px', margin: '0 auto' }}>
      {/* Top Header & Language Switcher */}
      <div className="driver-header-bar">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--navy)' }}>
            {lang === 'mr' ? 'चालक जलद अहवाल प्रणाली' : 'Driver Operations Dashboard'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '4px 0 0' }}>
            {lang === 'mr'
              ? 'बस सुरक्षित थांबलेली असताना जलद अहवाल पाठवण्यासाठी.'
              : 'Direct reporting interface for authenticated drivers while safely stopped.'}
          </p>
        </div>

        <button
          type="button"
          className="lang-toggle-btn"
          onClick={() => setLang(lang === 'en' ? 'mr' : 'en')}
          title="Toggle English / Marathi"
          aria-label="Switch Language"
        >
          🌐 <b>{lang === 'en' ? 'मराठी' : 'English'}</b>
        </button>
      </div>

      {/* Prominent Stationary Safety Notice */}
      <div className="driver-safety-banner" role="alert">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <strong style={{ fontSize: '13px', letterSpacing: '0.5px' }}>
            {lang === 'mr' ? 'सुरक्षितता नियम (नेहमी पाळा)' : 'STATIONARY SAFETY MANDATE'}
          </strong>
        </div>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.45 }}>
          {lang === 'mr'
            ? 'बस पूर्णपणे थांबलेली आणि सुरक्षित जागी पार्क केलेली असतानाच वापरा. गाडी चालवताना किंवा चालू वाहतुकीत अजिबात वापरू नका.'
            : 'Only interact with this console when your vehicle is completely stopped and safely parked. Never interact while driving or stopped in active traffic.'}
        </p>
      </div>

      {/* Driver Authentication Status Card */}
      {!currentUser ? (
        <div className="driver-auth-gate" style={{ background: '#fef3c7', border: '1px solid #fde68a', padding: '16px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <strong style={{ color: '#92400e', fontSize: '14px' }}>Driver Sign-In Required</strong>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b45309' }}>
              You are currently viewing in public rider mode. Sign in with your driver credentials to report disruptions for your assigned vehicle.
            </p>
          </div>
          <button type="button" className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px', whiteSpace: 'nowrap' }} onClick={onOpenLogin}>
            Sign In as Driver
          </button>
        </div>
      ) : (
        <div className="driver-vehicle-card" style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', marginBottom: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {lang === 'mr' ? 'नेमून दिलेली बस व मार्ग' : 'SERVER-ASSIGNED VEHICLE & ROUTE'}
              </span>
              <h3 style={{ margin: '4px 0 2px', fontSize: '17px', fontWeight: 800, color: 'var(--navy)' }}>
                {assignedBus ? `${assignedBus.bus_code} — ${assignedBus.route_name}` : `Bus #${assignedBusId}`}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                {assignedBus?.origin} ➔ {assignedBus?.destination}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className={`role-tag role-${currentUser.role}`}>{currentUser.role}</span>
              <div style={{ fontSize: '12px', color: '#334155', fontWeight: 700, marginTop: '4px' }}>
                {currentUser.full_name}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>
              Current Public Status:{' '}
              <strong style={{ color: 'var(--navy)' }}>{assignedBus?.status}</strong>
              {assignedBus?.delay_minutes ? ` (+${assignedBus.delay_minutes}m)` : ''}
            </span>
            <small style={{ color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              🔒 Locked to Bus #{assignedBusId}
            </small>
          </div>
        </div>
      )}

      {/* Success & Error Feedback Banners */}
      {statusMessage && (
        <div className="alert-box alert-success" role="status" style={{ marginBottom: '16px' }}>
          <span className="alert-icon">✓</span>
          <div>
            <strong>Report Logged</strong>
            <p style={{ margin: '2px 0 0', fontSize: '13px' }}>{statusMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="alert-box alert-error" role="alert" style={{ marginBottom: '16px' }}>
          <span className="alert-icon">⚠</span>
          <div>
            <strong>Submission Rejection</strong>
            <p style={{ margin: '2px 0 0', fontSize: '13px' }}>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Live Vehicle Location Sharing Panel (Assigned Bus) */}
      <div className="stat-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>📡</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)' }}>
                Live Location Sharing (Bus #{assignedBusId})
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Broadcast real-time coordinates to students and riders on the public campus map.
            </p>
          </div>

          <div>
            {isSharingLocation ? (
              <span className="badge-live" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                ● SHARING LIVE LOCATION ({gpsShareMode === 'simulated' ? 'DEMO SIMULATION' : 'DEVICE GPS'})
              </span>
            ) : (
              <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>
                GPS Inactive
              </span>
            )}
          </div>
        </div>

        {gpsError && (
          <div className="alert-box alert-error" style={{ marginBottom: '12px', fontSize: '12px' }}>
            ⚠ {gpsError}
          </div>
        )}

        {/* Live Coordinates Card when transmitting */}
        {latestGpsCoords && isSharingLocation && (
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Latitude</span>
                <strong>{latestGpsCoords.latitude.toFixed(5)}° N</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Longitude</span>
                <strong>{latestGpsCoords.longitude.toFixed(5)}° E</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Accuracy</span>
                <span>±{Math.round(latestGpsCoords.accuracy)} meters</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Updates Sent</span>
                <span>{gpsPacketCount} packets</span>
              </div>
            </div>
            {gpsShareMode === 'simulated' && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#7c3aed', background: '#f5f3ff', padding: '4px 8px', borderRadius: '4px' }}>
                ℹ️ Simulated Demo Mode: Moving along campus stops for evaluation.
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!isSharingLocation ? (
            <>
              <button
                id="btn-start-live-location"
                type="button"
                className="btn-primary"
                onClick={handleStartRealGps}
                style={{ fontSize: '13px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <span>📡</span>
                <span>Start Live Location</span>
              </button>
              <button
                id="btn-start-demo-sim"
                type="button"
                className="btn-secondary"
                onClick={handleStartDemoSim}
                style={{ fontSize: '12px', padding: '10px 14px' }}
                title="Simulate vehicle moving between stops for testing"
              >
                <span>↻</span>
                <span>Start Demo Simulation (Test Mode)</span>
              </button>
            </>
          ) : (
            <button
              id="btn-stop-sharing"
              type="button"
              className="btn-secondary"
              onClick={handleStopSharing}
              style={{ fontSize: '13px', padding: '10px 18px', background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5', fontWeight: 700 }}
            >
              <span>⏹</span>
              <span>Stop Sharing</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Reporting Form */}
      <form onSubmit={handleSubmitReport} className="stat-card" style={{ padding: '20px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--navy)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {lang === 'mr' ? '१. घटनेचा प्रकार निवडा' : '1. Select Incident Type'}
        </label>

        {/* 4 Large Incident Action Cards */}
        <div className="incident-options-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '18px' }}>
          {(Object.keys(INCIDENTS) as IncidentType[]).map((key) => {
            const item = INCIDENTS[key];
            const isSelected = selectedIncident === key;
            return (
              <button
                key={key}
                type="button"
                className={`incident-choice-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedIncident(key)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  border: isSelected ? '2px solid var(--blue)' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  background: isSelected ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '24px', lineHeight: 1 }}>{item.icon}</span>
                <div>
                  <strong style={{ display: 'block', fontSize: '14px', color: isSelected ? 'var(--blue)' : 'var(--navy)' }}>
                    {lang === 'mr' ? item.labelMr : item.labelEn}
                  </strong>
                  <small style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {lang === 'mr' ? item.subMr : item.subEn}
                  </small>
                </div>
              </button>
            );
          })}
        </div>

        {/* Delay Minutes Adjustment (when Delay or Detour selected) */}
        {(selectedIncident === 'delay' || selectedIncident === 'detour') && (
          <div className="form-field" style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
              {lang === 'mr' ? 'अंदाजे उशीर (मिनिटे):' : 'Estimated Delay (Minutes):'}
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {[5, 10, 15, 20, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`chip-btn ${delayMinutes === mins ? 'active' : ''}`}
                  onClick={() => setDelayMinutes(mins)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: delayMinutes === mins ? '2px solid var(--blue)' : '1px solid #cbd5e1',
                    background: delayMinutes === mins ? 'var(--blue)' : '#fff',
                    color: delayMinutes === mins ? '#fff' : 'var(--navy)',
                    cursor: 'pointer',
                  }}
                >
                  +{mins}m
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="180"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Math.max(1, Number(e.target.value)))}
                className="form-input"
                style={{ width: '80px', padding: '6px 8px', fontSize: '12px' }}
                aria-label="Custom delay minutes"
              />
            </div>
          </div>
        )}

        {/* Short Optional Note */}
        <div className="form-field" style={{ marginBottom: '18px' }}>
          <label htmlFor="driverNoteInput" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--navy)', marginBottom: '6px' }}>
            {lang === 'mr' ? '२. स्पष्टीकरण टीप (ऐच्छिक):' : '2. Explanation / Note (Optional):'}
          </label>
          <input
            id="driverNoteInput"
            type="text"
            className="form-input"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder={lang === 'mr' ? 'उदा. मुख्य गेटजवळ ट्रॅफिक' : 'e.g. Heavy congestion near main campus gate'}
            maxLength={200}
            style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
          />
          <small style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            {lang === 'mr'
              ? 'विद्यार्थी व कर्मचाऱ्यांना दिसणारा स्पष्ट संदेश.'
              : 'This note is immediately visible to students and riders on the public dashboard.'}
          </small>
        </div>

        {/* Explicit Submit Button */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting || !currentUser}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isSubmitting
            ? (lang === 'mr' ? 'अहवाल पाठवत आहे…' : 'Publishing Report to Server…')
            : (lang === 'mr'
                ? `🚀 ${INCIDENTS[selectedIncident].labelMr} नोंदवा (बस #${assignedBusId})`
                : `🚀 Submit ${INCIDENTS[selectedIncident].labelEn} for Bus #${assignedBusId}`)}
        </button>
      </form>
    </div>
  );
};
