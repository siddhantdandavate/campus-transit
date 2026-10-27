import React from 'react';
import type { UserProfile } from '../../types/index.ts';

interface WelcomeScreenProps {
  currentUser: UserProfile | null;
  isOffline: boolean;
  onSelectStudent: () => void;
  onSelectDriver: () => void;
  onOpenStaffLogin: () => void;
  onLogout: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  currentUser,
  isOffline,
  onSelectStudent,
  onSelectDriver,
  onOpenStaffLogin,
  onLogout,
}) => {
  return (
    <div className="welcome-page">
      {/* Top Welcome Header Bar */}
      <header className="welcome-header">
        <div className="welcome-brand">
          <div className="brand-badge welcome-badge">CT</div>
          <div>
            <strong className="welcome-brand-name">Campus Transit</strong>
            <span className="welcome-brand-sub">Smart Campus Transportation</span>
          </div>
        </div>

        <div className="welcome-header-actions">
          {currentUser ? (
            <div className="welcome-session-chip">
              <span className="welcome-user-role-badge role-tag">
                {currentUser.role.toUpperCase()}
              </span>
              <span className="welcome-user-name">
                {currentUser.full_name}
                {currentUser.assigned_bus_id ? ` (Bus #${currentUser.assigned_bus_id})` : ''}
              </span>
              <button
                type="button"
                className="btn-secondary welcome-signout-btn"
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="welcome-status-pill">
              <span className={`status-dot ${isOffline ? 'offline' : ''}`} />
              <span className="welcome-status-text">
                {isOffline ? 'Server Offline' : 'Live System Connected'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Role Selection Container */}
      <main className="welcome-main">
        <div className="welcome-hero">
          <span className="welcome-kicker">UNIVERSITY MOBILITY OPERATIONS</span>
          <h1 className="welcome-title">Welcome to Campus Transit</h1>
          <p className="welcome-subtitle">Smart Campus Transportation System</p>
          <p className="welcome-prompt">Select how you would like to continue.</p>
        </div>

        {/* Exactly Two Primary Role Cards */}
        <div className="welcome-cards-grid" role="region" aria-label="Role Selection Options">
          {/* Option 1: Student / Public User */}
          <section className="role-card student-card" aria-labelledby="role-student-title">
            <div className="role-card-header">
              <div className="role-icon-box student-icon-box" aria-hidden="true">
                <span className="role-emoji">🎓</span>
              </div>
              <span className="role-badge public-badge">PUBLIC ACCESS</span>
            </div>

            <h2 id="role-student-title" className="role-card-title">
              Student / Public User
            </h2>

            <p className="role-card-desc">
              View bus routes, schedules, service status, delays, and disruption updates.
            </p>

            <ul className="role-features-list">
              <li>
                <span className="check-icon">✓</span>
                <span>Live route schedules & estimated arrivals</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Real-time delay notices & transparent corrections</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Verified hardware GPS telemetry & route map links</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>No sign-in or account registration required</span>
              </li>
            </ul>

            <div className="role-card-action">
              <button
                id="btn-continue-student"
                type="button"
                className="btn-primary role-btn role-btn-student"
                onClick={onSelectStudent}
              >
                Continue as Student / User →
              </button>
              <small className="role-action-note">Instant public route overview</small>
            </div>
          </section>

          {/* Option 2: Bus Driver */}
          <section className="role-card driver-card" aria-labelledby="role-driver-title">
            <div className="role-card-header">
              <div className="role-icon-box driver-icon-box" aria-hidden="true">
                <span className="role-emoji">🚌</span>
              </div>
              <span className="role-badge driver-badge">AUTHORIZED OPERATOR</span>
            </div>

            <h2 id="role-driver-title" className="role-card-title">
              Bus Driver
            </h2>

            <p className="role-card-desc">
              Access your assigned bus information and manage transport service updates.
            </p>

            <ul className="role-features-list">
              <li>
                <span className="check-icon">✓</span>
                <span>Quick stationary reporting for delays & breakdowns</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Enforced server-side assigned vehicle lock</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>One-touch detour and service resumption broadcasts</span>
              </li>
              <li>
                <span className="check-icon">✓</span>
                <span>Optional live device GPS coordinate transmission</span>
              </li>
            </ul>

            <div className="role-card-action">
              <button
                id="btn-driver-login"
                type="button"
                className="btn-primary role-btn role-btn-driver"
                onClick={onSelectDriver}
              >
                {currentUser?.role === 'driver' ? 'Open Driver Console →' : 'Bus Driver Login →'}
              </button>
              <small className="role-action-note">
                {currentUser?.role === 'driver'
                  ? `Authenticated as ${currentUser.full_name}`
                  : 'Requires driver credentials'}
              </small>
            </div>
          </section>
        </div>

        {/* Clearly Separated Staff Access Mechanism (Not a 3rd primary choice) */}
        <aside className="welcome-staff-access" aria-label="Staff Access Link">
          <div className="welcome-staff-card">
            <div className="welcome-staff-text">
              <strong>Campus Dispatcher or System Administrator?</strong>
              <span>
                Authorized transport staff can sign in to configure routes or issue operator-level updates.
              </span>
            </div>
            <button
              id="btn-staff-portal"
              type="button"
              className="btn-secondary welcome-staff-btn"
              onClick={onOpenStaffLogin}
            >
              Staff Sign In →
            </button>
          </div>
        </aside>
      </main>

      {/* Footer with University Branding and Disclosures */}
      <footer className="welcome-footer">
        <div className="welcome-footer-content">
          <span>Campus Transit System</span>
          <span className="footer-dot">•</span>
          <span>Trustworthy Disruption Experience</span>
          <span className="footer-dot">•</span>
          <span>Verified Fleet Telemetry</span>
        </div>
      </footer>
    </div>
  );
};
