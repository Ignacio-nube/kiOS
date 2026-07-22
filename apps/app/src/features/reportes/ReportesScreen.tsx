/**
 * Reportes: todos los datos de ventas con filtros personalizables
 * (rango de fechas, medio de pago, categoría). Reusa el mismo repositorio
 * y el mismo diálogo de detalle que "Hoy" — es la misma vista de los
 * hechos inmutables, para cualquier rango.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { usePaginatedList } from "../../lib/use-paginated-list";
import { cn } from "../../lib/utils";
import {
  dateInputsToRange, formatDateTime, lastNDaysRange, thisMonthRange, todayRange,
  toDateInputValue, yesterdayRange, type DateRange,
} from "../../domain/dates";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../domain/ticket";
import type { Category, PaymentBreakdownEntry, TopProduct } from "../../data/types";
import { Card, CardBody, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Money } from "../../ui/money";
import { Input } from "../../ui/input";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/shadcn/select";
import { SaleDetailDialog } from "../ventas-dia/SaleDetailDialog";

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
  const [preset, setPreset] = useState<Preset>("hoy");
  const [customFrom, setCustomFrom] = useState(() => toDateInputValue());
  const [customTo, setCustomTo] = useState(() => toDateInputValue());
  const [paymentFilter, setPaymentFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState({ count: 0, totalCents: 0 });
  const [breakdown, setBreakdown] = useState<PaymentBreakdownEntry[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
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

  const fetchPage = useCallback(
    (limit: number, offset: number) => repos.sales.listByRange(range, limit, offset, method),
    [repos, range, method],
  );
  const { items: sales, page, hasMore, reload, nextPage, prevPage, resetPage } = usePaginatedList(fetchPage, PAGE_SIZE);

  useEffect(() => {
    void repos.products.listCategories().then(setCategories);
  }, [repos]);

  const reloadAggregates = useCallback(() => {
    void repos.sales.totalsByRange(range, method).then(setSummary);
    void repos.sales.paymentBreakdown(range).then(setBreakdown);
    void repos.sales.topProducts(range, { categoryId, limit: 10 }).then(setTopProducts);
  }, [repos, range, method, categoryId]);

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

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight">Reportes</h1>

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
              {PAYMENT_METHODS.map((m) => (
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
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs text-muted-ink">Ventas</p>
            <p className="tnum text-2xl font-bold">{summary.count}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted-ink">Facturado</p>
            <Money cents={summary.totalCents} size="lg" />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-muted-ink">Ticket promedio</p>
            <Money cents={avgTicketCents} size="lg" />
          </CardBody>
        </Card>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Medios de pago</CardTitle>
          </CardHeader>
          <CardBody>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-ink">Sin ventas en el período.</p>
            ) : (
              <ul className="space-y-2">
                {breakdown.map((b) => (
                  <li key={b.method} className="flex items-center justify-between">
                    <Badge tone="neutral">{PAYMENT_METHOD_LABELS[b.method]}</Badge>
                    <Money cents={b.totalCents} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Más vendidos</CardTitle>
          </CardHeader>
          <CardBody>
            {topProducts.length === 0 ? (
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

      <h2 className="mb-2 text-sm font-semibold text-muted-ink">Ventas del período</h2>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {sales.length === 0 ? (
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
            <Pagination page={page} hasMore={hasMore} onPrev={prevPage} onNext={nextPage} />
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
