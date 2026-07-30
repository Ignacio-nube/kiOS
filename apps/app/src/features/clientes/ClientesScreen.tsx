/**
 * Clientes y quién debe. La pregunta que más se hace el kiosquero acá es
 * "¿cuánto me deben?", así que eso va arriba de todo y hay un filtro para
 * ver solo a los deudores.
 *
 * Los saldos se traen SOLO de la página visible (balancesFor), igual que el
 * stock en la pantalla de Stock.
 */
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { usePaginatedList } from "../../lib/use-paginated-list";
import { balanceLabel, creditStatus, CREDIT_STATUS_TONE } from "../../domain/account";
import { confirm } from "../../ui/confirm-dialog";
import type { Customer } from "../../data/types";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardBody } from "../../ui/card";
import { Input } from "../../ui/input";
import { Money } from "../../ui/money";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import { Skeleton, ListRowSkeleton } from "../../ui/skeleton";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { CustomerFormDialog } from "./CustomerFormDialog";
import { CuentaDialog } from "./CuentaDialog";

const PAGE_SIZE = 20;

export function ClientesScreen() {
  const { repos } = useApp();
  const [filter, setFilter] = useState("");
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [balances, setBalances] = useState<Map<string, number>>(new Map());
  const [debt, setDebt] = useState<{ debtors: number; totalCents: number } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [cuenta, setCuenta] = useState<Customer | null>(null);

  const fetchPage = useCallback(
    (limit: number, offset: number) => {
      if (onlyDebtors) return repos.customers.listDebtors(limit, offset);
      const term = filter.trim();
      return term === ""
        ? repos.customers.list(limit, offset)
        : repos.customers.search(term, limit, offset);
    },
    [repos, filter, onlyDebtors],
  );
  // El contador tiene que seguir el mismo camino que `fetchPage`: con el
  // toggle activo se cuentan deudores, no clientes.
  const countAll = useCallback(
    () => (onlyDebtors ? repos.customers.countDebtors() : repos.customers.count(filter)),
    [repos, filter, onlyDebtors],
  );
  const { items: customers, page, hasMore, loading, total, reload, nextPage, prevPage, resetPage, goToPage } =
    usePaginatedList(fetchPage, PAGE_SIZE, countAll);

  const refreshDebt = useCallback(() => {
    void repos.customers.totalDebt().then(setDebt);
  }, [repos]);

  useEffect(refreshDebt, [refreshDebt]);

  // Saldos solo de la página visible.
  useEffect(() => {
    if (customers.length === 0) {
      setBalances(new Map());
      return;
    }
    let cancelled = false;
    void repos.customers.balancesFor(customers.map((c) => c.id)).then((rows) => {
      if (!cancelled) setBalances(new Map(rows.map((b) => [b.customerId, b.balanceCents])));
    });
    return () => {
      cancelled = true;
    };
  }, [customers, repos]);

  function handleFilterChange(value: string) {
    setFilter(value);
    resetPage();
  }

  function toggleDebtors(next: boolean) {
    setOnlyDebtors(next);
    resetPage();
  }

  function afterChange() {
    void reload();
    refreshDebt();
  }

  async function handleDelete(customer: Customer) {
    const saldo = balances.get(customer.id) ?? 0;
    const aviso = saldo > 0
      ? "OJO: tiene deuda; el saldo se conserva por si vuelve."
      : undefined;
    const ok = await confirm({
      title: `¿Dar de baja a "${customer.name}"?`,
      description: aviso,
      confirmLabel: "Dar de baja",
      danger: true,
    });
    if (!ok) return;
    await repos.customers.softDelete(customer.id);
    toast.success("Cliente dado de baja");
    afterChange();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
        <Button
          variant="primary"
          onClick={() => { setEditing(null); setFormOpen(true); }}
        >
          <Plus className="size-4" /> Nuevo cliente
        </Button>
      </div>

      <Card className="mb-4">
        <CardBody className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-ink">Te deben</p>
            {debt === null
              ? <Skeleton className="mt-1 h-7 w-32" />
              : <Money cents={debt.totalCents} size="lg" />}
          </div>
          <p className="text-sm text-muted-ink">
            {debt === null ? "" : `${debt.debtors} cliente${debt.debtors === 1 ? "" : "s"}`}
          </p>
        </CardBody>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={filter}
          onChange={(e) => handleFilterChange(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          className="max-w-sm"
          disabled={onlyDebtors}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
          <input
            type="checkbox"
            checked={onlyDebtors}
            onChange={(e) => toggleDebtors(e.target.checked)}
            className="size-4 accent-brand"
          />
          Solo los que deben
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loading && customers.length === 0 ? (
          <ListRowSkeleton />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={onlyDebtors ? Wallet : Users}
            title={onlyDebtors ? "Nadie te debe nada" : filter.trim() !== "" ? "Sin resultados" : "Todavía no cargaste clientes"}
            description={
              onlyDebtors
                ? "Todas las cuentas están al día."
                : filter.trim() !== ""
                  ? undefined
                  : "Cargá un cliente para poder fiarle desde la pantalla de venta."
            }
            action={!onlyDebtors && filter.trim() === "" && (
              <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="size-4" /> Cargar el primero
              </Button>
            )}
          />
        ) : (
          <>
            {customers.map((customer) => {
              const saldo = balances.get(customer.id) ?? 0;
              const status = creditStatus(saldo, customer.creditLimitCents);
              return (
                <ListRow key={customer.id}>
                  <ListRowMain>
                    <ListRowTitle>{customer.name}</ListRowTitle>
                    <ListRowDetail>
                      {customer.phone ?? (saldo === 0 ? "Al día" : balanceLabel(saldo))}
                    </ListRowDetail>
                  </ListRowMain>
                  {status !== "none" && status !== "ok" && (
                    <Badge tone={CREDIT_STATUS_TONE[status]}>
                      {status === "over" ? "Se pasó" : "Cerca del límite"}
                    </Badge>
                  )}
                  <Money
                    cents={Math.abs(saldo)}
                    className={saldo > 0 ? "w-24 text-right text-danger" : saldo < 0 ? "w-24 text-right text-ok" : "w-24 text-right text-muted-ink"}
                  />
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCuenta(customer)}>
                      Cuenta
                    </Button>
                    <button
                      className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-muted hover:text-ink"
                      onClick={() => { setEditing(customer); setFormOpen(true); }}
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-danger/10 hover:text-danger"
                      onClick={() => void handleDelete(customer)}
                      aria-label="Dar de baja"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </ListRow>
              );
            })}
            <Pagination
              page={page} hasMore={hasMore} onPrev={prevPage} onNext={nextPage}
              total={total} pageSize={PAGE_SIZE} onGoToPage={goToPage}
            />
          </>
        )}
      </div>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSaved={() => {
          setFormOpen(false);
          afterChange();
        }}
      />

      <CuentaDialog
        customer={cuenta}
        onOpenChange={(open) => !open && setCuenta(null)}
        onChanged={afterChange}
      />
    </div>
  );
}
