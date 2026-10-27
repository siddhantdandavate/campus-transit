import React from 'react';
import type { Bus, UserProfile } from '../../types/index.ts';
import { DriverMode } from '../operator/DriverMode.tsx';
import { OfflineBanner } from '../../components/OfflineBanner.tsx';

interface DriverWorkspaceProps {
  buses: Bus[];
  currentUser: UserProfile;
  isOffline: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onReturnToWelcome: () => void;
  onViewPublicDashboard: () => void;
}

export const DriverWorkspace: React.FC<DriverWorkspaceProps> = ({
  buses,
  currentUser,
  isOffline,
  onRefresh,
  onLogout,
  onReturnToWelcome,
  onViewPublicDashboard,
}) => {
  const assignedBus = buses.find((b) => b.id === currentUser.assigned_bus_id);

  return (
    <div className="driver-workspace-layout">
      {/* 1. Dedicated Driver Header */}
      <header className="driver-topbar">
        <div className="driver-topbar-left">
          <div className="brand-badge driver-topbar-badge">
            🚌
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--navy)', fontFamily: 'Manrope, sans-serif' }}>
                Driver Operations Workspace
              </strong>
              <span className="role-tag role-driver" style={{ fontSize: '10px', padding: '2px 8px' }}>
                ASSIGNED: BUS #{currentUser.assigned_bus_id || 1}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {assignedBus ? `${assignedBus.bus_code} (${assignedBus.route_name})` : 'Vehicle reporting console'} • Logged in as {currentUser.full_name}
            </span>
          </div>
        </div>

        <div className="driver-topbar-actions">
          {/* Safe, clearly labeled way to view public student dashboard */}
          <button
            type="button"
            className="btn-secondary driver-view-public-btn"
            onClick={onViewPublicDashboard}
            title="Switch to public student dashboard"
          >
            👁 View Public Dashboard →
          </button>

          {/* Return to Welcome Page */}
          <button
            type="button"
            className="btn-secondary"
            onClick={onReturnToWelcome}
            title="Return to Welcome Screen"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            ← Welcome Screen
          </button>

          {/* Secure Sign Out Button */}
          <button
            type="button"
            className="btn-primary driver-signout-btn"
            onClick={onLogout}
            title="End driver session"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} onRetry={onRefresh} />

      {/* 2. Driver Main Reporting Workspace (No Student Tabs) */}
      <main className="driver-workspace-main">
        <DriverMode
          buses={buses}
          currentUser={currentUser}
          onOpenLogin={() => {}}
          onSuccess={onRefresh}
        />
      </main>

      {/* 3. Driver Workspace Footer */}
      <footer className="driver-footer">
        <div className="driver-footer-content">
          <span>🔒 Driver Station Session Active • Server-Enforced Vehicle Permissions</span>
          <span className="footer-dot">•</span>
          <span>Submit updates only while safely parked</span>
        </div>
      </footer>
    </div>
  );
};
