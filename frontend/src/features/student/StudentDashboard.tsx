import React, { useState } from 'react';
import type { Bus, BusUpdateRecord } from '../../types/index.ts';
import { RouteOverview } from '../routes/RouteOverview.tsx';
import { RecentFeed } from '../updates/RecentFeed.tsx';
import { HistoryModal } from '../updates/HistoryModal.tsx';
import { LiveBusMap } from '../map/LiveBusMap.tsx';
import { OfflineBanner } from '../../components/OfflineBanner.tsx';

interface StudentDashboardProps {
  buses: Bus[];
  recentUpdates: BusUpdateRecord[];
  isLoading: boolean;
  isOffline: boolean;
  onRefresh: () => void;
  onReturnToWelcome: () => void;
  onOpenStaffLogin: () => void;
  onInitiateCorrection?: (busId: number, targetUpdateId: number) => void;
  initialTab?: 'routes' | 'updates' | 'map';
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  buses,
  recentUpdates,
  isLoading,
  isOffline,
  onRefresh,
  onReturnToWelcome,
  onOpenStaffLogin,
  onInitiateCorrection,
  initialTab = 'routes',
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'updates' | 'map'>(initialTab);
  const [historyBusId, setHistoryBusId] = useState<number | null>(null);

  return (
    <div className="student-portal-layout">
      {/* 1. Student / Public Header Navigation Bar */}
      <header className="student-topbar">
        <div className="student-topbar-left">
          <div className="brand-badge" style={{ width: '38px', height: '38px', fontSize: '14px' }}>
            CT
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--navy)', fontFamily: 'Manrope, sans-serif' }}>
                Campus Transit
              </strong>
              <span className="role-tag public-badge" style={{ fontSize: '10px', padding: '2px 8px' }}>
                STUDENT & PUBLIC PORTAL
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Live schedules, verified disruption notices, and vehicle telemetry
            </span>
          </div>
        </div>

        <div className="student-topbar-right">
          <button
            type="button"
            className="btn-secondary student-return-btn"
            onClick={onReturnToWelcome}
            title="Return to Welcome Screen"
          >
            ← Welcome / Role Selection
          </button>
        </div>
      </header>

      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} onRetry={onRefresh} />

      {/* 2. Public Navigation Tab Bar */}
      <nav className="student-nav-strip" aria-label="Public Transport Navigation">
        <div className="student-nav-container">
          <div className="student-tabs">
            <button
              id="tab-student-routes"
              type="button"
              className={`student-tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
              onClick={() => setActiveTab('routes')}
            >
              <span className="tab-icon">▦</span>
              <span>Bus Routes & Live Status</span>
            </button>
            <button
              id="tab-student-map"
              type="button"
              className={`student-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
              onClick={() => setActiveTab('map')}
            >
              <span className="tab-icon">🗺️</span>
              <span>Live Bus Map</span>
            </button>
            <button
              id="tab-student-updates"
              type="button"
              className={`student-tab-btn ${activeTab === 'updates' ? 'active' : ''}`}
              onClick={() => setActiveTab('updates')}
            >
              <span className="tab-icon">◷</span>
              <span>Disruption Notices & History</span>
            </button>
          </div>

          <div className="student-status-badge">
            <span className={`status-dot ${isOffline ? 'offline' : ''}`} />
            <span>{isOffline ? 'Server Offline' : 'Live System Connected (10s Auto-Sync)'}</span>
          </div>
        </div>
      </nav>

      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} onRetry={onRefresh} />

      {/* 3. Main Public Content Body */}
      <main className="student-main-content">
        {activeTab === 'routes' && (
          <RouteOverview
            buses={buses}
            isLoading={isLoading}
            onViewHistory={(id) => setHistoryBusId(id)}
          />
        )}

        {activeTab === 'map' && (
          <LiveBusMap
            buses={buses}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        )}

        {activeTab === 'updates' && (
          <RecentFeed
            updates={recentUpdates}
            isLoading={isLoading}
            onRefresh={onRefresh}
          />
        )}

        {/* History Modal (audit trail of updates & transparent corrections) */}
        <HistoryModal
          busId={historyBusId}
          onClose={() => setHistoryBusId(null)}
          onInitiateCorrection={(busId, targetUpdateId) => {
            if (onInitiateCorrection) {
              onInitiateCorrection(busId, targetUpdateId);
            } else {
              onOpenStaffLogin();
            }
          }}
        />
      </main>

      {/* 4. Student & Public Footer */}
      <footer className="student-footer">
        <div className="student-footer-container">
          <div className="student-footer-disclaimer">
            <span>Verified campus transit communication • Times reflect driver and dispatch reports</span>
          </div>
          <div className="student-footer-staff-link">
            <span>Transport Operator or Administrator?</span>
            <button
              type="button"
              className="text-link-btn"
              onClick={onOpenStaffLogin}
              style={{ fontSize: '11px', textDecoration: 'underline', padding: '0 4px' }}
            >
              Staff Operations Portal →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
