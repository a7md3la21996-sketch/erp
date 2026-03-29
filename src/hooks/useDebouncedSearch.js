import { useState, useEffect, useRef } from 'react';

/**
 * Debounced search hook.
 * Returns [searchInput, setSearchInput, debouncedSearch]
 * - searchInput: the immediate value (for the input field)
 * - setSearchInput: update the input
 * - debouncedSearch: the debounced value (for filtering/queries)
 */
export default function useDebouncedSearch(delay = 300) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setTimeout(() => setDebouncedSearch(searchInput), delay);
    return () => clearTimeout(timer.current);
  }, [searchInput, delay]);

  return [searchInput, setSearchInput, debouncedSearch];
}
