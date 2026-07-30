/**
 * Detalle de una venta + anulación. Compartido entre "Hoy" y "Reportes"
 * (misma vista de un hecho inmutable, sea cual sea el rango que la trajo).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { META_KEYS } from "../../data/bootstrap";
import { printTicket } from "../impresion/print-store";
import { confirm } from "../../ui/confirm-dialog";
import { formatDateTime } from "../../domain/dates";
import { PAYMENT_METHOD_LABELS } from "../../domain/ticket";
import { formatARS } from "../../domain/money";
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
  const [businessName, setBusinessName] = useState("");
  /** Saldo ACTUAL de la cuenta (no el del momento de la venta): al reimprimir
   *  lo útil es cuánto debe hoy. */
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    if (!saleId) {
      setDetail(null);
      return;
    }
    void repos.sales.getWithItems(saleId).then(setDetail);
  }, [saleId, repos]);

  useEffect(() => {
    void repos.meta.get(META_KEYS.businessName).then((v) => setBusinessName(v ?? ""));
  }, [repos]);

  useEffect(() => {
    if (!detail?.customerId) {
      setBalanceCents(null);
      return;
    }
    void repos.customers.balanceFor(detail.customerId).then(setBalanceCents);
  }, [detail, repos]);

  const fiadoCents = detail?.payments
    .filter((p) => p.method === "credit")
    .reduce((sum, p) => sum + p.amountCents, 0) ?? 0;

  async function anular() {
    if (!detail) return;
    // Si fue fiada, se avisa que además se descuenta de la cuenta del cliente.
    const extra = fiadoCents > 0 && detail.customerName
      ? ` Además se le descuentan ${formatARS(fiadoCents)} de la cuenta de ${detail.customerName}.`
      : "";
    const ok = await confirm({
      title: "¿Anular esta venta?",
      description: `El stock vendido vuelve a sumarse.${extra}`,
      confirmLabel: "Anular venta",
      danger: true,
    });
    if (!ok) return;
    await repos.sales.voidSale(detail.id);
    toast.success("Venta anulada");
    onOpenChange(false);
    onVoided();
  }

  function imprimir() {
    if (!detail) return;
    printTicket(
      detail,
      businessName,
      fiadoCents > 0 && detail.customerName && balanceCents !== null
        ? { customerName: detail.customerName, balanceCents }
        : undefined,
    );
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
              <div className="flex flex-wrap gap-1.5">
                {detail.payments.map((p, i) => (
                  <Badge key={i} tone={p.method === "credit" ? "warn" : "neutral"}>
                    {PAYMENT_METHOD_LABELS[p.method]}
                  </Badge>
                ))}
                {detail.voidedAt && <Badge tone="danger">Anulada</Badge>}
              </div>
              <Money cents={detail.totalCents} size="lg" />
            </div>

            {(detail.cashierName || detail.customerName) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-ink">
                {detail.cashierName && <span>Cajero: <span className="text-ink">{detail.cashierName}</span></span>}
                {detail.customerName && <span>Cliente: <span className="text-ink">{detail.customerName}</span></span>}
              </div>
            )}
          </div>
        )}
        {detail && (
          <DialogFooter className="sm:justify-between">
            {/* Se puede reimprimir siempre: el ticket de una venta anulada
                sale marcado "ANULADA", que es justamente el comprobante útil. */}
            <Button variant="outline" onClick={imprimir}>
              <Printer className="size-4" /> Imprimir ticket
            </Button>
            {!detail.voidedAt && (
              <Button variant="danger" onClick={() => void anular()}>Anular venta</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
