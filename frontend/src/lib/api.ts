import type {
  Bus,
  BusDetail,
  BusUpdatePayload,
  BusUpdateRecord,
  GpsQueryResponse,
  GpsSubmissionPayload,
  GpsTelemetry,
  SystemStatus,
  UserProfile,
  AuthSessionResponse,
  AdminUserRecord,
  CreateBusPayload,
  UpdateBusPayload,
} from '../types/index.ts';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Token storage helpers
const TOKEN_STORAGE_KEY = 'campus_transit_session_token';
const CSRF_STORAGE_KEY = 'campus_transit_csrf_token';

export function getStoredSessionToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredCsrfToken(): string | null {
  // Check document cookie first, fallback to localStorage
  const match = document.cookie.match(new RegExp('(^| )campus_transit_csrf=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return localStorage.getItem(CSRF_STORAGE_KEY);
}

export function setStoredAuthTokens(sessionToken: string, csrfToken: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, sessionToken);
  localStorage.setItem(CSRF_STORAGE_KEY, csrfToken);
}

export function clearStoredAuthTokens(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(CSRF_STORAGE_KEY);
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const sessionToken = getStoredSessionToken();
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  const csrfToken = getStoredCsrfToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`;
    let errorDetail: unknown = null;

    try {
      const data = await res.json();
      errorDetail = data;

      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((e: { loc?: string[]; msg?: string }) => {
            const loc = e.loc ? e.loc.filter(x => x !== 'body').join('.') : '';
            return loc ? `${loc}: ${e.msg}` : e.msg;
          })
          .join('\n');
      } else if (data.message) {
        errorMessage = data.message;
      }
    } catch {
      // Body not JSON
    }

    if (res.status === 401) {
      if (!errorMessage || errorMessage.startsWith('HTTP Error')) {
        errorMessage = 'Authentication required. Please sign in with an authorized account.';
      }
    } else if (res.status === 403) {
      if (!errorMessage || errorMessage.startsWith('HTTP Error')) {
        errorMessage = 'Permission denied: Your role is not authorized for this operation.';
      }
    } else if (res.status === 409) {
      errorMessage = errorMessage || 'Conflict: Out-of-order data submission.';
    }

    throw new ApiError(errorMessage, res.status, errorDetail);
  }

  return res.json() as Promise<T>;
}

// --- Public Read Endpoints (Rider Experience - No Login Required) ---

export async function fetchHealth(): Promise<{ status: string; service: string }> {
  const res = await fetch(`${BASE_URL}/api/health`, { credentials: 'include' });
  return handleResponse(res);
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${BASE_URL}/api/system/status`, { credentials: 'include' });
  return handleResponse(res);
}

export async function fetchBuses(statusFilter?: string): Promise<Bus[]> {
  const url = statusFilter && statusFilter !== 'All'
    ? `${BASE_URL}/api/buses?status=${encodeURIComponent(statusFilter)}`
    : `${BASE_URL}/api/buses`;
  const res = await fetch(url, { credentials: 'include' });
  return handleResponse(res);
}

export async function fetchBus(busId: number): Promise<BusDetail> {
  const res = await fetch(`${BASE_URL}/api/buses/${busId}`, { credentials: 'include' });
  return handleResponse(res);
}

export async function fetchRecentUpdates(limit = 10, busId?: number): Promise<BusUpdateRecord[]> {
  let url = `${BASE_URL}/api/updates?limit=${limit}`;
  if (busId) url += `&bus_id=${busId}`;
  const res = await fetch(url, { credentials: 'include' });
  return handleResponse(res);
}

export async function fetchBusGps(busId: number): Promise<GpsQueryResponse> {
  const res = await fetch(`${BASE_URL}/api/buses/${busId}/gps`, { credentials: 'include' });
  return handleResponse(res);
}

// --- Authentication Endpoints ---

export async function loginUser(username: string, password: string): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include',
  });
  const data = await handleResponse<AuthSessionResponse>(res);
  setStoredAuthTokens(data.session_token, data.csrf_token);
  return data.user;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers,
      credentials: 'include',
    });
    if (res.status === 401) {
      clearStoredAuthTokens();
      return null;
    }
    const data = await handleResponse<{ authenticated: boolean; user: UserProfile }>(res);
    return data.user;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    const headers = getAuthHeaders();
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
  } finally {
    clearStoredAuthTokens();
  }
}

// --- Protected Write Endpoints (Role-Based Authorization) ---

export async function publishUpdate(
  busId: number,
  payload: BusUpdatePayload,
  fallbackKey?: string
): Promise<BusUpdateRecord> {
  const headers = getAuthHeaders();
  if (fallbackKey && !headers['Authorization']) {
    headers['X-Operator-Key'] = fallbackKey;
  }

  const res = await fetch(`${BASE_URL}/api/buses/${busId}/updates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  return handleResponse(res);
}

export async function submitGpsTelemetry(
  busId: number,
  payload: GpsSubmissionPayload
): Promise<GpsTelemetry> {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/buses/${busId}/gps`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  return handleResponse(res);
}

// --- Administrator Privileged Endpoints ---

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/admin/users`, {
    headers,
    credentials: 'include',
  });
  return handleResponse(res);
}

export async function createAdminBus(payload: CreateBusPayload): Promise<{ id: number; bus_code: string; status: string }> {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/admin/buses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  return handleResponse(res);
}

export async function updateAdminBus(busId: number, payload: UpdateBusPayload): Promise<Bus> {
  const headers = getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/admin/buses/${busId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  return handleResponse(res);
}
