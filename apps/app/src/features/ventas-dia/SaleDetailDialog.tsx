/**
 * Detalle de una venta + anulación. Compartido entre "Hoy" y "Reportes"
 * (misma vista de un hecho inmutable, sea cual sea el rango que la trajo).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { formatDateTime } from "../../domain/dates";
import { PAYMENT_METHOD_LABELS } from "../../domain/ticket";
import type { SaleWithItems } from "../../data/types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Money } from "../../ui/money";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/shadcn/dialog";

export function SaleDetailDialog({
  saleId,
  onOpenChange,
  onVoided,
}: {
  saleId: string | null;
  onOpenChange: (open: boolean) => void;
  onVoided: () => void;
}) {
  const { repos } = useApp();
  const [detail, setDetail] = useState<SaleWithItems | null>(null);

  useEffect(() => {
    if (!saleId) {
      setDetail(null);
      return;
    }
    void repos.sales.getWithItems(saleId).then(setDetail);
  }, [saleId, repos]);

  async function anular() {
    if (!detail) return;
    if (!window.confirm("¿Anular esta venta? El stock vendido vuelve a sumarse.")) return;
    await repos.sales.voidSale(detail.id);
    toast.success("Venta anulada");
    onOpenChange(false);
    onVoided();
  }

  return (
    <Dialog open={saleId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Venta {detail && formatDateTime(detail.createdAt)}</DialogTitle>
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
        {detail && !detail.voidedAt && (
          <DialogFooter>
            <Button variant="danger" onClick={() => void anular()}>Anular venta</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
