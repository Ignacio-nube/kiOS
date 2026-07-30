/**
 * ABM de cajeros. Se configura una vez y no se toca más, así que es una card
 * de Configuración y no una pantalla.
 *
 * Un cajero es SOLO identidad: no hay clave ni permisos. Sirve para saber
 * quién cobró y para cerrar la caja, no para restringir nada.
 */
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { confirm } from "../../ui/confirm-dialog";
import { useApp } from "../../lib/app-context";
import { useCashierStore } from "../cajeros/cashier-store";
import { isValidCashierName } from "../../domain/cashiers";
import { foldForSearch } from "../../domain/search";
import { Card, CardBody } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { ListRow, ListRowMain, ListRowTitle } from "../../ui/list-row";

/** A partir de cuántos cajeros aparece el buscador: con pocos, listarlos
 *  todos es más rápido que escribir; con muchos, hace falta filtrar. */
const SEARCH_THRESHOLD = 8;

// El plegado sin acentos vive en `domain/search`: acá se filtra en memoria
// (son diez cajeros) pero tiene que dar el MISMO resultado que el buscador
// de productos y clientes, que lo resuelve en SQL. Dos implementaciones de
// "sin acentos" hacen que la misma búsqueda encuentre cosas distintas según
// la pantalla.

export function CajerosCard() {
  const { repos } = useApp();
  const cashiers = useCashierStore((s) => s.cashiers);
  const activeId = useCashierStore((s) => s.activeId);
  const hydrate = useCashierStore((s) => s.hydrate);
  const [nuevo, setNuevo] = useState("");
  const [filtro, setFiltro] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const visibles = useMemo(() => {
    const term = foldForSearch(filtro.trim());
    if (term === "") return cashiers;
    return cashiers.filter((c) => foldForSearch(c.name).includes(term));
  }, [cashiers, filtro]);

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      await hydrate(repos);
      toast.success(ok);
    } catch (cause) {
      toast.error("No se pudo guardar", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(false);
    }
  }

  async function agregar() {
    if (!isValidCashierName(nuevo)) {
      toast.error("Escribí un nombre para el cajero");
      return;
    }
    await run(async () => {
      await repos.cashiers.create({ name: nuevo });
      setNuevo("");
    }, "Cajero agregado");
  }

  async function guardarNombre() {
    if (!editing || !isValidCashierName(editing.name)) return;
    const { id, name } = editing;
    await run(async () => {
      await repos.cashiers.rename(id, name);
      setEditing(null);
    }, "Nombre actualizado");
  }

  async function darDeBaja(id: string, name: string) {
    const ok = await confirm({
      title: `¿Dar de baja a "${name}"?`,
      description: "Sus ventas anteriores no se tocan.",
      confirmLabel: "Dar de baja",
      danger: true,
    });
    if (!ok) return;
    await run(() => repos.cashiers.softDelete(id), "Cajero dado de baja");
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-xs text-muted-ink">
          El cierre de caja muestra cuánto cobró cada uno. No hay claves ni permisos:
          es para organizarse, no para restringir.
        </p>

        {cashiers.length > SEARCH_THRESHOLD && (
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar cajero..."
          />
        )}

        {/* Con pocos cajeros esto nunca llega a scrollear; con muchos, evita
            que la card empuje al resto de Configuración fuera de pantalla. */}
        <div className="max-h-72 overflow-y-auto overflow-x-hidden rounded-lg border border-line">
          {visibles.length === 0 && (
            <p className="p-3 text-center text-xs text-muted-ink">Ningún cajero coincide con "{filtro}"</p>
          )}
          {visibles.map((c) => (
            <ListRow key={c.id}>
              <UserRound className="size-4 shrink-0 text-muted-ink" />
              <ListRowMain>
                {editing?.id === c.id ? (
                  <Input
                    autoFocus
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void guardarNombre();
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onBlur={() => void guardarNombre()}
                  />
                ) : (
                  <ListRowTitle>{c.name}</ListRowTitle>
                )}
              </ListRowMain>
              {c.id === activeId && <Badge tone="brand">En caja</Badge>}
              {editing?.id !== c.id && (
                <div className="flex items-center gap-1">
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-muted hover:text-ink"
                    onClick={() => setEditing({ id: c.id, name: c.name })}
                    aria-label="Renombrar"
                    disabled={busy}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-danger/10 hover:text-danger"
                    onClick={() => void darDeBaja(c.id, c.name)}
                    aria-label="Dar de baja"
                    disabled={busy}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </ListRow>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Nombre del cajero"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void agregar();
              }
            }}
          />
          <Button variant="outline" disabled={busy} onClick={() => void agregar()}>
            <Plus className="size-4" /> Agregar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
