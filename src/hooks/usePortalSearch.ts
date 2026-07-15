import { useCallback, useState } from 'react';
import type { SortOption } from '../types/listFilters';
import { DEFAULT_SORT } from '../types/listFilters';

type ClearOptions = {
  onClearFilters?: () => void;
};

export function usePortalSearch() {
  const [searchQuery, setSearchQuery] = useState('');

  const hasSearch = searchQuery.trim().length > 0;

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    hasSearch,
    clearSearch,
  };
}

/** Clear search + optional filter state in one action. */
export function createClearAllHandler(
  clearSearch: () => void,
  resetFilters?: () => void,
): () => void {
  return () => {
    clearSearch();
    resetFilters?.();
  };
}

export function defaultFilterReset(
  setStatusFilter: (v: string | null) => void,
  setSortBy: (v: SortOption) => void,
): () => void {
  return () => {
    setStatusFilter(null);
    setSortBy(DEFAULT_SORT);
  };
}
