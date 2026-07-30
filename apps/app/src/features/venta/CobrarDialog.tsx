/**
 * Diálogo de cobro. El monto registrado en sale_payments es SIEMPRE el
 * total: lo "recibido" en efectivo solo sirve para calcular el vuelto en
 * pantalla (registerSale rechaza pagos que no igualen el total).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { META_KEYS } from "../../data/bootstrap";
import { printTicket } from "../impresion/print-store";
import { changeDue, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod, type TicketLine } from "../../domain/ticket";
import { parseARSToCents } from "../../domain/money";
import { useCashierStore } from "../cajeros/cashier-store";
import { FiadoPicker, type FiadoSelection } from "./FiadoPicker";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Money } from "../../ui/money";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../../ui/shadcn/dialog";
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
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
  // Preferencia de impresión + nombre del kiosco: se leen una vez y quedan
  // en memoria (la venta no puede pagar una consulta extra por cobro).
  const [printOnSale, setPrintOnSale] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [fiado, setFiado] = useState<FiadoSelection | null>(null);
  const activeCashierId = useCashierStore((s) => s.activeId);

  useEffect(() => {
    void repos.meta.get(META_KEYS.printOnSale).then((v) => setPrintOnSale(v === "1"));
    void repos.meta.get(META_KEYS.businessName).then((v) => setBusinessName(v ?? ""));
  }, [repos]);

  function togglePrint(next: boolean) {
    setPrintOnSale(next);
    void repos.meta.set(META_KEYS.printOnSale, next ? "1" : "0");
  }

  const isFiado = method === "credit";
  const recibidoCents = method === "cash" ? parseARSToCents(recibidoInput) : totalCents;
  const vuelto = recibidoCents !== null ? changeDue(totalCents, recibidoCents) : null;
  // El límite de crédito NO entra acá a propósito: se avisa, no se bloquea.
  const canConfirm = isFiado ? fiado !== null : method !== "cash" || vuelto !== null;

  function reset() {
    setMethod("cash");
    setRecibidoInput("");
    setFiado(null);
  }

  async function confirmar() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      const sale = await repos.sales.registerSale({
        lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
        payments: [{ method, amountCents: totalCents }],
        cashierId: activeCashierId,
        customerId: isFiado ? fiado!.customer.id : null,
      });
      // El saldo se calcula acá (ya lo tenemos) para no consultar la base
      // desde el área de impresión.
      const creditInfo = isFiado
        ? { customerName: fiado!.customer.name, balanceCents: fiado!.balanceCents + totalCents }
        : undefined;
      if (printOnSale) {
        printTicket(sale, businessName, creditInfo);
        toast.success(isFiado ? "Fiado registrado — imprimiendo ticket" : "Venta registrada — imprimiendo ticket");
      } else {
        // Con la opción apagada el ticket queda a un clic, sin frenar la caja.
        toast.success(isFiado ? `Fiado a ${fiado!.customer.name}` : "Venta registrada", {
          action: { label: "Imprimir", onClick: () => printTicket(sale, businessName, creditInfo) },
        });
      }
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
                {/* Fiar no es cobrar: va separado para que no se elija por
                    error al bajar la lista de medios. */}
                <SelectSeparator />
                <SelectItem value="credit">{PAYMENT_METHOD_LABELS.credit} — paga después</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFiado && (
            <FiadoPicker totalCents={totalCents} selection={fiado} onSelect={setFiado} />
          )}

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

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1.5 select-none">
          <input
            type="checkbox"
            checked={printOnSale}
            onChange={(e) => togglePrint(e.target.checked)}
            className="size-4 accent-brand"
          />
          <Printer className="size-4 text-muted-ink" />
          <span className="text-sm">Imprimir ticket al cobrar</span>
        </label>

        <Button
          variant="accent"
          size="xl"
          className="w-full"
          disabled={!canConfirm || submitting}
          onClick={() => void confirmar()}
        >
          {isFiado ? "Confirmar fiado" : "Confirmar cobro"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
