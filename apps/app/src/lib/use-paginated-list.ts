import { useCallback, useEffect, useState } from "react";

/**
 * Paginación server-side genérica: pide `pageSize + 1` filas para saber si
 * hay página siguiente sin una query de COUNT aparte, y nunca trae a
 * memoria más de una página. `fetchPage` debe ser estable (useCallback)
 * o esto reconsulta en cada render.
 *
 * `countAll` es OPCIONAL y también tiene que ser estable. Si se pasa, la
 * paginación puede mostrar páginas numeradas ("3 de 8") en vez de solo
 * anterior/siguiente. Tiene que contar EXACTAMENTE lo mismo que lista
 * `fetchPage`, o se ofrecen páginas vacías.
 */
export function usePaginatedList<T>(
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
  pageSize = 20,
  countAll?: () => Promise<number>,
) {
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  /** null = no se sabe (sin `countAll`): la UI cae a anterior/siguiente. */
  const [total, setTotal] = useState<number | null>(null);
  // `loading` arranca en true: hasta que resuelve el primer fetch no sabemos
  // si la lista está vacía o solo está cargando. Las pantallas usan
  // `loading && items.length === 0` para mostrar el skeleton sin parpadear
  // el estado vacío (y sin taparse la página anterior al paginar).
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPage(pageSize + 1, page * pageSize);
      // `hasMore` sale del fetch, no del total: es el dato autoritativo de
      // ESTA consulta, aunque el count haya quedado viejo.
      setHasMore(rows.length > pageSize);
      setItems(rows.slice(0, pageSize));
    } finally {
      setLoading(false);
    }
  }, [fetchPage, page, pageSize]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!countAll) {
      setTotal(null);
      return;
    }
    let cancelled = false;
    void countAll().then((n) => {
      if (!cancelled) setTotal(n);
    });
    return () => {
      cancelled = true;
    };
  }, [countAll]);

  const lastPage = total === null ? null : Math.max(0, Math.ceil(total / pageSize) - 1);

  // Si borrás filas estando en la última página, el offset queda fuera de
  // rango y la lista se ve vacía sin explicación. Converge en un paso.
  useEffect(() => {
    if (lastPage !== null && page > lastPage) setPage(lastPage);
  }, [lastPage, page]);

  return {
    items,
    page,
    hasMore,
    loading,
    total,
    reload,
    nextPage: () => setPage((p) => (hasMore ? p + 1 : p)),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    resetPage: () => setPage(0),
    goToPage: (next: number) =>
      setPage(() => Math.max(0, lastPage === null ? next : Math.min(next, lastPage))),
  };
}
