/**
 * Diálogo de cobro. El monto registrado en sale_payments es SIEMPRE el
 * total: lo "recibido" en efectivo solo sirve para calcular el vuelto en
 * pantalla (registerSale rechaza pagos que no igualen el total).
 */
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { changeDue, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod, type TicketLine } from "../../domain/ticket";
import { parseARSToCents } from "../../domain/money";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Money } from "../../ui/money";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../../ui/shadcn/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../ui/shadcn/select";

export function CobrarDialog({
  open,
  onOpenChange,
  lines,
  totalCents,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: TicketLine[];
  totalCents: number;
  onConfirmed: () => void;
}) {
  const { repos } = useApp();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [recibidoInput, setRecibidoInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const recibidoCents = method === "cash" ? parseARSToCents(recibidoInput) : totalCents;
  const vuelto = recibidoCents !== null ? changeDue(totalCents, recibidoCents) : null;
  const canConfirm = method !== "cash" || vuelto !== null;

  function reset() {
    setMethod("cash");
    setRecibidoInput("");
  }

  async function confirmar() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      await repos.sales.registerSale({
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        payments: [{ method, amountCents: totalCents }],
      });
      toast.success("Venta registrada");
      reset();
      onConfirmed();
    } catch (cause) {
      toast.error("No se pudo registrar la venta", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === "Enter" && canConfirm) {
            e.preventDefault();
            void confirmar();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Cobrar</DialogTitle>
          <DialogDescription>{lines.length} producto{lines.length === 1 ? "" : "s"} en el ticket</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
          <span className="text-sm text-muted-ink">Total</span>
          <Money cents={totalCents} size="lg" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-ink">Medio de pago</label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {method === "cash" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Recibido</label>
              <Input
                size="lg"
                inputMode="decimal"
                autoFocus
                placeholder="$ 0"
                value={recibidoInput}
                onChange={(e) => setRecibidoInput(e.target.value)}
              />
              {recibidoInput.trim() !== "" && (
                <p className="mt-1.5 text-sm">
                  {vuelto !== null ? (
                    <>Vuelto: <Money cents={vuelto} size="sm" className="font-semibold text-ok" /></>
                  ) : (
                    <span className="text-danger">No alcanza para cubrir el total</span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <Button
          variant="accent"
          size="xl"
          className="w-full"
          disabled={!canConfirm || submitting}
          onClick={() => void confirmar()}
        >
          Confirmar cobro
        </Button>
      </DialogContent>
    </Dialog>
  );
}
