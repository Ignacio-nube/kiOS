import { useEffect, useState } from "react";
import { useApp } from "../../lib/app-context";
import type { Product } from "../../data/types";

/** Búsqueda con debounce corto: margen para el driver WASM de la demo. */
export function useProductSearch(term: string) {
  const { repos } = useApp();
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === "") {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await repos.products.search(trimmed, 8);
      if (!cancelled) setResults(found);
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, repos]);

  return results;
}
