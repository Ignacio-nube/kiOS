/**
 * Cierre de caja por cajero: la plata que TIENE que estar en el cajón.
 *
 * La distinción que hace útil a esta card: facturar y cobrar no son lo
 * mismo. Una venta fiada factura pero no entra plata; un cobro de deuda
 * entra plata sin facturar nada nuevo. Por eso el número grande es lo
 * COBRADO, y lo facturado va abajo como contexto.
 *
 * Vive en Reportes (y no en una pantalla propia) porque ya tiene los presets
 * de rango: "Hoy" es exactamente el cierre del turno.
 */
import { isCashInMethod, PAYMENT_METHOD_LABELS } from "../../domain/ticket";
import type { CashierClosingEntry } from "../../data/types";
import { Card, CardBody, CardHeader, CardTitle } from "../../ui/card";
import { Money } from "../../ui/money";
import { Skeleton } from "../../ui/skeleton";

export function CierreCajaCard({
  closing,
  loading,
}: {
  closing: CashierClosingEntry[];
  loading: boolean;
}) {
  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle>Cierre de caja</CardTitle>
        <span className="text-xs text-muted-ink">Lo que tiene que haber en el cajón</span>
      </CardHeader>
      <CardBody>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
        ) : closing.length === 0 ? (
          <p className="text-sm text-muted-ink">Sin movimientos en el período.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {closing.map((c) => (
              <div key={c.cashierId ?? "sin-cajero"} className="rounded-lg border border-line p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {c.cashierName ?? "Sin cajero"}
                    {/* Sin esta aclaración, un cajero dado de baja y otro
                        activo con el mismo nombre son dos bloques idénticos
                        con plata distinta: parece un bug de la app. */}
                    {c.cashierDeleted && (
                      <span className="ml-1.5 font-normal text-muted-ink">(dado de baja)</span>
                    )}
                  </span>
                  <Money cents={c.collectedTotalCents} size="lg" />
                </div>

                <ul className="space-y-1 border-t border-line pt-2 text-sm">
                  {c.collectedByMethod.filter((m) => isCashInMethod(m.method)).map((m) => (
                    <li key={m.method} className="flex items-center justify-between gap-2">
                      <span className="text-muted-ink">{PAYMENT_METHOD_LABELS[m.method]}</span>
                      <Money cents={m.totalCents} size="sm" />
                    </li>
                  ))}
                </ul>

                <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-muted-ink">
                  <div className="flex items-center justify-between gap-2">
                    <span>Facturado ({c.saleCount} venta{c.saleCount === 1 ? "" : "s"})</span>
                    <Money cents={c.salesTotalCents} size="sm" />
                  </div>
                  {c.creditGivenCents > 0 && (
                    <div className="flex items-center justify-between gap-2 text-warn">
                      <span>Fiado otorgado (no entró)</span>
                      <Money cents={c.creditGivenCents} size="sm" />
                    </div>
                  )}
                  {c.debtCollectedCents > 0 && (
                    <div className="flex items-center justify-between gap-2 text-ok">
                      <span>Cobros de deuda</span>
                      <Money cents={c.debtCollectedCents} size="sm" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
