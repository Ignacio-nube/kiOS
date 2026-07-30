/**
 * Administración de datos: cargar un juego de prueba, borrar el historial
 * de ventas (lo que más crece) o dejar la app como recién instalada.
 *
 * Las dos acciones destructivas piden CONFIRMACIÓN ESCRITA (hay que tipear
 * una palabra) en vez de un "¿estás seguro?" que se aprieta sin leer: acá
 * se borra de verdad, sin papelera y sin deshacer.
 */
import { useCallback, useEffect, useState } from "react";
import { Database, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { useCashierStore } from "../cajeros/cashier-store";
import type { DataCounts } from "../../data/repos/maintenance";
import { Card, CardBody } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Money } from "../../ui/money";
import { Skeleton } from "../../ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../ui/shadcn/dialog";

type Destructive = "sales" | "all";

const DESTRUCTIVE: Record<Destructive, {
  title: string;
  description: string;
  keep: string;
  word: string;
  cta: string;
}> = {
  sales: {
    title: "Borrar el historial de ventas",
    description:
      "Se eliminan todas las ventas, sus ítems, los pagos y los movimientos de stock que generaron. Es lo que más ocupa con el tiempo.",
    keep: "Se conservan los productos, las categorías, el stock cargado a mano y —importante— las cuentas corrientes: las deudas de tus clientes NO se borran.",
    word: "BORRAR",
    cta: "Borrar ventas",
  },
  all: {
    title: "Restablecer la app",
    description:
      "Se elimina TODO el dato de negocio: productos, categorías, stock, ventas, pagos, cajeros, clientes y sus deudas. La app queda como recién instalada.",
    keep: "Se conservan el nombre del kiosco, la licencia activada y la configuración de apariencia.",
    word: "RESTABLECER",
    cta: "Restablecer todo",
  },
};

export function DatosCard({ onChanged }: { onChanged?: () => void }) {
  const { repos } = useApp();
  const hydrateCashiers = useCashierStore((s) => s.hydrate);
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [busy, setBusy] = useState<null | "seed" | Destructive>(null);
  const [confirming, setConfirming] = useState<Destructive | null>(null);
  const [typed, setTyped] = useState("");

  const refresh = useCallback(() => {
    void repos.maintenance.counts().then(setCounts);
  }, [repos]);

  useEffect(refresh, [refresh]);

  /** Reconsulta acá y avisa al resto de la pantalla (contador de licencia). */
  function afterChange() {
    refresh();
    // `resetAll` borra los cajeros pero `meta` conserva el id del activo:
    // rehidratar recrea el principal y limpia esa referencia colgada. Sin
    // esto quedás sin cajero hasta reiniciar la app.
    void hydrateCashiers(repos);
    onChanged?.();
  }

  async function handleSeed() {
    setBusy("seed");
    try {
      const { products, sales, customers, cashiers } = await repos.maintenance.seedSampleData();
      toast.success(`Listo: ${products} productos, ${sales} ventas y ${customers} clientes.`, {
        description: `Ventas de los últimos 30 días con ${cashiers} cajeros y cuentas fiadas — mirá Reportes y Clientes.`,
      });
      afterChange();
    } catch (cause) {
      toast.error("No se pudieron cargar los datos de ejemplo", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleDestructive(kind: Destructive) {
    setBusy(kind);
    setConfirming(null);
    setTyped("");
    try {
      if (kind === "sales") {
        await repos.maintenance.clearSales();
        toast.success("Historial de ventas borrado.");
      } else {
        await repos.maintenance.resetAll();
        toast.success("La app quedó como recién instalada.");
      }
      afterChange();
    } catch (cause) {
      toast.error("No se pudo completar la operación", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(null);
    }
  }

  const config = confirming ? DESTRUCTIVE[confirming] : null;
  const canConfirm = config !== null && typed.trim().toUpperCase() === config.word;
  const empty = counts !== null && counts.products === 0 && counts.sales === 0;

  return (
    <>
      <Card>
        <CardBody className="space-y-4">
          {counts === null ? (
            <Skeleton className="h-4 w-56" />
          ) : (
            <div className="space-y-1">
              <p className="tnum text-sm text-muted-ink">
                {counts.products.toLocaleString("es-AR")} productos ·{" "}
                {counts.sales.toLocaleString("es-AR")} ventas ·{" "}
                {counts.movements.toLocaleString("es-AR")} movimientos de stock
              </p>
              <p className="tnum text-sm text-muted-ink">
                {counts.customers.toLocaleString("es-AR")} clientes
                {counts.debtCents > 0 && (
                  <> · te deben <Money cents={counts.debtCents} size="sm" className="font-semibold text-ink" /></>
                )}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Cargar datos de ejemplo</p>
                <p className="text-xs text-muted-ink">
                  50 productos de kiosco y un mes de ventas, para probar Reportes y Stock con
                  datos de verdad. Se suma a lo que ya tengas.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => void handleSeed()}
                className="shrink-0"
              >
                {busy === "seed" ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                {busy === "seed" ? "Cargando…" : "Cargar"}
              </Button>
            </div>

            <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Borrar historial de ventas</p>
                <p className="text-xs text-muted-ink">
                  Libera espacio conservando el catálogo y el stock. Útil si la app se puso lenta
                  o pesada después de mucho uso.
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy !== null || counts?.sales === 0}
                onClick={() => { setConfirming("sales"); setTyped(""); }}
                className="shrink-0"
              >
                {busy === "sales" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Borrar ventas
              </Button>
            </div>

            <div className="flex items-start justify-between gap-3 border-t border-line pt-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Restablecer la app</p>
                <p className="text-xs text-muted-ink">
                  Borra todo el dato de negocio y deja kiOS como recién instalado. Tu licencia y
                  tus ajustes quedan.
                </p>
              </div>
              <Button
                variant="danger"
                disabled={busy !== null || empty}
                onClick={() => { setConfirming("all"); setTyped(""); }}
                className="shrink-0"
              >
                {busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <TriangleAlert className="size-4" />}
                Restablecer
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) { setConfirming(null); setTyped(""); } }}
      >
        <DialogContent>
          {config && (
            <>
              <DialogHeader>
                <DialogTitle>{config.title}</DialogTitle>
                <DialogDescription>{config.description}</DialogDescription>
              </DialogHeader>

              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-ink">{config.keep}</p>
              <p className="text-sm font-medium text-danger">
                Esto no se puede deshacer. Si querés guardar tus números, exportá el Excel desde
                Reportes antes de seguir.
              </p>

              <div className="space-y-1.5">
                <label htmlFor="confirm-word" className="text-sm text-muted-ink">
                  Escribí <span className="font-semibold text-ink">{config.word}</span> para confirmar
                </label>
                <Input
                  id="confirm-word"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={config.word}
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canConfirm && confirming) {
                      void handleDestructive(confirming);
                    }
                  }}
                />
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => { setConfirming(null); setTyped(""); }}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  disabled={!canConfirm}
                  onClick={() => confirming && void handleDestructive(confirming)}
                >
                  {config.cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
