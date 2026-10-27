import React, { useState, useMemo } from 'react';
import type { Bus } from '../../types/index.ts';
import { RouteCard } from './RouteCard.tsx';

interface RouteOverviewProps {
  buses: Bus[];
  isLoading: boolean;
  onViewHistory: (busId: number) => void;
}

export const RouteOverview: React.FC<RouteOverviewProps> = ({
  buses,
  isLoading,
  onViewHistory,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const stats = useMemo(() => {
    const total = buses.length;
    const onTime = buses.filter(b => b.status === 'On time').length;
    const disruptions = buses.filter(b => b.status !== 'On time').length;
    return { total, onTime, disruptions };
  }, [buses]);

  const filteredBuses = useMemo(() => {
    return buses.filter(b => {
      const matchesFilter = activeFilter === 'All' || b.status === activeFilter;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        b.bus_code.toLowerCase().includes(query) ||
        b.route_name.toLowerCase().includes(query) ||
        b.origin.toLowerCase().includes(query) ||
        b.destination.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [buses, activeFilter, searchQuery]);

  return (
    <section>
      {/* Summary Statistics */}
      <div className="stats-grid">
        <article className="stat-card">
          <span className="stat-card-label">Routes monitored</span>
          <div className="stat-card-value">{isLoading ? '…' : stats.total}</div>
          <span className="stat-card-foot">Active campus lines</span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Operating on time</span>
          <div className="stat-card-value">{isLoading ? '…' : stats.onTime}</div>
          <span className="stat-card-foot positive">No delays reported</span>
        </article>
        <article className="stat-card">
          <span className="stat-card-label">Disruptions reported</span>
          <div className="stat-card-value">{isLoading ? '…' : stats.disruptions}</div>
          <span className="stat-card-foot warning">Delays, detours, or breakdowns</span>
        </article>
      </div>

      {/* Controls & Filter Bar */}
      <div className="controls-bar">
        <div className="section-heading">
          <h2>Campus route status</h2>
          <p>Real-time reports, departure estimates, and transparent disruption notices</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Search route or stop…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '180px', padding: '6px 10px', fontSize: '11px' }}
            aria-label="Filter routes by text"
          />

          <div className="filter-group">
            {[
              { id: 'All', label: 'All routes' },
              { id: 'On time', label: 'On time / Resumed' },
              { id: 'Delayed', label: 'Delayed' },
              { id: 'Breakdown', label: 'Breakdown' },
              { id: 'Route change', label: 'Route changed' },
              { id: 'Service cancelled', label: 'Cancelled' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-pill ${activeFilter === f.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Bus Cards */}
      {isLoading && !buses.length ? (
        <div className="stat-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          Loading route statuses from server…
        </div>
      ) : filteredBuses.length === 0 ? (
        <div className="stat-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          No bus routes match the current filter or search criteria.
        </div>
      ) : (
        <div className="bus-grid">
          {filteredBuses.map(bus => (
            <RouteCard
              key={bus.id}
              bus={bus}
              onViewHistory={onViewHistory}
            />
          ))}
        </div>
      )}
    </section>
  );
};
