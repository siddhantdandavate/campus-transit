import React, { useState, useEffect, useCallback } from 'react';
import type { Bus, BusUpdateRecord, UserProfile } from '../types/index.ts';
import { fetchBuses, fetchRecentUpdates, fetchCurrentUser, logoutUser } from '../lib/api.ts';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen.tsx';
import { StudentDashboard } from '../features/student/StudentDashboard.tsx';
import { DriverLoginPage } from '../features/auth/DriverLoginPage.tsx';
import { DriverWorkspace } from '../features/driver/DriverWorkspace.tsx';
import { OperatorConsole } from '../features/operator/OperatorConsole.tsx';
import { AdminConsole } from '../features/admin/AdminConsole.tsx';
import { AuthModal } from '../features/auth/AuthModal.tsx';
import { OfflineBanner } from '../components/OfflineBanner.tsx';

type AppViewMode = 'welcome' | 'student' | 'driver-login' | 'driver' | 'staff';

const parseHashRoute = (): { view: AppViewMode; subTab?: 'routes' | 'updates' | 'map' | 'operator' | 'admin' } => {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (hash === 'routes' || hash === 'student') return { view: 'student', subTab: 'routes' };
  if (hash === 'map') return { view: 'student', subTab: 'map' };
  if (hash === 'updates') return { view: 'student', subTab: 'updates' };
  if (hash === 'driver') return { view: 'driver' };
  if (hash === 'driver-login') return { view: 'driver-login' };
  if (hash === 'operator') return { view: 'staff', subTab: 'operator' };
  if (hash === 'admin') return { view: 'staff', subTab: 'admin' };
  return { view: 'welcome' };
};

export const App: React.FC = () => {
  const [viewState, setViewState] = useState(parseHashRoute);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<BusUpdateRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isStaffAuthModalOpen, setIsStaffAuthModalOpen] = useState<boolean>(false);
  const [staffModalMessage, setStaffModalMessage] = useState<string | null>(null);

  // Operator preselected correction state
  const [preselectedBusId, setPreselectedBusId] = useState<number | null>(null);
  const [preselectedTargetUpdateId, setPreselectedTargetUpdateId] = useState<number | null>(null);

  const navigateTo = (view: AppViewMode, subTab?: 'routes' | 'updates' | 'map' | 'operator' | 'admin') => {
    setViewState({ view, subTab });
    if (view === 'welcome') {
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname);
      }
    } else if (view === 'student') {
      window.location.hash = subTab || 'routes';
    } else if (view === 'driver-login') {
      window.location.hash = 'driver-login';
    } else if (view === 'driver') {
      window.location.hash = 'driver';
    } else if (view === 'staff') {
      window.location.hash = subTab || 'operator';
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [busData, updateData] = await Promise.all([
        fetchBuses(),
        fetchRecentUpdates(15),
      ]);
      setBuses(busData);
      setRecentUpdates(updateData);
      setIsOffline(false);
      setIsLoading(false);
    } catch {
      setIsOffline(true);
      setIsLoading(false);
    }
  }, []);

  // Listen to browser hash changes (support browser back/forward and bookmarking)
  useEffect(() => {
    const handleHashChange = () => {
      setViewState(parseHashRoute());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Restore current session on mount without overriding explicit route or opening modal
  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        const route = parseHashRoute();
        // If user explicitly navigated to #driver and has driver role, show driver workspace
        if (user.role === 'driver' && route.view === 'driver') {
          setViewState({ view: 'driver' });
        }
      }
    });
  }, []);

  // Auto-refresh background polling every 10 seconds for live synchronized status
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    navigateTo('welcome');
  };

  const handleOpenStaffLogin = (message?: string) => {
    setStaffModalMessage(message || 'Sign in with transport operator or administrator credentials.');
    setIsStaffAuthModalOpen(true);
  };

  const handleInitiateCorrection = (busId: number, targetUpdateId: number) => {
    setPreselectedBusId(busId);
    setPreselectedTargetUpdateId(targetUpdateId);
    if (!currentUser || (currentUser.role !== 'operator' && currentUser.role !== 'admin')) {
      handleOpenStaffLogin('Sign in as transport operator to issue a transparent correction.');
    } else {
      navigateTo('staff', 'operator');
    }
  };

  // =========================================================================
  // VIEW 1: Dedicated Welcome Screen (Initial Entry Point)
  // =========================================================================
  if (viewState.view === 'welcome') {
    return (
      <div className="app-viewport">
        <WelcomeScreen
          currentUser={currentUser}
          isOffline={isOffline}
          onSelectStudent={() => navigateTo('student', 'routes')}
          onSelectDriver={() => {
            if (currentUser?.role === 'driver') {
              navigateTo('driver');
            } else {
              navigateTo('driver-login');
            }
          }}
          onOpenStaffLogin={() => handleOpenStaffLogin()}
          onLogout={handleLogout}
        />

        {/* Staff Authentication Modal (Only opens when Staff Sign In is explicitly clicked) */}
        <AuthModal
          isOpen={isStaffAuthModalOpen}
          onClose={() => {
            setIsStaffAuthModalOpen(false);
            setStaffModalMessage(null);
          }}
          initialMessage={staffModalMessage}
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsStaffAuthModalOpen(false);
            if (user.role === 'driver') {
              navigateTo('driver');
            } else if (user.role === 'admin') {
              navigateTo('staff', 'admin');
            } else {
              navigateTo('staff', 'operator');
            }
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Student / Public Transport Dashboard (Strictly Isolated)
  // Zero driver controls, zero driver navigation, zero driver identity tags.
  // =========================================================================
  if (viewState.view === 'student') {
    return (
      <StudentDashboard
        buses={buses}
        recentUpdates={recentUpdates}
        isLoading={isLoading}
        isOffline={isOffline}
        onRefresh={loadData}
        onReturnToWelcome={() => navigateTo('welcome')}
        onOpenStaffLogin={() => handleOpenStaffLogin('Sign in as transport operator to issue transparent corrections.')}
        onInitiateCorrection={handleInitiateCorrection}
        initialTab={viewState.subTab === 'map' ? 'map' : viewState.subTab === 'updates' ? 'updates' : 'routes'}
      />
    );
  }

  // =========================================================================
  // VIEW 3: Dedicated Bus Driver Login Screen
  // Prompts for driver credentials when no valid driver session exists.
  // =========================================================================
  if (viewState.view === 'driver-login' || (viewState.view === 'driver' && (!currentUser || currentUser.role !== 'driver'))) {
    return (
      <div className="app-viewport">
        <DriverLoginPage
          onSuccess={(user) => {
            setCurrentUser(user);
            if (user.role === 'driver') {
              navigateTo('driver');
            } else if (user.role === 'operator') {
              navigateTo('staff', 'operator');
            } else if (user.role === 'admin') {
              navigateTo('staff', 'admin');
            } else {
              navigateTo('student', 'routes');
            }
          }}
          onBackToWelcome={() => navigateTo('welcome')}
          onGoToPublic={() => navigateTo('student', 'routes')}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 4: Dedicated Bus Driver Workspace (Strictly Isolated)
  // Accessible ONLY after successful driver authentication.
  // Displays ONLY driver vehicle actions for server-assigned bus.
  // =========================================================================
  if (viewState.view === 'driver' && currentUser?.role === 'driver') {
    return (
      <DriverWorkspace
        buses={buses}
        currentUser={currentUser}
        isOffline={isOffline}
        onRefresh={loadData}
        onLogout={handleLogout}
        onReturnToWelcome={() => navigateTo('welcome')}
        onViewPublicDashboard={() => navigateTo('student', 'routes')}
      />
    );
  }

  // =========================================================================
  // VIEW 5: Authorized Staff Operations Console (Operator & Admin)
  // Preserves existing dispatcher and admin authorization with security boundary.
  // =========================================================================
  const isAuthorizedStaff = currentUser && (currentUser.role === 'operator' || currentUser.role === 'admin');

  if (!isAuthorizedStaff) {
    // Unauthenticated access to staff routes prompts for staff credentials
    return (
      <div className="app-viewport" style={{ display: 'grid', placeItems: 'center', padding: '32px' }}>
        <div className="auth-card" style={{ maxWidth: '440px', width: '100%', background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid var(--line)', textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--navy)' }}>Staff Authorization Required</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 24px' }}>
            The Transport Desk Operator Console is restricted to authorized dispatchers and system administrators.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleOpenStaffLogin('Sign in as dispatcher or system administrator.')}
            >
              Sign In to Staff Console →
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigateTo('welcome')}
            >
              ← Return to Welcome Page
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={isStaffAuthModalOpen}
          onClose={() => {
            setIsStaffAuthModalOpen(false);
            setStaffModalMessage(null);
          }}
          initialMessage={staffModalMessage}
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsStaffAuthModalOpen(false);
            if (user.role === 'driver') {
              navigateTo('driver');
            } else if (user.role === 'admin') {
              navigateTo('staff', 'admin');
            } else {
              navigateTo('staff', 'operator');
            }
          }}
        />
      </div>
    );
  }

  // Authenticated Staff Console Layout
  const staffSubTab = viewState.subTab || 'operator';

  return (
    <div className="staff-portal-layout">
      {/* Staff Header */}
      <header className="staff-topbar">
        <div className="staff-topbar-left">
          <div className="brand-badge" style={{ width: '38px', height: '38px', fontSize: '14px', background: '#334155' }}>
            CT
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '16px', color: 'var(--navy)', fontFamily: 'Manrope, sans-serif' }}>
                Transport Staff Console
              </strong>
              <span className={`role-tag role-${currentUser.role}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                {currentUser.role.toUpperCase()}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Logged in as {currentUser.full_name} • Fleet Dispatch & Route Governance
            </span>
          </div>
        </div>

        <div className="staff-topbar-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigateTo('student', 'routes')}
            title="View public student portal"
            style={{ fontSize: '12px' }}
          >
            👁 Public Student View
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigateTo('welcome')}
            title="Return to Welcome Screen"
            style={{ fontSize: '12px' }}
          >
            ← Welcome
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleLogout}
            style={{ fontSize: '12px', background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Staff Navigation Bar */}
      <nav className="staff-nav-strip">
        <div className="staff-nav-container">
          <div className="staff-tabs">
            <button
              type="button"
              className={`staff-tab-btn ${staffSubTab === 'operator' ? 'active' : ''}`}
              onClick={() => navigateTo('staff', 'operator')}
            >
              <span>✎ Transport Desk Operator Console</span>
            </button>
            {currentUser.role === 'admin' && (
              <button
                type="button"
                className={`staff-tab-btn ${staffSubTab === 'admin' ? 'active' : ''}`}
                onClick={() => navigateTo('staff', 'admin')}
              >
                <span>⚙ System Administrator Console</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Offline Alert Banner */}
      <OfflineBanner isOffline={isOffline} onRetry={loadData} />

      {/* Staff Main Workspace */}
      <main className="staff-main-content">
        {staffSubTab === 'operator' && (
          <OperatorConsole
            buses={buses}
            currentUser={currentUser}
            preselectedBusId={preselectedBusId}
            preselectedTargetUpdateId={preselectedTargetUpdateId}
            onOpenLogin={() => {}}
            onSuccess={() => {
              loadData();
              navigateTo('student', 'routes');
            }}
          />
        )}

        {staffSubTab === 'admin' && currentUser.role === 'admin' && (
          <AdminConsole
            buses={buses}
            onRefresh={loadData}
          />
        )}
      </main>
    </div>
  );
};
