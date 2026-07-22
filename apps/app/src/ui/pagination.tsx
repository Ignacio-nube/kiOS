import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Pagination({
  page,
  hasMore,
  onPrev,
  onNext,
  className,
}: {
  page: number;
  hasMore: boolean;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (page === 0 && !hasMore) return null;
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-line bg-surface px-3 py-2", className)}>
      <span className="text-xs text-muted-ink">Página {page + 1}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={onPrev}>
          <ChevronLeft className="size-4" /> Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={!hasMore} onClick={onNext}>
          Siguiente <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
