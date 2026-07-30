/**
 * La cuenta corriente de un cliente: saldo, historial de movimientos y las
 * dos acciones que la mueven (cobrar y ajustar).
 *
 * El historial se lee como un cuaderno: cada línea dice qué pasó, cuándo y
 * cuánto, con el signo a la vista.
 */
import { useCallback, useEffect, useState } from "react";
import { HandCoins, Pencil, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { useCashierStore } from "../cajeros/cashier-store";
import {
  ACCOUNT_MOVEMENT_LABELS, balanceLabel, creditStatus, CREDIT_STATUS_TONE,
} from "../../domain/account";
import { formatDateTime } from "../../domain/dates";
import { parseARSToCents } from "../../domain/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../domain/ticket";
import type { AccountMovement, Customer } from "../../data/types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Money } from "../../ui/money";
import { Skeleton } from "../../ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../../ui/shadcn/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../ui/shadcn/select";

type Mode = "history" | "payment" | "adjustment";

export function CuentaDialog({
  customer,
  onOpenChange,
  onChanged,
}: {
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { repos } = useApp();
  const activeCashierId = useCashierStore((s) => s.activeId);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [mode, setMode] = useState<Mode>("history");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!customer) return;
    const [balance, movs] = await Promise.all([
      repos.customers.balanceFor(customer.id),
      repos.customers.movementsFor(customer.id, 50),
    ]);
    setBalanceCents(balance);
    setMovements(movs);
  }, [customer, repos]);

  useEffect(() => {
    if (!customer) {
      setBalanceCents(null);
      setMovements([]);
      return;
    }
    setMode("history");
    setAmount("");
    setNote("");
    void reload();
  }, [customer, reload]);

  async function registrarPago() {
    if (!customer) return;
    const cents = parseARSToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Revisá el monto del pago");
      return;
    }
    setSaving(true);
    try {
      await repos.customers.registerPayment({
        customerId: customer.id, amountCents: cents, method, cashierId: activeCashierId,
      });
      const quedaAFavor = balanceCents !== null && cents > balanceCents;
      toast.success("Pago registrado", {
        description: quedaAFavor ? "Pagó de más: le queda saldo a favor." : undefined,
      });
      setAmount("");
      setMode("history");
      await reload();
      onChanged();
    } catch (cause) {
      toast.error("No se pudo registrar el pago", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  }

  async function registrarAjuste(signo: 1 | -1) {
    if (!customer) return;
    const cents = parseARSToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Revisá el monto del ajuste");
      return;
    }
    if (note.trim() === "") {
      toast.error("Escribí el motivo del ajuste");
      return;
    }
    setSaving(true);
    try {
      await repos.customers.registerAdjustment({
        customerId: customer.id, deltaCents: signo * cents, note, cashierId: activeCashierId,
      });
      toast.success("Ajuste registrado");
      setAmount("");
      setNote("");
      setMode("history");
      await reload();
      onChanged();
    } catch (cause) {
      toast.error("No se pudo registrar el ajuste", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  }

  const status = customer && balanceCents !== null
    ? creditStatus(balanceCents, customer.creditLimitCents)
    : "none";

  return (
    <Dialog open={customer !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cuenta de {customer?.name}</DialogTitle>
        </DialogHeader>

        {/* Saldo: lo primero que se mira. */}
        <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
          <div>
            <p className="text-xs text-muted-ink">
              {balanceCents !== null ? balanceLabel(balanceCents) : "Saldo"}
            </p>
            {customer?.creditLimitCents != null && (
              <p className="text-xs text-muted-ink">
                Límite <Money cents={customer.creditLimitCents} size="sm" />
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status !== "none" && status !== "ok" && (
              <Badge tone={CREDIT_STATUS_TONE[status]}>
                {status === "over" ? "Se pasó del límite" : "Cerca del límite"}
              </Badge>
            )}
            {balanceCents === null
              ? <Skeleton className="h-7 w-24" />
              : <Money cents={Math.abs(balanceCents)} size="lg" />}
          </div>
        </div>

        {mode === "history" && (
          <>
            <div className="flex gap-2">
              <Button
                variant="accent"
                className="flex-1"
                disabled={balanceCents === null}
                onClick={() => {
                  // "Saldar todo" precargado: es lo que pasa el 90% de las veces.
                  setAmount(balanceCents && balanceCents > 0 ? String(Math.round(balanceCents / 100)) : "");
                  setMode("payment");
                }}
              >
                <HandCoins className="size-4" /> Registrar pago
              </Button>
              <Button variant="outline" onClick={() => setMode("adjustment")}>
                <SlidersHorizontal className="size-4" /> Ajuste
              </Button>
            </div>

            <div className="max-h-72 overflow-auto">
              {movements.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-ink">
                  Sin movimientos: este cliente todavía no compró fiado.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {movements.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {ACCOUNT_MOVEMENT_LABELS[m.type]}
                          {m.method ? ` · ${PAYMENT_METHOD_LABELS[m.method]}` : ""}
                        </p>
                        <p className="truncate text-xs text-muted-ink">
                          {formatDateTime(m.createdAt)}{m.note ? ` · ${m.note}` : ""}
                        </p>
                      </div>
                      {/* Deber suma (danger), pagar resta (ok). */}
                      <span className={`tnum shrink-0 font-semibold ${m.deltaCents > 0 ? "text-danger" : "text-ok"}`}>
                        {m.deltaCents > 0 ? "+" : "−"}
                        <Money cents={Math.abs(m.deltaCents)} size="sm" className="font-semibold" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {mode === "payment" && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Cuánto paga</label>
              <Input
                autoFocus
                size="lg"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$ 0"
                onKeyDown={(e) => { if (e.key === "Enter") void registrarPago(); }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Con qué paga</label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("history")}>Cancelar</Button>
              <Button variant="accent" disabled={saving} onClick={() => void registrarPago()}>
                Registrar pago
              </Button>
            </div>
          </div>
        )}

        {mode === "adjustment" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-ink">
              Para corregir un error de carga o perdonar parte de la deuda. Queda anotado en el
              historial con el motivo.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Monto</label>
              <Input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$ 0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Motivo</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: le perdono el resto"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode("history")}>Cancelar</Button>
              <Button variant="outline" disabled={saving} onClick={() => void registrarAjuste(-1)}>
                <Pencil className="size-4" /> Bajarle la deuda
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => void registrarAjuste(1)}>
                Subirle la deuda
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
