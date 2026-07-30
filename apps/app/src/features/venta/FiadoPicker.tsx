/**
 * Elegir a quién se le fía, dentro del diálogo de cobro.
 *
 * "Nuevo cliente" es un SUB-PASO del mismo diálogo, no un Dialog encima de
 * otro: Radix apila overlays y el foco queda atrapado entre los dos.
 *
 * El aviso de límite es SIEMPRE blando: muestra que se pasa y deja cobrar
 * igual. Misma regla que el stock negativo — no se traba una venta con el
 * cliente enfrente.
 */
import { useState } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { useCustomerSearch } from "../clientes/use-customer-search";
import {
  balanceLabel, creditStatusAfter, CREDIT_STATUS_TONE,
} from "../../domain/account";
import type { Customer } from "../../data/types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Money } from "../../ui/money";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";

export interface FiadoSelection {
  customer: Customer;
  balanceCents: number;
}

export function FiadoPicker({
  totalCents,
  selection,
  onSelect,
}: {
  totalCents: number;
  selection: FiadoSelection | null;
  onSelect: (selection: FiadoSelection | null) => void;
}) {
  const { repos } = useApp();
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const results = useCustomerSearch(term, selection === null && mode === "pick");

  // Al elegir un cliente hay que traer su saldo para poder avisar del límite.
  async function choose(customer: Customer) {
    const balanceCents = await repos.customers.balanceFor(customer.id);
    onSelect({ customer, balanceCents });
  }

  async function crear() {
    const name = newName.trim();
    if (name === "") {
      toast.error("Escribí el nombre del cliente");
      return;
    }
    setSaving(true);
    try {
      const customer = await repos.customers.create({ name });
      onSelect({ customer, balanceCents: 0 });
      setNewName("");
      setMode("pick");
    } catch (cause) {
      toast.error("No se pudo crear el cliente", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  }

  // Cliente ya elegido: mostramos su cuenta y cómo queda tras esta venta.
  if (selection) {
    const { customer, balanceCents } = selection;
    const after = balanceCents + totalCents;
    const status = creditStatusAfter(balanceCents, customer.creditLimitCents, totalCents);

    return (
      <div className="space-y-2 rounded-lg border border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="size-4 shrink-0 text-muted-ink" />
            <span className="truncate text-sm font-medium">{customer.name}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>Cambiar</Button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-ink">{balanceLabel(balanceCents)} ahora</span>
          <Money cents={Math.abs(balanceCents)} size="sm" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-ink">Después de esta venta</span>
          <span className="flex items-center gap-2">
            {customer.creditLimitCents !== null && (
              <Badge tone={CREDIT_STATUS_TONE[status]}>
                {status === "over" ? "Se pasa" : status === "near" ? "Cerca del límite" : "Ok"}
              </Badge>
            )}
            <Money cents={after} className="font-semibold" />
          </span>
        </div>

        {status === "over" && (
          <p className="rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger">
            Queda debiendo <Money cents={after} size="sm" className="font-semibold" /> y su límite
            es <Money cents={customer.creditLimitCents!} size="sm" className="font-semibold" />.{" "}
            <span className="font-semibold">Podés fiarle igual.</span>
          </p>
        )}
      </div>
    );
  }

  // Sub-paso: alta rápida sin salir del cobro.
  if (mode === "new") {
    return (
      <div className="space-y-2 rounded-lg border border-line p-3">
        <label className="block text-xs font-medium text-muted-ink">Nombre del cliente</label>
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ej: Vecino del 3º B"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void crear();
            }
            if (e.key === "Escape") setMode("pick");
          }}
        />
        <p className="text-xs text-muted-ink">
          El límite de fiado se configura después, en Clientes.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("pick")}>Cancelar</Button>
          <Button variant="primary" size="sm" disabled={saving} onClick={() => void crear()}>
            Crear y fiarle
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-ink" aria-hidden />
        <Input
          autoFocus
          className="pl-9"
          placeholder="Buscar cliente por nombre o teléfono…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <div className="max-h-48 overflow-auto rounded-lg border border-line">
        {results.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-ink">
            {term.trim() === "" ? "Todavía no cargaste clientes." : "Ningún cliente coincide."}
          </p>
        ) : (
          results.map((c) => (
            <ListRow key={c.id} interactive onClick={() => void choose(c)}>
              <ListRowMain>
                <ListRowTitle>{c.name}</ListRowTitle>
                {c.phone && <ListRowDetail>{c.phone}</ListRowDetail>}
              </ListRowMain>
            </ListRow>
          ))
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          setNewName(term.trim());
          setMode("new");
        }}
      >
        <Plus className="size-4" /> Cliente nuevo
      </Button>
    </div>
  );
}
