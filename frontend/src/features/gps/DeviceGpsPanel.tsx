import React, { useState, useEffect, useRef } from 'react';
import type { Bus, GpsQueryResponse, UserProfile } from '../../types/index.ts';
import { submitGpsTelemetry, fetchBusGps } from '../../lib/api.ts';
import { formatDateTime } from '../../lib/time.ts';

interface DeviceGpsPanelProps {
  buses: Bus[];
  currentUser: UserProfile | null;
  onOpenLogin: () => void;
}

export const DeviceGpsPanel: React.FC<DeviceGpsPanelProps> = ({ buses, currentUser, onOpenLogin }) => {
  const isDriver = currentUser?.role === 'driver';
  const isAdmin = currentUser?.role === 'admin';
  const canTransmit = isDriver || isAdmin;

  const [selectedBusId, setSelectedBusId] = useState<number>(() => {
    if (isDriver && currentUser?.assigned_bus_id) {
      return currentUser.assigned_bus_id;
    }
    return buses[0]?.id || 1;
  });

  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'prompting' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [latestPosition, setLatestPosition] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    timestamp: string;
  } | null>(null);
  const [transmissionError, setTransmissionError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number>(0);

  // Query state for riders inspecting coordinates
  const [queryBusId, setQueryBusId] = useState<number>(buses[0]?.id || 1);
  const [queriedGps, setQueriedGps] = useState<GpsQueryResponse | null>(null);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);

  const watchIdRef = useRef<number | null>(null);

  // Auto lock to assigned bus if driver
  useEffect(() => {
    if (isDriver && currentUser?.assigned_bus_id) {
      setSelectedBusId(currentUser.assigned_bus_id);
    }
  }, [isDriver, currentUser]);

  // Check geolocation support on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setPermissionStatus('unsupported');
    }
  }, []);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleStartTransmitting = () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    if (!canTransmit) {
      setTransmissionError('Only authorized drivers (or administrators) are permitted to transmit GPS telemetry.');
      return;
    }

    if (!('geolocation' in navigator)) {
      setPermissionStatus('unsupported');
      return;
    }

    setPermissionStatus('prompting');
    setTransmissionError(null);

    const onLocationSuccess = async (pos: GeolocationPosition) => {
      setPermissionStatus('granted');
      setIsTransmitting(true);

      const deviceIso = new Date(pos.timestamp).toISOString();
      const posData = {
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Number(pos.coords.accuracy.toFixed(1)),
        speed: pos.coords.speed !== null ? Number(pos.coords.speed.toFixed(1)) : null,
        timestamp: deviceIso,
      };

      setLatestPosition(posData);

      try {
        await submitGpsTelemetry(selectedBusId, {
          latitude: posData.latitude,
          longitude: posData.longitude,
          accuracy_meters: posData.accuracy,
          speed_mps: posData.speed,
          device_timestamp: posData.timestamp,
        });
        setSentCount((prev) => prev + 1);
        setTransmissionError(null);
      } catch (err: unknown) {
        setTransmissionError(err instanceof Error ? err.message : 'Failed to send telemetry');
      }
    };

    const onLocationError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setPermissionStatus('denied');
        setTransmissionError('Location permission denied by user or browser.');
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        setTransmissionError('GPS position unavailable. Ensure device location is enabled.');
      } else if (err.code === err.TIMEOUT) {
        setTransmissionError('Location request timed out. Retrying…');
      }
      setIsTransmitting(false);
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

  const handleStopTransmitting = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTransmitting(false);
  };

  const handleQueryGps = async () => {
    setIsQuerying(true);
    try {
      const res = await fetchBusGps(queryBusId);
      setQueriedGps(res);
    } catch {
      setQueriedGps(null);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="gps-panel">
      <div className="section-heading" style={{ marginBottom: '16px' }}>
        <h2>Verified Device GPS Telemetry (Conditional Scope)</h2>
        <p>Real-time device coordinate streaming with explicit permission and strict data separation.</p>
      </div>

      <div className="gps-separation-banner">
        <strong>STRICT DATA SEPARATION NOTICE:</strong>
        <div>
          GPS coordinates are raw device telemetry transmitted directly from an authenticated driver device.
          They are presented purely as raw spatial telemetry and are <strong>never</strong> conflated with
          staff-reported service announcements. A bus with active GPS may still experience traffic or delays
          documented in operator reports.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Transmitter Card (Driver / Device) */}
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--navy)' }}>
              Transmitter Console (Driver Device)
            </h3>
            {currentUser ? (
              <span className={`role-tag role-${currentUser.role}`}>{currentUser.role}</span>
            ) : (
              <span className="badge-offline">Public / Anonymous</span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px' }}>
            Transmits real browser coordinates to the campus transit server. Write operations are strictly protected by server authentication.
          </p>

          {!currentUser ? (
            <div className="alert-box alert-error" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', marginBottom: '14px' }}>
              <div>
                <strong>Authentication Required to Transmit</strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px' }}>
                  Anonymous riders can query GPS telemetry below. Drivers or administrators must sign in to transmit coordinates.
                </p>
              </div>
              <button type="button" className="btn-primary" style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap' }} onClick={onOpenLogin}>
                Sign In
              </button>
            </div>
          ) : !canTransmit ? (
            <div className="alert-box alert-error" style={{ marginBottom: '14px', fontSize: '12px' }}>
              ⚠ Operators cannot transmit GPS coordinates. Only authenticated drivers or admins are permitted.
            </div>
          ) : null}

          <div className="form-field">
            <label htmlFor="gpsBusSelect">
              Assign Transmission to Route {isDriver ? `(Locked to Assigned Bus #${currentUser?.assigned_bus_id})` : ''}
            </label>
            <select
              id="gpsBusSelect"
              className="form-select"
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(Number(e.target.value))}
              disabled={isTransmitting || isDriver}
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_code} — {b.route_name}
                </option>
              ))}
            </select>
          </div>

          {permissionStatus === 'unsupported' && (
            <div className="form-error-box">
              Geolocation is not supported by your browser or environment.
            </div>
          )}

          {permissionStatus === 'denied' && (
            <div className="form-error-box">
              Location permission was denied. Please allow location access in your browser settings to test device GPS.
            </div>
          )}

          {transmissionError && (
            <div className="form-error-box">
              {transmissionError}
            </div>
          )}

          <div style={{ margin: '14px 0' }}>
            {!isTransmitting ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartTransmitting}
                disabled={permissionStatus === 'unsupported'}
              >
                📡 Start Transmitting Device Coordinates
              </button>
            ) : (
              <button
                type="button"
                className="btn-danger"
                style={{ background: 'var(--red)', color: '#fff' }}
                onClick={handleStopTransmitting}
              >
                ⏹ Stop GPS Transmission
              </button>
            )}
          </div>

          {latestPosition && (
            <div className="gps-coords-card">
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--green)', marginBottom: '8px' }}>
                ● TRANSMITTING LIVE DEVICE COORDINATES ({sentCount} packets sent)
              </div>
              <div className="gps-data-row">
                <span>Latitude:</span>
                <b>{latestPosition.latitude}°</b>
              </div>
              <div className="gps-data-row">
                <span>Longitude:</span>
                <b>{latestPosition.longitude}°</b>
              </div>
              <div className="gps-data-row">
                <span>Accuracy:</span>
                <b>±{latestPosition.accuracy} meters</b>
              </div>
              <div className="gps-data-row">
                <span>Speed:</span>
                <b>{latestPosition.speed !== null ? `${(latestPosition.speed * 3.6).toFixed(1)} km/h` : 'Stationary / Unknown'}</b>
              </div>
              <div className="gps-data-row">
                <span>Device Timestamp:</span>
                <b>{formatDateTime(latestPosition.timestamp)}</b>
              </div>
            </div>
          )}
        </div>

        {/* Rider Query Card (Public Read-Only) */}
        <div className="stat-card">
          <h3 style={{ fontSize: '15px', margin: '0 0 10px', color: 'var(--navy)' }}>
            Query Route GPS Telemetry (Public Read)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 14px' }}>
            Check whether actual device coordinates have been received for any route. Publicly accessible by riders without logging in.
          </p>

          <div className="form-field">
            <label htmlFor="queryBus">Select Route to Query</label>
            <select
              id="queryBus"
              className="form-select"
              value={queryBusId}
              onChange={(e) => setQueryBusId(Number(e.target.value))}
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_code} — {b.route_name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleQueryGps}
            disabled={isQuerying}
          >
            {isQuerying ? 'Querying telemetry…' : 'Inspect GPS State ↗'}
          </button>

          {queriedGps && (
            <div className="gps-coords-card" style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                Telemetry Status: {' '}
                <span style={{
                  color: queriedGps.status === 'live' ? 'var(--green)' : queriedGps.status === 'stale' ? 'var(--amber)' : 'var(--muted)',
                  fontWeight: 800
                }}>
                  {queriedGps.status.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                {queriedGps.message}
              </div>

              {queriedGps.telemetry && (
                <>
                  <div className="gps-data-row">
                    <span>Coordinates:</span>
                    <b>{queriedGps.telemetry.latitude.toFixed(4)}, {queriedGps.telemetry.longitude.toFixed(4)}</b>
                  </div>
                  <div className="gps-data-row">
                    <span>Signal Accuracy:</span>
                    <b>±{Math.round(queriedGps.telemetry.accuracy_meters)}m</b>
                  </div>
                  <div className="gps-data-row">
                    <span>Device Timestamp:</span>
                    <b>{formatDateTime(queriedGps.telemetry.device_timestamp)}</b>
                  </div>
                  <div className="gps-data-row">
                    <span>Server Received:</span>
                    <b>{formatDateTime(queriedGps.telemetry.received_at)}</b>
                  </div>
                  <div className="gps-data-row">
                    <span>Telemetry Age:</span>
                    <b>{queriedGps.telemetry.age_seconds !== undefined ? `${queriedGps.telemetry.age_seconds}s ago` : 'Unknown'}</b>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
