/**
 * Cola de impresión de tickets (una sola a la vez). Cualquier pantalla pide
 * imprimir con `printTicket(venta, nombreDelKiosco)`; el <TicketPrintArea>
 * montado en el shell se encarga de renderizar y disparar el diálogo de
 * impresión del sistema. Así ninguna pantalla necesita saber CÓMO se imprime.
 */
import { create } from "zustand";
import type { SaleWithItems } from "../../data/types";

/** Saldo de la cuenta DESPUÉS de esta venta, para el pie del ticket fiado. */
export interface CreditInfo {
  customerName: string;
  balanceCents: number;
}

interface PrintStore {
  /** Venta a imprimir; null = no hay nada en la cola. */
  sale: SaleWithItems | null;
  businessName: string;
  creditInfo: CreditInfo | null;
  print: (sale: SaleWithItems, businessName: string, creditInfo?: CreditInfo) => void;
  /** Lo llama el área de impresión cuando ya disparó window.print(). */
  done: () => void;
}

export const usePrintStore = create<PrintStore>((set) => ({
  sale: null,
  businessName: "",
  creditInfo: null,
  print: (sale, businessName, creditInfo) =>
    set({ sale, businessName, creditInfo: creditInfo ?? null }),
  done: () => set({ sale: null, creditInfo: null }),
}));

/**
 * Helper imperativo: se puede llamar desde fuera de React. `creditInfo` lo
 * pasa quien ya calculó el saldo (el cobro), para que el área de impresión
 * nunca tenga que consultar la base.
 */
export function printTicket(
  sale: SaleWithItems,
  businessName: string,
  creditInfo?: CreditInfo,
): void {
  usePrintStore.getState().print(sale, businessName, creditInfo);
}
