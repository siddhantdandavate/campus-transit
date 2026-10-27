export type ServiceStatus =
  | 'On time'
  | 'Delayed'
  | 'Breakdown'
  | 'Route change'
  | 'Service cancelled';

export type FreshnessTier = 'fresh' | 'aging' | 'stale' | 'future' | 'unknown';

export type EtaType = 'on_time' | 'estimated' | 'unknown' | 'cancelled';

export interface Bus {
  id: number;
  bus_code: string;
  route_name: string;
  origin: string;
  destination: string;
  scheduled_arrival: string;
  status: ServiceStatus;
  delay_minutes: number;
  current_note: string;
  last_updated: string;
  updated_by: string;

  // Enriched fields from backend
  age_minutes?: number | null;
  freshness?: FreshnessTier;
  is_stale?: boolean;
  freshness_label?: string;
  estimated_arrival?: string | null;
  eta_type?: EtaType;
  eta_display?: string;
  latest_gps?: GpsTelemetry | null;
}

export interface BusUpdateRecord {
  id: number;
  bus_id: number;
  status: ServiceStatus;
  delay_minutes: number;
  note: string;
  updated_by: string;
  created_at: string;
  is_correction: boolean | number;
  supersedes_update_id?: number | null;
  correction_reason?: string;
  bus_code?: string;
  route_name?: string;
}

export interface BusDetail extends Bus {
  updates: BusUpdateRecord[];
  latest_gps?: GpsTelemetry | null;
}

export interface BusUpdatePayload {
  status: ServiceStatus;
  delay_minutes: number;
  note: string;
  updated_by: string;
  is_correction?: boolean;
  supersedes_update_id?: number | null;
  correction_reason?: string | null;
}

export interface GpsTelemetry {
  id: number;
  bus_id: number;
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  speed_mps?: number | null;
  heading_deg?: number | null;
  device_timestamp: string;
  received_at: string;
  age_seconds?: number;
  is_stale?: boolean;
  status?: 'live' | 'stale';
}

export interface GpsSubmissionPayload {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  speed_mps?: number | null;
  heading_deg?: number | null;
  device_timestamp: string;
}

export interface GpsQueryResponse {
  bus_id: number;
  has_gps: boolean;
  status: 'live' | 'stale' | 'unavailable';
  message: string;
  telemetry: GpsTelemetry | null;
}

export interface SystemStatus {
  service: string;
  status: string;
  server_time_utc: string;
  demo_mode: boolean;
  disclaimer: string;
  integrations: {
    digii_campus: {
      status: string;
      disclosure: string;
    };
    gps_tracking: {
      status: string;
      active_live_buses: number;
      stale_threshold_seconds: number;
      disclosure: string;
    };
  };
  freshness_thresholds: {
    fresh_minutes: number;
    aging_minutes: number;
    stale_minutes: number;
  };
}

export interface IncidentTemplate {
  key: string;
  label: string;
  status: ServiceStatus;
  delay: number;
  note: string;
}

export type UserRole = 'rider' | 'driver' | 'operator' | 'admin';

export interface UserProfile {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  assigned_bus_id?: number | null;
}

export interface AuthSessionResponse {
  status: string;
  session_token: string;
  csrf_token: string;
  user: UserProfile;
}

export interface AdminUserRecord {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  assigned_bus_id?: number | null;
  is_active: number | boolean;
  created_at: string;
}

export interface CreateBusPayload {
  bus_code: string;
  route_name: string;
  origin: string;
  destination: string;
  scheduled_arrival: string;
}

export interface UpdateBusPayload {
  route_name?: string;
  origin?: string;
  destination?: string;
  scheduled_arrival?: string;
}

