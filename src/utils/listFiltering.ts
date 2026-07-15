import type { SortOption } from '../types/listFilters';

export function matchesSearchQuery(
  query: string,
  fields: Array<string | null | undefined>,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return fields.some((field) => {
    const value = typeof field === 'string' ? field.trim().toLowerCase() : '';
    return value.length > 0 && value.includes(q);
  });
}

export function statusMatchesFilter(itemStatus: string | undefined, filter: string | null): boolean {
  if (!filter) {
    return true;
  }
  const normalized = String(itemStatus ?? '').trim().toLowerCase();
  const target = filter.trim().toLowerCase();
  if (!normalized || !target) {
    return false;
  }
  return normalized === target || normalized.includes(target);
}

export function parseSortableDate(raw: string | undefined): number {
  if (!raw || !raw.trim()) {
    return 0;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function sortByOption<T>(
  items: T[],
  sort: SortOption,
  getName: (item: T) => string,
  getDate: (item: T) => string | undefined,
): T[] {
  const copy = [...items];
  switch (sort) {
    case 'name_asc':
      copy.sort((a, b) => getName(a).localeCompare(getName(b), undefined, { sensitivity: 'base' }));
      break;
    case 'name_desc':
      copy.sort((a, b) => getName(b).localeCompare(getName(a), undefined, { sensitivity: 'base' }));
      break;
    case 'date_oldest':
      copy.sort((a, b) => parseSortableDate(getDate(a)) - parseSortableDate(getDate(b)));
      break;
    case 'date_newest':
    default:
      copy.sort((a, b) => parseSortableDate(getDate(b)) - parseSortableDate(getDate(a)));
      break;
  }
  return copy;
}

export function applyListFilters<T>(
  items: T[],
  options: {
    searchQuery?: string;
    searchFields: (item: T) => Array<string | null | undefined>;
    statusFilter?: string | null;
    getStatus?: (item: T) => string | undefined;
    sort?: SortOption;
    getName?: (item: T) => string;
    getDate?: (item: T) => string | undefined;
  },
): T[] {
  const query = options.searchQuery?.trim() ?? '';
  let result = items;

  if (query) {
    result = result.filter((item) => matchesSearchQuery(query, options.searchFields(item)));
  }

  if (options.statusFilter && options.getStatus) {
    result = result.filter((item) => statusMatchesFilter(options.getStatus!(item), options.statusFilter));
  }

  if (options.sort && options.getName && options.getDate) {
    result = sortByOption(result, options.sort, options.getName, options.getDate);
  }

  return result;
}
