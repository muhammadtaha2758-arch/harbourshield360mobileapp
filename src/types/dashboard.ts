export interface DashboardKpis {
  total_jobs: number;
  future_schedules: number;
  requested_services: number;
}

export interface DashboardCoordinate {
  id?: number | string;
  latitude: number | string;
  longitude: number | string;
}

export interface DashboardMapCenter {
  latitude: number | null;
  longitude: number | null;
  address?: string;
  zip_code?: string;
}

export interface HailImpactTableRow {
  date?: string;
  date_key?: string;
  at_location?: string;
  one_mi?: string;
  three_mi?: string;
  ten_mi?: string;
}

export interface DashboardHailSlide {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  maxHailInches: number;
}

export interface DashboardPayload {
  success?: boolean;
  message?: string;
  google_maps_api_key?: string;
  kpis?: DashboardKpis;
  coordinates?: {
    success?: boolean;
    coordinates?: DashboardCoordinate[];
    total?: number;
  };
  map?: DashboardMapCenter;
  hail_table?: HailImpactTableRow[];
}
