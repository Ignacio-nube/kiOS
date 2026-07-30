/**
 * Quién está atendiendo la caja. Vive en un store global (no en el contexto
 * de la app) porque lo leen pantallas que no están montadas a la vez: el
 * rail lo muestra, el cobro lo estampa en la venta y Hoy lo resuelve a
 * nombre sin consultar la base por fila.
 *
 * NO es autenticación: sin clave, sin permisos. Solo identidad.
 */
import { create } from "zustand";
import type { Cashier } from "../../data/types";
import type { Repositories } from "../../data/repos";
import { META_KEYS } from "../../data/bootstrap";

interface CashierStore {
  cashiers: Cashier[];
  activeId: string | null;
  /** Relee la lista y valida el cajero guardado. Idempotente. */
  hydrate: (repos: Repositories) => Promise<void>;
  setActive: (repos: Repositories, id: string) => Promise<void>;
  /** Nombre para mostrar; null si todavía no hidrató. */
  activeName: () => string | null;
}

export const useCashierStore = create<CashierStore>((set, get) => ({
  cashiers: [],
  activeId: null,

  async hydrate(repos) {
    // Garantiza que SIEMPRE haya al menos uno (el principal, con el nombre
    // del negocio) antes de resolver cuál está activo.
    const businessName = (await repos.meta.get(META_KEYS.businessName)) ?? "";
    await repos.cashiers.ensureDefault(businessName);
    const cashiers = await repos.cashiers.list();
    const stored = await repos.meta.get(META_KEYS.activeCashierId);

    // El id guardado puede estar colgado: `resetAll` conserva `meta` pero
    // borra `cashiers`, y un cajero puede haberse dado de baja. Si no está
    // en la lista, se cae al primero en vez de dejar la caja sin nombre.
    const valid = stored !== null && cashiers.some((c) => c.id === stored);
    const activeId = valid ? stored : (cashiers[0]?.id ?? null);
    if (!valid && activeId) {
      await repos.meta.set(META_KEYS.activeCashierId, activeId);
    }
    set({ cashiers, activeId });
  },

  async setActive(repos, id) {
    set({ activeId: id });
    await repos.meta.set(META_KEYS.activeCashierId, id);
  },

  activeName() {
    const { cashiers, activeId } = get();
    return cashiers.find((c) => c.id === activeId)?.name ?? null;
  },
}));

/** Mapa id→nombre, para listas que ya tienen el id de la venta. */
export function useCashierNames(): Map<string, string> {
  const cashiers = useCashierStore((s) => s.cashiers);
  return new Map(cashiers.map((c) => [c.id, c.name]));
}
