import { useCallback, useEffect, useState } from "react";
import { Boxes, History } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { stockStatus, STOCK_MOVEMENT_LABELS } from "../../domain/stock";
import { formatDateTime } from "../../domain/dates";
import type { Product, StockMovement } from "../../data/types";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { EmptyState } from "../../ui/empty-state";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/shadcn/dialog";
import { StockMovementDialog } from "./StockMovementDialog";

const STATUS_BADGE = {
  ok: { tone: "ok", label: "Ok" },
  low: { tone: "warn", label: "Bajo" },
  out: { tone: "danger", label: "Sin stock" },
} as const;

export function StockScreen() {
  const { repos } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState("");
  const [movementTarget, setMovementTarget] = useState<Product | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Product | null>(null);
  const [history, setHistory] = useState<StockMovement[]>([]);

  const reload = useCallback(async () => {
    const [list, stockLevels] = await Promise.all([repos.products.list(), repos.stock.levels()]);
    setProducts(list);
    setLevels(new Map(stockLevels.map((l) => [l.productId, l.qty])));
  }, [repos]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!historyTarget) return;
    void repos.stock.movementsFor(historyTarget.id).then(setHistory);
  }, [historyTarget, repos]);

  const filtered = filter.trim() === ""
    ? products
    : products.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight">Stock</h1>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Buscar por nombre…"
        className="mb-4 max-w-sm"
      />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="Sin productos" description="Cargá productos desde la pantalla Productos." />
        ) : (
          filtered.map((product) => {
            const qty = levels.get(product.id) ?? 0;
            const status = STATUS_BADGE[stockStatus(qty, product.lowStockThreshold)];
            return (
              <ListRow key={product.id}>
                <ListRowMain>
                  <ListRowTitle>{product.name}</ListRowTitle>
                  {product.lowStockThreshold != null && (
                    <ListRowDetail>Aviso bajo {product.lowStockThreshold}</ListRowDetail>
                  )}
                </ListRowMain>
                <Badge tone={status.tone}>{status.label}</Badge>
                <span className="tnum w-14 text-right text-sm font-semibold">{qty}</span>
                <div className="flex items-center gap-1">
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-muted hover:text-ink"
                    onClick={() => setHistoryTarget(product)}
                    aria-label="Historial"
                  >
                    <History className="size-4" />
                  </button>
                  <Button variant="outline" size="sm" onClick={() => setMovementTarget(product)}>
                    Movimiento
                  </Button>
                </div>
              </ListRow>
            );
          })
        )}
      </div>

      <StockMovementDialog
        open={movementTarget !== null}
        onOpenChange={(open) => !open && setMovementTarget(null)}
        product={movementTarget}
        onSaved={() => {
          setMovementTarget(null);
          void reload();
        }}
      />

      <Dialog open={historyTarget !== null} onOpenChange={(open) => !open && setHistoryTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial — {historyTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-auto">
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-ink">Sin movimientos todavía.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{STOCK_MOVEMENT_LABELS[m.type]}</p>
                      <p className="text-xs text-muted-ink">{formatDateTime(m.createdAt)}{m.note ? ` · ${m.note}` : ""}</p>
                    </div>
                    <span className={`tnum font-semibold ${m.qtyDelta > 0 ? "text-ok" : "text-danger"}`}>
                      {m.qtyDelta > 0 ? "+" : ""}{m.qtyDelta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
