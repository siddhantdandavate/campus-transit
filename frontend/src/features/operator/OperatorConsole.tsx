import React, { useState, useEffect } from 'react';
import type { Bus, BusUpdatePayload, IncidentTemplate, ServiceStatus, UserProfile } from '../../types/index.ts';
import { publishUpdate, fetchBus } from '../../lib/api.ts';

interface OperatorConsoleProps {
  buses: Bus[];
  currentUser: UserProfile | null;
  preselectedBusId?: number | null;
  preselectedTargetUpdateId?: number | null;
  onOpenLogin: () => void;
  onSuccess: () => void;
}

const TEMPLATES: IncidentTemplate[] = [
  {
    key: 'traffic',
    label: 'Traffic delay (+15m)',
    status: 'Delayed',
    delay: 15,
    note: 'Heavy traffic congestion along primary campus approach road. Allow extra travel time.',
  },
  {
    key: 'breakdown',
    label: 'Mechanical Breakdown',
    status: 'Breakdown',
    delay: 0,
    note: 'Vehicle mechanical breakdown reported. Maintenance team dispatched; ETA currently unconfirmed.',
  },
  {
    key: 'detour',
    label: 'Route detour (+10m)',
    status: 'Route change',
    delay: 10,
    note: 'Temporary diversion via Sports Complex due to active construction work.',
  },
  {
    key: 'cancelled',
    label: 'Trip cancelled',
    status: 'Service cancelled',
    delay: 0,
    note: 'Trip cancelled due to operational disruption. Next departure operating as planned.',
  },
  {
    key: 'cleared',
    label: 'All clear / On time',
    status: 'On time',
    delay: 0,
    note: 'Previous disruption has resolved; route is operating as scheduled.',
  },
];

export const OperatorConsole: React.FC<OperatorConsoleProps> = ({
  buses,
  currentUser,
  preselectedBusId,
  preselectedTargetUpdateId,
  onOpenLogin,
  onSuccess,
}) => {
  const [operatorKey] = useState<string>('staff123');
  const [selectedBusId, setSelectedBusId] = useState<number>(buses[0]?.id || 1);
  const [status, setStatus] = useState<ServiceStatus>('Delayed');
  const [delayMinutes, setDelayMinutes] = useState<number>(10);
  const [note, setNote] = useState<string>('');
  const [staffName, setStaffName] = useState<string>(currentUser?.full_name || 'Transport Desk');

  // Correction Mode States
  const [isCorrection, setIsCorrection] = useState<boolean>(false);
  const [supersedesUpdateId, setSupersedesUpdateId] = useState<number | null>(null);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [availableUpdates, setAvailableUpdates] = useState<{ id: number; label: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sync staff name when user changes
  useEffect(() => {
    if (currentUser?.full_name) {
      setStaffName(currentUser.full_name);
    }
  }, [currentUser]);

  // Sync preselected bus
  useEffect(() => {
    if (preselectedBusId) {
      setSelectedBusId(preselectedBusId);
    }
  }, [preselectedBusId]);

  // Load prior updates for correction dropdown
  useEffect(() => {
    let isMounted = true;
    if (selectedBusId) {
      fetchBus(selectedBusId)
        .then((detail) => {
          if (isMounted) {
            const items = (detail.updates || []).map((u) => ({
              id: u.id,
              label: `#${u.id} (${u.status}${u.delay_minutes ? ` +${u.delay_minutes}m` : ''}) — "${u.note.slice(0, 35)}…"`,
            }));
            setAvailableUpdates(items);
            if (preselectedTargetUpdateId) {
              setSupersedesUpdateId(preselectedTargetUpdateId);
              setIsCorrection(true);
            } else if (items.length > 0 && !supersedesUpdateId) {
              setSupersedesUpdateId(items[0].id);
            }
          }
        })
        .catch(() => {
          if (isMounted) setAvailableUpdates([]);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [selectedBusId, preselectedTargetUpdateId]);

  const applyTemplate = (tpl: IncidentTemplate) => {
    setStatus(tpl.status);
    setDelayMinutes(tpl.delay);
    setNote(tpl.note);
  };

  const handleStatusChange = (newStatus: ServiceStatus) => {
    setStatus(newStatus);
    if (newStatus === 'On time' || newStatus === 'Breakdown' || newStatus === 'Service cancelled') {
      setDelayMinutes(0);
    } else if (delayMinutes === 0 && newStatus === 'Delayed') {
      setDelayMinutes(10);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      onOpenLogin();
      return;
    }

    if (currentUser.role === 'driver') {
      setErrorMessage(
        'Driver permission denied: Drivers cannot publish operator reports or submit corrections here. Please use Driver Quick Mode.'
      );
      return;
    }

    if (note.trim().length < 4) {
      setErrorMessage('Disruption note must contain at least 4 characters.');
      return;
    }

    if (isCorrection) {
      if (!supersedesUpdateId) {
        setErrorMessage('Select the prior report that is being corrected.');
        return;
      }
      if (!correctionReason.trim() || correctionReason.trim().length < 4) {
        setErrorMessage('A clear correction reason (minimum 4 characters) is required.');
        return;
      }
    }

    const payload: BusUpdatePayload = {
      status,
      delay_minutes: delayMinutes,
      note: note.trim(),
      updated_by: staffName.trim() || currentUser.full_name,
      is_correction: isCorrection,
      supersedes_update_id: isCorrection ? supersedesUpdateId : null,
      correction_reason: isCorrection ? correctionReason.trim() : null,
    };

    setIsSubmitting(true);

    try {
      await publishUpdate(selectedBusId, payload, operatorKey);
      setIsSubmitting(false);
      setSuccessToast(isCorrection ? 'Correction published to audit trail.' : 'Service update published successfully.');
      setNote('');
      setCorrectionReason('');
      setIsCorrection(false);
      setTimeout(() => setSuccessToast(null), 3500);
      onSuccess();
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred while publishing update.');
      }
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div className="section-heading" style={{ marginBottom: '16px' }}>
        <h2>Transport Operator Console</h2>
        <p>Publish verified service disruptions or submit transparent corrections to existing reports.</p>
      </div>

      {/* Auth Banner */}
      {!currentUser ? (
        <div className="alert-box alert-error" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', marginBottom: '16px' }}>
          <span className="alert-icon">🔐</span>
          <div style={{ flex: 1 }}>
            <strong>Staff Authentication Required</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              You are currently viewing in anonymous rider mode. Sign in as a transport operator or administrator to publish or correct disruption reports.
            </p>
          </div>
          <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={onOpenLogin}>
            Sign In
          </button>
        </div>
      ) : currentUser.role === 'driver' ? (
        <div className="alert-box alert-error" style={{ marginBottom: '16px' }}>
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Driver Account Boundary</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
              You are signed in as <strong>{currentUser.full_name}</strong> (Driver). Drivers cannot publish operator reports or submit historical corrections. Please switch to the Driver Quick Mode tab.
            </p>
          </div>
        </div>
      ) : (
        <div className="alert-box alert-success" style={{ marginBottom: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>
          <span className="alert-icon">✓</span>
          <div>
            <strong>Authenticated Operator:</strong> {currentUser.full_name} (@{currentUser.username}) — Role: <span className="role-tag role-operator">{currentUser.role}</span>
          </div>
        </div>
      )}

      {successToast && (
        <div className="toast-notice" role="status">
          ✓ {successToast}
        </div>
      )}

      <form onSubmit={handleSubmit} className="stat-card" style={{ padding: '24px' }}>
        {errorMessage && <div className="form-error-box">{errorMessage}</div>}

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="busSelect">Target Route</label>
            <select
              id="busSelect"
              className="form-select"
              value={selectedBusId}
              onChange={(e) => setSelectedBusId(Number(e.target.value))}
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_code} — {b.route_name} ({b.origin} → {b.destination})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="staffName">Reported By</label>
            <input
              id="staffName"
              type="text"
              className="form-input"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Operator name or desk identifier"
              required
              maxLength={80}
            />
          </div>
        </div>

        {/* Quick incident templates */}
        <div className="form-field" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <label style={{ margin: '0 0 6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#64748b' }}>
            Quick Incident Templates
          </label>
          <div className="chip-group">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                className="chip-btn"
                onClick={() => applyTemplate(tpl)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="statusSelect">Service Status</label>
            <select
              id="statusSelect"
              className="form-select"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as ServiceStatus)}
            >
              <option value="On time">On time</option>
              <option value="Delayed">Delayed</option>
              <option value="Breakdown">Breakdown</option>
              <option value="Route change">Route change</option>
              <option value="Service cancelled">Service cancelled</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="delayMinutes">Delay Estimate (Minutes)</label>
            <input
              id="delayMinutes"
              type="number"
              min="0"
              max="240"
              className="form-input"
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Math.max(0, Number(e.target.value)))}
              disabled={status === 'On time' || status === 'Breakdown' || status === 'Service cancelled'}
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="note">Disruption Explanation (Rider Notice)</label>
          <textarea
            id="note"
            className="form-textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Mechanical issue cleared. Resuming regular departures from North Hostel."
            required
            minLength={4}
            maxLength={400}
          />
        </div>

        {/* Transparent Correction Toggle */}
        <div className="correction-card">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={isCorrection}
              onChange={(e) => setIsCorrection(e.target.checked)}
            />
            <span>This submission is a correction of a previous report (transparent supersession)</span>
          </label>

          {isCorrection && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #fde68a' }}>
              <div className="form-field">
                <label htmlFor="supersedes">Prior Report Being Corrected</label>
                <select
                  id="supersedes"
                  className="form-select"
                  value={supersedesUpdateId || ''}
                  onChange={(e) => setSupersedesUpdateId(Number(e.target.value))}
                  required={isCorrection}
                >
                  {availableUpdates.length === 0 ? (
                    <option value="">No previous updates available to correct</option>
                  ) : (
                    availableUpdates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="corrReason">Correction Justification / Reason</label>
                <input
                  id="corrReason"
                  type="text"
                  className="form-input"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g., Delay reduced from 30m to 10m following campus traffic clearance."
                  required={isCorrection}
                  minLength={4}
                  maxLength={200}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Publishing…' : isCorrection ? 'Publish Correction to Dashboard' : 'Publish Disruption Update'}
          </button>
        </div>
      </form>
    </div>
  );
};
