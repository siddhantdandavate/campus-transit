import React, { useState } from 'react';
import type { UserProfile } from '../../types/index.ts';
import { loginUser } from '../../lib/api.ts';

interface DriverLoginPageProps {
  onSuccess: (user: UserProfile) => void;
  onBackToWelcome: () => void;
  onGoToPublic: () => void;
}

const DRIVER_PRESETS = [
  {
    label: 'Driver Ramesh',
    busTag: 'Bus #1 • North Campus Loop',
    username: 'driver_ramesh',
    password: 'DriverPass@2026',
    description: 'Assigned to Bus #1. Permitted to report updates for North Campus Loop only.',
  },
  {
    label: 'Driver Suresh',
    busTag: 'Bus #2 • City Connector',
    username: 'driver_suresh',
    password: 'DriverPass@2026',
    description: 'Assigned to Bus #2. Permitted to report updates for City Connector only.',
  },
];

export const DriverLoginPage: React.FC<DriverLoginPageProps> = ({
  onSuccess,
  onBackToWelcome,
  onGoToPublic,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your driver username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const user = await loginUser(username.trim(), password);
      onSuccess(user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication failed. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = (preset: typeof DRIVER_PRESETS[0]) => {
    setUsername(preset.username);
    setPassword(preset.password);
    setErrorMessage(null);
  };

  return (
    <div className="driver-login-page">
      {/* Top Bar Navigation */}
      <header className="driver-login-header">
        <button
          type="button"
          className="btn-back-link"
          onClick={onBackToWelcome}
          aria-label="Back to welcome page"
        >
          ← Back to Role Selection
        </button>

        <div className="driver-header-brand">
          <div className="brand-badge" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
            CT
          </div>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--navy)' }}>
            Campus Transit
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="driver-login-main">
        <div className="driver-login-card">
          <div className="driver-card-header">
            <div className="driver-login-icon" aria-hidden="true">
              🚌
            </div>
            <div>
              <span className="driver-badge">AUTHORIZED VEHICLE OPERATOR</span>
              <h1 className="driver-login-title">Bus Driver Sign In</h1>
              <p className="driver-login-sub">
                Enter your driver credentials to access your assigned vehicle controls and report service updates.
              </p>
            </div>
          </div>

          {/* Safety Notice Banner */}
          <div className="driver-safety-banner" role="note">
            <span className="safety-icon">⚠️</span>
            <div>
              <strong>Safety Reminder:</strong>
              <p>Only interact with this console when your bus is completely stopped and safely parked.</p>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="alert-box alert-error" role="alert" style={{ marginBottom: '16px' }}>
              <span className="alert-icon">⚠</span>
              <div>
                <strong>Authentication Failed</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Driver Credentials Form */}
          <form onSubmit={handleSubmit} className="driver-form">
            <div className="form-group">
              <label htmlFor="driver-username" className="form-label">
                Driver Username
              </label>
              <input
                id="driver-username"
                type="text"
                className="input-field"
                placeholder="e.g. driver_ramesh"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="driver-password" className="form-label">
                Password
              </label>
              <input
                id="driver-password"
                type="password"
                className="input-field"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              id="btn-submit-driver-login"
              type="submit"
              className="btn-primary driver-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating with Server…' : 'Sign In to Driver Console →'}
            </button>
          </form>

          {/* Quick Demo Accounts for Evaluation */}
          <div className="driver-demo-box">
            <div className="driver-demo-header">
              <span className="driver-demo-badge">PRESET EVALUATION ACCOUNTS</span>
              <small>Click to auto-fill driver test credentials</small>
            </div>

            <div className="driver-presets-grid">
              {DRIVER_PRESETS.map((preset) => (
                <button
                  key={preset.username}
                  type="button"
                  className={`preset-card ${username === preset.username ? 'selected' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="preset-top">
                    <strong>{preset.label}</strong>
                    <span className="preset-role" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                      {preset.busTag}
                    </span>
                  </div>
                  <p className="preset-desc">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Return Links */}
          <div className="driver-login-footer-links">
            <button
              type="button"
              className="text-link-btn"
              onClick={onGoToPublic}
            >
              Looking for bus routes instead? Browse as Student / Public User →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
