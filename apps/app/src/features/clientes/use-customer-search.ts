import { useEffect, useState } from "react";
import { useApp } from "../../lib/app-context";
import type { Customer } from "../../data/types";

/**
 * Búsqueda de clientes con el mismo debounce que la de productos. Con el
 * término vacío devuelve los primeros por orden alfabético: fiar suele ser
 * para los mismos habitués, y así se elige sin tipear.
 */
export function useCustomerSearch(term: string, enabled = true) {
  const { repos } = useApp();
  const [results, setResults] = useState<Customer[]>([]);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      return;
    }
    const trimmed = term.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = trimmed === ""
        ? await repos.customers.list(8)
        : await repos.customers.search(trimmed, 8);
      if (!cancelled) setResults(found);
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, repos, enabled]);

  return results;
}
