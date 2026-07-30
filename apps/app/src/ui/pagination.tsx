import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Pagination as PaginationNav,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "./shadcn/pagination";

/** Cuántas páginas se muestran a cada lado de la actual antes de la elipsis. */
const NEIGHBOURS = 1;

/**
 * Qué números mostrar: siempre la primera, la última y la actual con sus
 * vecinas; el resto colapsa en "…". Devuelve páginas 1-based.
 */
export function pageWindow(current: number, totalPages: number): (number | "gap")[] {
  const wanted = new Set<number>([1, totalPages, current]);
  for (let d = 1; d <= NEIGHBOURS; d++) {
    wanted.add(current - d);
    wanted.add(current + d);
  }
  const shown = [...wanted]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const p of shown) {
    // Un hueco de exactamente 1 no se colapsa: la elipsis ocuparía lo mismo
    // que el número que esconde.
    if (previous !== 0 && p - previous === 2) out.push(previous + 1);
    else if (previous !== 0 && p - previous > 2) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

export function Pagination({
  page,
  hasMore,
  onPrev,
  onNext,
  total,
  pageSize,
  onGoToPage,
  className,
}: {
  /** Página actual, 0-based. */
  page: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Total de filas. `null`/ausente = desconocido: se cae a anterior/siguiente. */
  total?: number | null;
  pageSize?: number;
  onGoToPage?: (page: number) => void;
  className?: string;
}) {
  if (page === 0 && !hasMore) return null;

  const numbered = total != null && pageSize != null && onGoToPage != null;
  const totalPages = numbered ? Math.max(1, Math.ceil(total / pageSize)) : 0;
  const firstShown = page * (pageSize ?? 0) + 1;
  const lastShown = numbered ? Math.min((page + 1) * pageSize, total) : 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-surface px-3 py-2",
        className,
      )}
    >
      <p className="text-xs text-muted-ink">
        {numbered
          ? total === 0
            ? "Sin resultados"
            : <><span className="tnum font-medium text-ink">{firstShown}–{lastShown}</span> de <span className="tnum">{total}</span></>
          : `Página ${page + 1}`}
      </p>

      <PaginationNav>
        <PaginationContent>
          <PaginationItem>
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={onPrev} aria-label="Página anterior">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
          </PaginationItem>

          {numbered && pageWindow(page + 1, totalPages).map((entry, i) =>
            entry === "gap" ? (
              <PaginationItem key={`gap-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry}>
                <Button
                  variant={entry === page + 1 ? "primary" : "ghost"}
                  size="sm"
                  className="tnum min-w-9 px-2"
                  aria-label={`Página ${entry}`}
                  aria-current={entry === page + 1 ? "page" : undefined}
                  onClick={() => onGoToPage(entry - 1)}
                >
                  {entry}
                </Button>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <Button variant="ghost" size="sm" disabled={!hasMore} onClick={onNext} aria-label="Página siguiente">
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="size-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </PaginationNav>
    </div>
  );
}
