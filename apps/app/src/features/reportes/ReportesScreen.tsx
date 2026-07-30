/**
 * Reportes: todos los datos de ventas con filtros personalizables
 * (rango de fechas, medio de pago, categoría). Reusa el mismo repositorio
 * y el mismo diálogo de detalle que "Hoy" — es la misma vista de los
 * hechos inmutables, para cualquier rango.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { usePaginatedList } from "../../lib/use-paginated-list";
import { cn } from "../../lib/utils";
import {
  dateInputsToRange, formatDateTime, lastNDaysRange, thisMonthRange, todayRange,
  toDateInputValue, yesterdayRange, type DateRange,
} from "../../domain/dates";
import { ALL_PAYMENT_METHODS, isCashInMethod, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../domain/ticket";
import { useCashierStore } from "../cajeros/cashier-store";
import { CierreCajaCard } from "./CierreCajaCard";
import type {
  CashierClosingEntry, Category, PaymentBreakdownEntry, SalesFilter, TopProduct,
} from "../../data/types";
import { Card, CardBody, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Money } from "../../ui/money";
import { Input } from "../../ui/input";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import { Skeleton, ListRowSkeleton } from "../../ui/skeleton";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/shadcn/select";
import { SaleDetailDialog } from "../ventas-dia/SaleDetailDialog";
import { exportReportToExcel } from "./export-excel";

const PAGE_SIZE = 20;
const ALL = "__all__";

type Preset = "hoy" | "ayer" | "7d" | "mes" | "personalizado";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "ayer", label: "Ayer" },
  { id: "7d", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
  { id: "personalizado", label: "Personalizado" },
];

export function ReportesScreen() {
  const { repos } = useApp();
  const cashiers = useCashierStore((s) => s.cashiers);
  const [preset, setPreset] = useState<Preset>("hoy");
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue());
  const [customTo, setCustomTo] = useState(() => toDateInputValue());
  const [paymentFilter, setPaymentFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState({ count: 0, totalCents: 0 });
  const [breakdown, setBreakdown] = useState<PaymentBreakdownEntry[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [closing, setClosing] = useState<CashierClosingEntry[]>([]);
  const [cashierFilter, setCashierFilter] = useState<string>(ALL);
  const [aggLoading, setAggLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const range = useMemo<DateRange>(() => {
    switch (preset) {
      case "hoy": return todayRange();
      case "ayer": return yesterdayRange();
      case "7d": return lastNDaysRange(7);
      case "mes": return thisMonthRange();
      case "personalizado": return dateInputsToRange(customFrom, customTo);
    }
  }, [preset, customFrom, customTo]);

  const method = paymentFilter === ALL ? undefined : (paymentFilter as PaymentMethod);
  const categoryId = categoryFilter === ALL ? undefined : categoryFilter;
  const cashierId = cashierFilter === ALL ? undefined : cashierFilter;
  const salesFilter = useMemo<SalesFilter>(
    () => ({ paymentMethod: method, cashierId }),
    [method, cashierId],
  );

  const fetchPage = useCallback(
    (limit: number, offset: number) => repos.sales.listByRange(range, limit, offset, salesFilter),
    [repos, range, salesFilter],
  );
  // `summary.count` NO sirve acá: es facturación y excluye las anuladas, que
  // el listado sí muestra. Ver `countByRange`.
  const countAll = useCallback(
    () => repos.sales.countByRange(range, salesFilter),
    [repos, range, salesFilter],
  );
  const { items: sales, page, hasMore, loading, total, reload, nextPage, prevPage, resetPage, goToPage } =
    usePaginatedList(fetchPage, PAGE_SIZE, countAll);

  useEffect(() => {
    void repos.products.listCategories().then(setCategories);
  }, [repos]);

  const reloadAggregates = useCallback(() => {
    setAggLoading(true);
    void Promise.all([
      repos.sales.totalsByRange(range, salesFilter).then(setSummary),
      repos.sales.paymentBreakdown(range, salesFilter).then(setBreakdown),
      repos.sales.topProducts(range, { categoryId, limit: 10 }).then(setTopProducts),
      // El cierre NO se filtra por cajero: mostrar todos permite comparar
      // turnos, que es justamente para lo que sirve.
      repos.sales.closingByCashier(range).then(setClosing),
    ]).finally(() => setAggLoading(false));
  }, [repos, range, salesFilter, categoryId]);

  useEffect(() => {
    reloadAggregates();
  }, [reloadAggregates]);

  function handlePreset(p: Preset) {
    setPreset(p);
    resetPage();
  }
  function handleCustomFrom(v: string) {
    setCustomFrom(v);
    resetPage();
  }
  function handleCustomTo(v: string) {
    setCustomTo(v);
    resetPage();
  }
  function handlePaymentFilter(v: string) {
    setPaymentFilter(v);
    resetPage();
  }

  const avgTicketCents = summary.count > 0 ? Math.round(summary.totalCents / summary.count) : 0;
  // `paymentBreakdown` incluye el fiado, que NO es plata cobrada.
  const fiadoCents = breakdown
    .filter((b) => !isCashInMethod(b.method))
    .reduce((sum, b) => sum + b.totalCents, 0);
  const cobradoCents = breakdown
    .filter((b) => isCashInMethod(b.method))
    .reduce((sum, b) => sum + b.totalCents, 0);

  const rangeLabel = useMemo(() => {
    if (preset === "personalizado") return `${customFrom} a ${customTo}`;
    return PRESETS.find((p) => p.id === preset)?.label ?? preset;
  }, [preset, customFrom, customTo]);

  async function handleExport() {
    setExporting(true);
    try {
      // Para el Excel traemos un ranking más largo que el que se ve en pantalla.
      const [data, topForExport] = await Promise.all([
        repos.sales.listForExport(range, salesFilter),
        repos.sales.topProducts(range, { categoryId, limit: 100 }),
      ]);
      if (data.sales.length === 0) {
        toast.warning("No hay ventas en el período para exportar.");
        return;
      }
      await exportReportToExcel({
        rangeLabel,
        paymentLabel: method ? PAYMENT_METHOD_LABELS[method] : "Todos los medios",
        categoryLabel:
          categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? "—") : "Todas las categorías",
        cashierLabel:
          cashierId ? (cashiers.find((c) => c.id === cashierId)?.name ?? "—") : "Todos los cajeros",
        summary,
        breakdown,
        topProducts: topForExport,
        closing,
        data,
      });
      toast.success(`Excel generado — ${data.sales.length} venta${data.sales.length === 1 ? "" : "s"}.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      toast.error("No se pudo generar el Excel", { description: message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Reportes</h1>
        <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exporting ? "Generando…" : "Exportar Excel"}
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                preset === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-ink hover:text-ink",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "personalizado" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => handleCustomFrom(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-ink">a</span>
            <Input type="date" value={customTo} onChange={(e) => handleCustomTo(e.target.value)} className="w-40" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Select value={paymentFilter} onValueChange={handlePaymentFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los medios</SelectItem>
              {ALL_PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={cashierFilter}
            onValueChange={(v) => { setCashierFilter(v); resetPage(); }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los cajeros</SelectItem>
              {cashiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-muted-ink">Ventas</p>
            {aggLoading ? <Skeleton className="mt-1 h-8 w-16" /> : <p className="tnum text-2xl font-bold">{summary.count}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted-ink">Facturado</p>
            {aggLoading ? <Skeleton className="mt-1 h-7 w-28" /> : <Money cents={summary.totalCents} size="lg" />}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted-ink">Ticket promedio</p>
            {aggLoading ? <Skeleton className="mt-1 h-7 w-24" /> : <Money cents={avgTicketCents} size="lg" />}
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Medios de pago</CardTitle>
          </CardHeader>
          <CardBody>
            {aggLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : breakdown.length === 0 ? (
              <p className="text-sm text-muted-ink">Sin ventas en el período.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {breakdown.map((b) => (
                    <li key={b.method} className="flex items-center justify-between">
                      <Badge tone={isCashInMethod(b.method) ? "neutral" : "warn"}>
                        {PAYMENT_METHOD_LABELS[b.method]}
                      </Badge>
                      <Money cents={b.totalCents} />
                    </li>
                  ))}
                </ul>
                {/* Fiar no es cobrar: sin este pie, la suma de arriba se lee
                    como plata que entró y no lo es. */}
                {fiadoCents > 0 && (
                  <p className="mt-3 border-t border-line pt-2 text-xs text-muted-ink">
                    Cobrado <Money cents={cobradoCents} size="sm" className="font-semibold text-ink" />
                    {" · "}Fiado <Money cents={fiadoCents} size="sm" className="font-semibold text-warn" />
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Más vendidos</CardTitle>
          </CardHeader>
          <CardBody>
            {aggLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <p className="text-sm text-muted-ink">Sin ventas en el período.</p>
            ) : (
              <ul className="space-y-2">
                {topProducts.map((p, i) => (
                  <li key={p.productId} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="tnum text-xs text-muted-ink">{i + 1}</span>
                      <span className="truncate text-sm">{p.productName}</span>
                      <span className="tnum shrink-0 text-xs text-muted-ink">× {p.qty}</span>
                    </span>
                    <Money cents={p.revenueCents} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <CierreCajaCard closing={closing} loading={aggLoading} />

      <h2 className="mb-2 text-sm font-semibold text-muted-ink">Ventas del período</h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {loading && sales.length === 0 ? (
          <ListRowSkeleton />
        ) : sales.length === 0 ? (
          <EmptyState icon={BarChart3} title="Sin ventas en el período" description="Probá otro rango de fechas o sacá los filtros." />
        ) : (
          <>
            {sales.map((sale) => (
              <ListRow key={sale.id} interactive onClick={() => setDetailId(sale.id)}>
                <ListRowMain>
                  <ListRowTitle>{formatDateTime(sale.createdAt)}</ListRowTitle>
                  {sale.voidedAt && <ListRowDetail>Anulada{sale.voidReason ? ` · ${sale.voidReason}` : ""}</ListRowDetail>}
                </ListRowMain>
                {sale.voidedAt && <Badge tone="danger">Anulada</Badge>}
                <Money cents={sale.totalCents} className={sale.voidedAt ? "text-muted-ink line-through" : ""} />
              </ListRow>
            ))}
            <Pagination
              page={page} hasMore={hasMore} onPrev={prevPage} onNext={nextPage}
              total={total} pageSize={PAGE_SIZE} onGoToPage={goToPage}
            />
          </>
        )}
      </div>

      <SaleDetailDialog
        saleId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onVoided={() => {
          void reload();
          reloadAggregates();
        }}
      />
    </div>
  );
}
