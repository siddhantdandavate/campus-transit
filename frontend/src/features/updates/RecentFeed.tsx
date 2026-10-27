import React from 'react';
import type { BusUpdateRecord } from '../../types/index.ts';
import { formatDateTime } from '../../lib/time.ts';

interface RecentFeedProps {
  updates: BusUpdateRecord[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export const RecentFeed: React.FC<RecentFeedProps> = ({
  updates,
  isLoading,
}) => {
  return (
    <section>
      <div className="section-heading" style={{ marginBottom: '14px' }}>
        <h2>Chronological disruption feed & audit log</h2>
        <p>Every announcement and verified correction is recorded for complete transparency.</p>
      </div>

      <div className="feed-container">
        {isLoading && updates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
            Loading latest disruptions…
          </div>
        ) : updates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
            No disruption updates published yet today.
          </div>
        ) : (
          updates.map((u) => {
            const isCorr = Boolean(u.is_correction);

            return (
              <div key={u.id} className="feed-row">
                <div className="feed-icon-bubble" aria-hidden="true">
                  {isCorr ? '✎' : '↗'}
                </div>
                <div className="feed-body">
                  <b>
                    {u.bus_code} · {u.route_name} — {u.status}
                    {u.delay_minutes > 0 && u.status !== 'Service cancelled' ? ` (+${u.delay_minutes}m)` : ''}
                  </b>
                  <p>
                    {isCorr && <span className="correction-badge">[CORRECTION]</span>}
                    {u.note}
                    <span style={{ color: '#64748b', marginLeft: '6px' }}>
                      · Reported by {u.updated_by}
                    </span>
                  </p>
                  {isCorr && u.correction_reason && (
                    <div style={{ fontSize: '10px', color: '#92400e', marginTop: '2px' }}>
                      Correction reason: {u.correction_reason}
                    </div>
                  )}
                </div>
                <div className="feed-time">{formatDateTime(u.created_at)}</div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
