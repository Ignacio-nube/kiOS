import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { usePaginatedList } from "../../lib/use-paginated-list";
import { todayRange, formatTime } from "../../domain/dates";
import { PAYMENT_METHOD_LABELS } from "../../domain/ticket";
import type { SaleWithItems } from "../../data/types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Money } from "../../ui/money";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/shadcn/dialog";

const PAGE_SIZE = 20;

export function VentasDiaScreen() {
  const { repos } = useApp();
  const [range] = useState(() => todayRange());
  const [totals, setTotals] = useState({ count: 0, totalCents: 0 });
  const [detail, setDetail] = useState<SaleWithItems | null>(null);

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

  async function openDetail(saleId: string) {
    setDetail(await repos.sales.getWithItems(saleId));
  }

  async function anular() {
    if (!detail) return;
    if (!window.confirm("¿Anular esta venta? El stock vendido vuelve a sumarse.")) return;
    await repos.sales.voidSale(detail.id);
    toast.success("Venta anulada");
    setDetail(null);
    void reload();
    reloadTotals();
  }

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
              <ListRow key={sale.id} interactive onClick={() => void openDetail(sale.id)}>
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

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Venta {detail && formatTime(detail.createdAt)}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <ul className="divide-y divide-line text-sm">
                {detail.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <span>{item.qty} × {item.productName}</span>
                    <Money cents={item.unitPriceCents * item.qty} />
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-line pt-3">
                <div className="flex gap-1.5">
                  {detail.payments.map((p, i) => (
                    <Badge key={i} tone="neutral">{PAYMENT_METHOD_LABELS[p.method]}</Badge>
                  ))}
                  {detail.voidedAt && <Badge tone="danger">Anulada</Badge>}
                </div>
                <Money cents={detail.totalCents} size="lg" />
              </div>
            </div>
          )}
          {!detail?.voidedAt && (
            <DialogFooter>
              <Button variant="danger" onClick={() => void anular()}>Anular venta</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
