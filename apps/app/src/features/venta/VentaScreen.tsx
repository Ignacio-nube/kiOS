/**
 * Pantalla de venta: lo único que importa de verdad. El input de búsqueda
 * está siempre enfocado (el lector de barras USB es un teclado más: tipea
 * el código y manda Enter). Enter con match exacto de barcode agrega
 * directo; si no, agrega el primer resultado de la búsqueda por nombre.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, ScanLine, ShoppingCart, Trash2, X } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { useTicketStore } from "./ticket-store";
import { useProductSearch } from "./use-product-search";
import { CobrarDialog } from "./CobrarDialog";
import { ticketItemCount, ticketTotal } from "../../domain/ticket";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Money } from "../../ui/money";
import { Kbd } from "../../ui/kbd";
import { EmptyState } from "../../ui/empty-state";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";

export function VentaScreen() {
  const { repos } = useApp();
  const [term, setTerm] = useState("");
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useProductSearch(term);
  const { lines, addProduct, setQty, remove, clear } = useTicketStore();
  const total = useMemo(() => ticketTotal(lines), [lines]);
  const count = useMemo(() => ticketItemCount(lines), [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onGlobalKeydown(e: KeyboardEvent) {
      if (cobrarOpen) return; // el diálogo de cobro tiene su propio input, no le robamos el foco

      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && lines.length > 0) {
        e.preventDefault();
        setCobrarOpen(true);
        return;
      }

      // El lector de barras es un teclado más: tipea el código y manda
      // Enter. No debería hacer falta clickear el buscador antes — ante
      // cualquier tecla imprimible, si el foco está en otro lado (o en
      // ningún lado), lo redirigimos ahí. El focus() corre ANTES de que
      // el navegador inserte el carácter, así que termina cayendo en el
      // input recién enfocado en vez de perderse.
      if (
        document.activeElement !== inputRef.current &&
        e.key.length === 1 &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onGlobalKeydown);
    return () => window.removeEventListener("keydown", onGlobalKeydown);
  }, [lines.length, cobrarOpen]);

  async function handleEnter() {
    const trimmed = term.trim();
    if (trimmed === "") return;

    const exact = await repos.products.getByBarcode(trimmed);
    if (exact) {
      addProduct({ id: exact.id, name: exact.name, priceCents: exact.priceCents });
      setTerm("");
      return;
    }
    if (results[0]) {
      addProduct({ id: results[0].id, name: results[0].name, priceCents: results[0].priceCents });
      setTerm("");
    }
  }

  return (
    <div className="grid h-full grid-cols-1 gap-6 p-6 lg:grid-cols-[1fr_400px]">
      {/* Buscador / scanner */}
      <div className="flex min-h-0 flex-col">
        <div className="relative">
          <ScanLine className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-ink" aria-hidden />
          <Input
            ref={inputRef}
            size="lg"
            className="pl-12"
            placeholder="Escaneá un código o buscá por nombre…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleEnter();
              }
              if (e.key === "Escape") setTerm("");
            }}
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface">
          {term.trim() === "" ? (
            <EmptyState
              icon={ScanLine}
              title="Escaneá o buscá un producto"
              description="El código de barras funciona como si fuera un teclado: escaneá y se agrega solo."
            />
          ) : results.length === 0 ? (
            <EmptyState title="Sin resultados" description={`Nada coincide con "${term}".`} />
          ) : (
            results.map((product) => (
              <ListRow
                key={product.id}
                interactive
                onClick={() => {
                  addProduct({ id: product.id, name: product.name, priceCents: product.priceCents });
                  setTerm("");
                  inputRef.current?.focus();
                }}
              >
                <ListRowMain>
                  <ListRowTitle>{product.name}</ListRowTitle>
                  {product.barcode && <ListRowDetail>{product.barcode}</ListRowDetail>}
                </ListRowMain>
                <Money cents={product.priceCents} />
              </ListRow>
            ))
          )}
        </div>
      </div>

      {/* Pizarra del ticket */}
      <div className="flex min-h-0 flex-col rounded-2xl bg-ink-strong p-5 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-[0.18em] text-white/50 uppercase">
            Ticket {count > 0 && `· ${count}`}
          </h2>
          {lines.length > 0 && (
            <button
              onClick={clear}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Trash2 className="size-3.5" /> Vaciar
            </button>
          )}
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-auto">
          {lines.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="El ticket está vacío"
              description="Escaneá un producto o buscalo por nombre para empezar."
              className="text-white [&_p]:text-white/60 [&_svg]:text-white/40"
            />
          ) : (
            <ul className="space-y-1">
              {lines.map((line) => (
                <li key={line.productId} className="flex items-center gap-2 rounded-lg px-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <Money cents={line.unitPriceCents} size="sm" className="text-white/50" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="flex size-6 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => setQty(line.productId, line.qty - 1)}
                      aria-label="Restar"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="tnum w-6 text-center text-sm">{line.qty}</span>
                    <button
                      className="flex size-6 items-center justify-center rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => setQty(line.productId, line.qty + 1)}
                      aria-label="Sumar"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <Money cents={line.unitPriceCents * line.qty} className="w-20 text-right" />
                  <button
                    className="flex size-6 items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
                    onClick={() => remove(line.productId)}
                    aria-label="Quitar"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 border-t border-white/15 pt-4">
          <p className="text-xs text-white/50">Total</p>
          <Money cents={total} size="display" className="text-white" />
          <Button
            variant="accent"
            size="xl"
            className="mt-4 w-full"
            disabled={lines.length === 0}
            onClick={() => setCobrarOpen(true)}
          >
            Cobrar
            <span className="ml-1 flex items-center gap-0.5 opacity-70">
              <Kbd className="border-brand-ink/30 bg-transparent text-brand-ink">Ctrl</Kbd>
              <Kbd className="border-brand-ink/30 bg-transparent text-brand-ink">Enter</Kbd>
            </span>
          </Button>
        </div>
      </div>

      <CobrarDialog
        open={cobrarOpen}
        onOpenChange={setCobrarOpen}
        lines={lines}
        totalCents={total}
        onConfirmed={() => {
          clear();
          setCobrarOpen(false);
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}
