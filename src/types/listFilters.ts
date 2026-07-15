/** Sort keys aligned with customer portal filter.vue / project.vue. */
export type SortOption =
  | 'date_newest'
  | 'date_oldest'
  | 'name_asc'
  | 'name_desc';

export type FilterOption = {
  label: string;
  value: string;
};

export type SortFilterOption = {
  label: string;
  value: SortOption;
};

export type ListFilterValues = {
  status: string | null;
  sort: SortOption;
};

export const DEFAULT_SORT: SortOption = 'date_newest';
