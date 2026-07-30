import { useCallback, useEffect, useState } from "react";
import { Calculator, Receipt } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { useCashierNames } from "../cajeros/cashier-store";
import { usePaginatedList } from "../../lib/use-paginated-list";
import { todayRange, formatTime } from "../../domain/dates";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Money } from "../../ui/money";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import { ListRowSkeleton } from "../../ui/skeleton";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { SaleDetailDialog } from "./SaleDetailDialog";

const PAGE_SIZE = 20;

export function VentasDiaScreen({ onGoToReportes }: { onGoToReportes: () => void }) {
  const { repos } = useApp();
  // Los nombres salen del store ya hidratado: cero consultas por fila.
  const cashierNames = useCashierNames();
  const [range] = useState(() => todayRange());
  const [totals, setTotals] = useState({ count: 0, totalCents: 0 });
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchPage = useCallback(
    (limit: number, offset: number) => repos.sales.listByRange(range, limit, offset),
    [repos, range],
  );
  // `totals.count` NO sirve acá: es facturación y excluye las anuladas, que
  // el listado sí muestra. Ver `countByRange`.
  const countAll = useCallback(() => repos.sales.countByRange(range), [repos, range]);
  const { items: sales, page, hasMore, loading, total, reload, nextPage, prevPage, goToPage } =
    usePaginatedList(fetchPage, PAGE_SIZE, countAll);

  const reloadTotals = useCallback(() => {
    void repos.sales.totalsByRange(range).then(setTotals);
  }, [repos, range]);

  useEffect(() => {
    reloadTotals();
  }, [reloadTotals]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Hoy</h1>
        <div className="flex items-center gap-4">
          {/* El cierre vive en Reportes (ya tiene el preset "Hoy"); esto es
              el atajo para el ritual de cerrar la caja al bajar la persiana. */}
          <Button variant="outline" size="sm" onClick={onGoToReportes}>
            <Calculator className="size-4" /> Cierre de caja
          </Button>
          <div className="text-right">
            <p className="text-xs text-muted-ink">{totals.count} venta{totals.count === 1 ? "" : "s"}</p>
            <Money cents={totals.totalCents} size="lg" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loading && sales.length === 0 ? (
          <ListRowSkeleton />
        ) : sales.length === 0 ? (
          <EmptyState icon={Receipt} title="Todavía no hay ventas hoy" description="Las ventas que registrés van a aparecer acá." />
        ) : (
          <>
            {sales.map((sale) => (
              <ListRow key={sale.id} interactive onClick={() => setDetailId(sale.id)}>
                <ListRowMain>
                  <ListRowTitle>{formatTime(sale.createdAt)}</ListRowTitle>
                  {sale.voidedAt
                    ? <ListRowDetail>Anulada{sale.voidReason ? ` · ${sale.voidReason}` : ""}</ListRowDetail>
                    : sale.cashierId && <ListRowDetail>{cashierNames.get(sale.cashierId) ?? ""}</ListRowDetail>}
                </ListRowMain>
                {sale.customerId && <Badge tone="warn">Fiado</Badge>}
                {sale.voidedAt && <Badge tone="danger">Anulada</Badge>}
                <Money cents={sale.totalCents} className={sale.voidedAt ? "text-muted-ink line-through" : ""} />
              </ListRow>
            ))}
            <Pagination
              page={page} hasMore={hasMore} onPrev={prevPage} onNext={nextPage}
              total={total} pageSize={PAGE_SIZE} onGoToPage={goToPage}
            />
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
