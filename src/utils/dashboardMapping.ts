import type { DashboardHailSlide, DashboardKpis, DashboardPayload, HailImpactTableRow } from '../types/dashboard';

export type DashboardStats = {
  activeJobs: number;
  schedules: number;
  requestedServices: number;
};

const FALLBACK_SLIDES: DashboardHailSlide[] = [
  {
    id: 'fallback-1',
    title: 'Season readiness',
    subtitle: 'Review your coverage before storm season.',
    date: '',
    maxHailInches: 0,
  },
];

function parseHailInches(value?: string | null): number {
  if (!value || value === '---') {
    return 0;
  }
  return Number(String(value).replace(/"/g, '').trim()) || 0;
}

export function parseDashboardStats(kpis?: DashboardKpis | null): DashboardStats {
  return {
    activeJobs: Number(kpis?.total_jobs ?? 0) || 0,
    schedules: Number(kpis?.future_schedules ?? 0) || 0,
    requestedServices: Number(kpis?.requested_services ?? 0) || 0,
  };
}

export function hailTableToSlides(rows: HailImpactTableRow[]): DashboardHailSlide[] {
  const slides = rows.map((item, index) => {
    const atLocation = parseHailInches(item.at_location);
    const oneMi = parseHailInches(item.one_mi);
    const threeMi = parseHailInches(item.three_mi);
    const tenMi = parseHailInches(item.ten_mi);
    const maxHail = Math.max(atLocation, oneMi, threeMi, tenMi);

    const dateValue = item.date_key || item.date || '';
    const formattedDate = dateValue
      ? new Date(dateValue).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
      : '';

    return {
      id: `${String(dateValue || index)}-${index}`,
      title: `Hail Impact (${maxHail.toFixed(2)} in)`,
      subtitle: `PI 1MI---| 3MI ${item.three_mi || '---'} | 10MI ${item.ten_mi || '---'} HAIL`,
      date: formattedDate,
      maxHailInches: maxHail,
    };
  });

  return slides.length > 0 ? slides : FALLBACK_SLIDES;
}

export function parseDashboardPayload(payload: DashboardPayload): {
  stats: DashboardStats;
  slides: DashboardHailSlide[];
  map: DashboardPayload['map'];
  coordinates: DashboardPayload['coordinates'];
} {
  return {
    stats: parseDashboardStats(payload.kpis),
    slides: hailTableToSlides(payload.hail_table ?? []),
    map: payload.map,
    coordinates: payload.coordinates,
  };
}
