import { useCallback, useEffect, useState } from "react";

/**
 * Paginación server-side genérica: pide `pageSize + 1` filas para saber si
 * hay página siguiente sin una query de COUNT aparte, y nunca trae a
 * memoria más de una página. `fetchPage` debe ser estable (useCallback)
 * o esto reconsulta en cada render.
 */
export function usePaginatedList<T>(
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
  pageSize = 20,
) {
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const reload = useCallback(async () => {
    const rows = await fetchPage(pageSize + 1, page * pageSize);
    setHasMore(rows.length > pageSize);
    setItems(rows.slice(0, pageSize));
  }, [fetchPage, page, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    items,
    page,
    hasMore,
    reload,
    nextPage: () => setPage((p) => (hasMore ? p + 1 : p)),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    resetPage: () => setPage(0),
  };
}
