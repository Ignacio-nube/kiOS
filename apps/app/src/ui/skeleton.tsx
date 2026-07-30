/**
 * Skeleton: bloque neutro que pulsa mientras algo carga. Ocupa el mismo
 * espacio que el contenido real, así la pantalla no salta ni parpadea un
 * estado vacío antes de que lleguen los datos. Usa `bg-muted` (token del
 * design system) para verse bien en Claro/Oscuro/Negro sin tocar nada.
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden
      {...props}
    />
  );
}

/**
 * Filas fantasma con el mismo alto (48px) y separadores que ListRow, para
 * las listas paginadas (Productos, Stock, Hoy, Reportes). Cada fila tiene
 * un bloque de título ancho + uno angosto a la derecha (precio/total).
 */
export function ListRowSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
