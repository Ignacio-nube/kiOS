/**
 * Fila de lista propia de kiOS (no shadcn): productos, ventas, movimientos.
 * Alta fija y generosa (48px), separador hairline, hover sutil.
 */
import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0",
        interactive && "cursor-pointer transition-colors hover:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
ListRow.displayName = "ListRow";

/** Columna principal (nombre + detalle secundario). */
export function ListRowMain({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 flex-1", className)} {...props} />;
}

export function ListRowTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("truncate text-sm font-medium", className)} {...props} />;
}

export function ListRowDetail({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("truncate text-xs text-muted-ink", className)} {...props} />;
}
