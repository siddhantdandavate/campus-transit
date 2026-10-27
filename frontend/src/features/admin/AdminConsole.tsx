import React, { useState, useEffect } from 'react';
import type { Bus, AdminUserRecord, CreateBusPayload } from '../../types/index.ts';
import { fetchAdminUsers, createAdminBus, updateAdminBus } from '../../lib/api.ts';

interface AdminConsoleProps {
  buses: Bus[];
  onRefresh: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ buses, onRefresh }) => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  // New route form state
  const [busCode, setBusCode] = useState<string>('');
  const [routeName, setRouteName] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [scheduledArrival, setScheduledArrival] = useState<string>('09:00');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Edit route form state
  const [editingBusId, setEditingBusId] = useState<number>(buses[0]?.id || 1);
  const [editRouteName, setEditRouteName] = useState<string>('');
  const [editOrigin, setEditOrigin] = useState<string>('');
  const [editDestination, setEditDestination] = useState<string>('');
  const [editScheduledArrival, setEditScheduledArrival] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setAdminError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAdminError(err.message);
      }
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Sync edit form with chosen bus
  useEffect(() => {
    const selected = buses.find((b) => b.id === editingBusId);
    if (selected) {
      setEditRouteName(selected.route_name);
      setEditOrigin(selected.origin);
      setEditDestination(selected.destination);
      setEditScheduledArrival(selected.scheduled_arrival);
    }
  }, [editingBusId, buses]);

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);
    setIsCreating(true);

    const payload: CreateBusPayload = {
      bus_code: busCode.trim().toUpperCase(),
      route_name: routeName.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      scheduled_arrival: scheduledArrival.trim(),
    };

    try {
      const res = await createAdminBus(payload);
      setAdminSuccess(`Route ${res.bus_code} created successfully.`);
      setBusCode('');
      setRouteName('');
      setOrigin('');
      setDestination('');
      setScheduledArrival('09:00');
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAdminError(err.message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminSuccess(null);
    setIsUpdating(true);

    try {
      const updated = await updateAdminBus(editingBusId, {
        route_name: editRouteName.trim(),
        origin: editOrigin.trim(),
        destination: editDestination.trim(),
        scheduled_arrival: editScheduledArrival.trim(),
      });
      setAdminSuccess(`Route #${updated.id} (${updated.bus_code}) updated successfully.`);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAdminError(err.message);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="admin-console">
      <div className="console-header">
        <div>
          <span className="badge-admin">ADMINISTRATOR PRIVILEGED WORKSPACE</span>
          <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px' }}>System Configuration & User Management</h2>
          <p className="console-subtitle" style={{ margin: 0 }}>
            Privileged server-enforced controls for transit route topology and staff account inspection.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={loadUsers}>
          ↻ Refresh Accounts
        </button>
      </div>

      {adminError && (
        <div className="alert-box alert-error" style={{ margin: '16px 0' }}>
          <span className="alert-icon">⚠</span>
          <div>
            <strong>Administrator Action Error</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>{adminError}</p>
          </div>
        </div>
      )}

      {adminSuccess && (
        <div className="alert-box alert-success" style={{ margin: '16px 0' }}>
          <span className="alert-icon">✓</span>
          <div>
            <strong>Operation Successful</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>{adminSuccess}</p>
          </div>
        </div>
      )}

      <div className="admin-grid">
        {/* User Account Registry */}
        <section className="card admin-card">
          <div className="card-header">
            <h3>Registered User Accounts</h3>
            <span className="count-pill">{users.length} accounts</span>
          </div>
          <p className="card-desc">
            Accounts seeded for local role-boundary testing. Password hashes are strictly omitted from server responses.
          </p>

          {isLoadingUsers ? (
            <div className="loading-state">Loading user registry…</div>
          ) : (
            <div className="table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Full Name</th>
                    <th>Assigned Bus</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td><strong>{u.username}</strong></td>
                      <td>
                        <span className={`role-tag role-${u.role}`}>{u.role}</span>
                      </td>
                      <td>{u.full_name}</td>
                      <td>
                        {u.assigned_bus_id ? (
                          <span className="bus-pill">Bus #{u.assigned_bus_id}</span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        <span className="badge-active">{u.is_active ? 'Active' : 'Disabled'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Route Management Section */}
        <div className="admin-forms-col">
          {/* Create Route */}
          <section className="card admin-card">
            <div className="card-header">
              <h3>Register New Bus Route</h3>
            </div>
            <form onSubmit={handleCreateRoute} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="create-bus-code" className="form-label">
                    Route Code
                  </label>
                  <input
                    id="create-bus-code"
                    type="text"
                    className="input-field"
                    placeholder="e.g. BUS-05"
                    value={busCode}
                    onChange={(e) => setBusCode(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-route-name" className="form-label">
                    Route Name
                  </label>
                  <input
                    id="create-route-name"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Science Park Shuttle"
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="create-origin" className="form-label">
                    Origin
                  </label>
                  <input
                    id="create-origin"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Main Gate"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-destination" className="form-label">
                    Destination
                  </label>
                  <input
                    id="create-destination"
                    type="text"
                    className="input-field"
                    placeholder="e.g. Science Complex"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-scheduled-arrival" className="form-label">
                    Scheduled Time (HH:MM)
                  </label>
                  <input
                    id="create-scheduled-arrival"
                    type="text"
                    pattern="^\d{2}:\d{2}$"
                    className="input-field"
                    placeholder="09:15"
                    value={scheduledArrival}
                    onChange={(e) => setScheduledArrival(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={isCreating}>
                {isCreating ? 'Registering Route…' : '＋ Add Route'}
              </button>
            </form>
          </section>

          {/* Edit Route Configuration */}
          <section className="card admin-card">
            <div className="card-header">
              <h3>Edit Existing Route Schedule</h3>
            </div>
            <form onSubmit={handleUpdateRoute} className="admin-form">
              <div className="form-group">
                <label htmlFor="edit-bus-select" className="form-label">
                  Select Route to Configure
                </label>
                <select
                  id="edit-bus-select"
                  className="input-field"
                  value={editingBusId}
                  onChange={(e) => setEditingBusId(Number(e.target.value))}
                >
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      #{b.id} — {b.bus_code} ({b.route_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-route-name" className="form-label">
                    Route Name
                  </label>
                  <input
                    id="edit-route-name"
                    type="text"
                    className="input-field"
                    value={editRouteName}
                    onChange={(e) => setEditRouteName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-scheduled-arrival" className="form-label">
                    Scheduled Time (HH:MM)
                  </label>
                  <input
                    id="edit-scheduled-arrival"
                    type="text"
                    pattern="^\d{2}:\d{2}$"
                    className="input-field"
                    value={editScheduledArrival}
                    onChange={(e) => setEditScheduledArrival(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-origin" className="form-label">
                    Origin
                  </label>
                  <input
                    id="edit-origin"
                    type="text"
                    className="input-field"
                    value={editOrigin}
                    onChange={(e) => setEditOrigin(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-destination" className="form-label">
                    Destination
                  </label>
                  <input
                    id="edit-destination"
                    type="text"
                    className="input-field"
                    value={editDestination}
                    onChange={(e) => setEditDestination(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-secondary" disabled={isUpdating}>
                {isUpdating ? 'Saving Changes…' : 'Save Route Schedule'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
