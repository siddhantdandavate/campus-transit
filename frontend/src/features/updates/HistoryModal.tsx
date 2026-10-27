import React, { useEffect, useState } from 'react';
import type { BusDetail } from '../../types/index.ts';
import { fetchBus } from '../../lib/api.ts';
import { Modal } from '../../components/Modal.tsx';
import { StatusBadge } from '../../components/StatusBadge.tsx';
import { formatDateTime } from '../../lib/time.ts';

interface HistoryModalProps {
  busId: number | null;
  onClose: () => void;
  onInitiateCorrection: (busId: number, targetUpdateId: number) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  busId,
  onClose,
  onInitiateCorrection,
}) => {
  const [detail, setDetail] = useState<BusDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busId) {
      setDetail(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchBus(busId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Unable to load route history.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [busId]);

  if (!busId) return null;

  return (
    <Modal
      isOpen={busId !== null}
      onClose={onClose}
      title={detail ? `${detail.bus_code} — ${detail.route_name}` : 'Route Update History'}
      subtitle={detail ? `${detail.origin} → ${detail.destination} (Scheduled: ${detail.scheduled_arrival})` : 'Loading route details…'}
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
          Loading update audit trail…
        </div>
      ) : error ? (
        <div className="form-error-box">{error}</div>
      ) : detail && detail.updates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
          No update history recorded for this route yet.
        </div>
      ) : detail ? (
        <div className="timeline-list">
          {detail.updates.map((update) => {
            const isCorr = Boolean(update.is_correction);

            return (
              <div
                key={update.id}
                className={`timeline-entry ${isCorr ? 'is-correction' : ''}`}
              >
                <div className="timeline-top">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <StatusBadge status={update.status} />
                    {update.delay_minutes > 0 && update.status !== 'Service cancelled' && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--amber)' }}>
                        +{update.delay_minutes}m delay
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {formatDateTime(update.created_at)}
                  </span>
                </div>

                {isCorr && (
                  <div className="timeline-correction-details">
                    <strong>[TRANSPARENT CORRECTION]</strong> Corrected report #{update.supersedes_update_id || 'prior'}:
                    <div><em>"{update.correction_reason || 'Correction recorded'}"</em></div>
                  </div>
                )}

                <p className="timeline-note">{update.note}</p>

                <div className="timeline-footer">
                  <span>Logged by: {update.updated_by}</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      onClose();
                      onInitiateCorrection(detail.id, update.id);
                    }}
                  >
                    Correct this report ✎
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </Modal>
  );
};
