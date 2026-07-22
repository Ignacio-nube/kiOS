import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { usePaginatedList } from "../../lib/use-paginated-list";
import { todayRange, formatTime } from "../../domain/dates";
import { Badge } from "../../ui/badge";
import { Money } from "../../ui/money";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { SaleDetailDialog } from "./SaleDetailDialog";

const PAGE_SIZE = 20;

export function VentasDiaScreen() {
  const { repos } = useApp();
  const [range] = useState(() => todayRange());
  const [totals, setTotals] = useState({ count: 0, totalCents: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (limit: number, offset: number) => repos.sales.listByRange(range, limit, offset),
    [repos, range],
  );
  const { items: sales, page, hasMore, reload, nextPage, prevPage } = usePaginatedList(fetchPage, PAGE_SIZE);

  const reloadTotals = useCallback(() => {
    void repos.sales.totalsByRange(range).then(setTotals);
  }, [repos, range]);

  useEffect(() => {
    reloadTotals();
  }, [reloadTotals]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Hoy</h1>
        <div className="text-right">
          <p className="text-xs text-muted-ink">{totals.count} venta{totals.count === 1 ? "" : "s"}</p>
          <Money cents={totals.totalCents} size="lg" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {sales.length === 0 ? (
          <EmptyState icon={Receipt} title="Todavía no hay ventas hoy" description="Las ventas que registrés van a aparecer acá." />
        ) : (
          <>
            {sales.map((sale) => (
              <ListRow key={sale.id} interactive onClick={() => setDetailId(sale.id)}>
                <ListRowMain>
                  <ListRowTitle>{formatTime(sale.createdAt)}</ListRowTitle>
                  {sale.voidedAt && <ListRowDetail>Anulada{sale.voidReason ? ` · ${sale.voidReason}` : ""}</ListRowDetail>}
                </ListRowMain>
                {sale.voidedAt && <Badge tone="danger">Anulada</Badge>}
                <Money cents={sale.totalCents} className={sale.voidedAt ? "text-muted-ink line-through" : ""} />
              </ListRow>
            ))}
            <Pagination page={page} hasMore={hasMore} onPrev={prevPage} onNext={nextPage} />
          </>
        )}
      </div>

      <SaleDetailDialog
        saleId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onVoided={() => {
          void reload();
          reloadTotals();
        }}
      />
    </div>
  );
}
