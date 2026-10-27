import React, { useState } from 'react';
import type { UserProfile } from '../../types/index.ts';
import { loginUser } from '../../lib/api.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  initialMessage?: string | null;
}

const DEMO_PRESETS = [
  {
    label: 'Driver Ramesh',
    roleTag: 'Driver (Bus #1)',
    username: 'driver_ramesh',
    password: 'DriverPass@2026',
    description: 'Permitted to report only for assigned Bus #1 (North Campus).',
  },
  {
    label: 'Driver Suresh',
    roleTag: 'Driver (Bus #2)',
    username: 'driver_suresh',
    password: 'DriverPass@2026',
    description: 'Permitted to report only for assigned Bus #2 (City Connector).',
  },
  {
    label: 'Dispatcher',
    roleTag: 'Operator',
    username: 'dispatcher',
    password: 'OperatorPass@2026',
    description: 'Authorized to publish & correct reports across all routes.',
  },
  {
    label: 'System Admin',
    roleTag: 'Admin',
    username: 'admin',
    password: 'AdminPass@2026',
    description: 'Privileged access: configure routes & inspect accounts.',
  },
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMessage,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialMessage || null);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const user = await loginUser(username.trim(), password);
      onSuccess(user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Authentication failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = (preset: typeof DEMO_PRESETS[0]) => {
    setUsername(preset.username);
    setPassword(preset.password);
    setErrorMessage(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container auth-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">CAMPUS TRANSIT ACCESS CONTROL</div>
            <h2 id="auth-modal-title" className="modal-title">
              Sign In to Operations Console
            </h2>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="auth-explainer">
            Riders can browse live statuses, delays, and update history publicly without logging in.
            Staff, drivers, and transport operators authenticate below to report or manage operations.
          </p>

          {errorMessage && (
            <div className="alert-box alert-error" role="alert" style={{ marginBottom: '16px' }}>
              <span className="alert-icon">⚠</span>
              <div>
                <strong>Authentication Notice</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="auth-username" className="form-label">
                Username
              </label>
              <input
                id="auth-username"
                type="text"
                className="input-field"
                placeholder="e.g. driver_ramesh or dispatcher"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-password" className="form-label">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                className="input-field"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary auth-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating with Server…' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Credentials Panel */}
          <div className="demo-credentials-box">
            <div className="demo-header">
              <span className="demo-badge">DEMO EVALUATION ACCOUNTS</span>
              <small>Click to pre-fill test credentials</small>
            </div>
            <div className="demo-presets-grid">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.username}
                  type="button"
                  className={`preset-card ${username === preset.username ? 'selected' : ''}`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="preset-top">
                    <strong>{preset.label}</strong>
                    <span className="preset-role">{preset.roleTag}</span>
                  </div>
                  <p className="preset-desc">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="auth-security-notes">
            <small>
              🔒 <strong>Security Implementation:</strong> Server-enforced sessions stored in SQLite with
              Argon2id password hashing, HttpOnly SameSite=Lax cookies, CSRF validation tokens, and login
              rate limiting (max 5 failed attempts per 60s).
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};
