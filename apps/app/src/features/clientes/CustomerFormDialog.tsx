/**
 * Alta y edición de clientes. Espeja ProductFormDialog: el diálogo se monta
 * siempre y se rellena al abrir.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { formatARSWhole, parseARSToCents } from "../../domain/money";
import type { Customer } from "../../data/types";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "../../ui/shadcn/dialog";

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = alta. */
  customer: Customer | null;
  onSaved: () => void;
}) {
  const { repos } = useApp();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setNotes(customer?.notes ?? "");
    setLimit(
      customer?.creditLimitCents != null
        ? formatARSWhole(customer.creditLimitCents).replace(/[^\d,.-]/g, "")
        : "",
    );
  }, [open, customer]);

  async function handleSubmit() {
    if (name.trim() === "") {
      toast.error("El cliente necesita un nombre");
      return;
    }
    const trimmedLimit = limit.trim();
    const creditLimitCents = trimmedLimit === "" ? null : parseARSToCents(trimmedLimit);
    if (trimmedLimit !== "" && creditLimitCents === null) {
      toast.error("Revisá el límite de fiado");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() === "" ? null : phone.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
        creditLimitCents,
      };
      if (customer) await repos.customers.update(customer.id, payload);
      else await repos.customers.create(payload);
      toast.success(customer ? "Cliente actualizado" : "Cliente creado");
      onSaved();
    } catch (cause) {
      toast.error("No se pudo guardar", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-ink">Nombre</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Vecino del 3º B"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Teléfono</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Límite de fiado</label>
              <Input
                inputMode="decimal"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="Sin límite"
              />
            </div>
          </div>
          <p className="text-xs text-muted-ink">
            El límite es solo un aviso: si se pasa, kiOS te lo muestra pero igual podés fiarle.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-ink">Notas</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
            {customer ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
