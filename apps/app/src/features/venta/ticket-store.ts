/**
 * Estado del ticket en curso. Wrapper fino de zustand sobre la lógica pura
 * de domain/ticket.ts — el store no decide nada, solo guarda el resultado.
 */
import { create } from "zustand";
import {
  addToTicket, removeFromTicket, setTicketQty,
  type TicketLine, type TicketProduct,
} from "../../domain/ticket";

interface TicketStore {
  lines: TicketLine[];
  addProduct: (product: TicketProduct) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useTicketStore = create<TicketStore>((set) => ({
  lines: [],
  addProduct: (product) => set((s) => ({ lines: addToTicket(s.lines, product) })),
  setQty: (productId, qty) => set((s) => ({ lines: setTicketQty(s.lines, productId, qty) })),
  remove: (productId) => set((s) => ({ lines: removeFromTicket(s.lines, productId) })),
  clear: () => set({ lines: [] }),
}));
