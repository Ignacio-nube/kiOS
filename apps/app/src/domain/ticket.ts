/**
 * Lógica pura del ticket en curso (el carrito del mostrador).
 * No sabe de React ni de SQL: recibe y devuelve datos.
 */

export type PaymentMethod = "cash" | "card" | "qr" | "transfer";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "card", "qr", "transfer"];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  qr: "QR / MercadoPago",
  transfer: "Transferencia",
};

export interface TicketLine {
  productId: string;
  name: string;
  unitPriceCents: number;
  qty: number;
}

export interface TicketProduct {
  id: string;
  name: string;
  priceCents: number;
}

/** Agrega un producto al ticket; si ya está, suma cantidad. */
export function addToTicket(lines: TicketLine[], product: TicketProduct, qty = 1): TicketLine[] {
  const existing = lines.find((l) => l.productId === product.id);
  if (existing) {
    return lines.map((l) =>
      l.productId === product.id ? { ...l, qty: l.qty + qty } : l,
    );
  }
  return [
    ...lines,
    { productId: product.id, name: product.name, unitPriceCents: product.priceCents, qty },
  ];
}

/** Cantidad exacta; qty <= 0 elimina la línea. */
export function setTicketQty(lines: TicketLine[], productId: string, qty: number): TicketLine[] {
  if (qty <= 0) return lines.filter((l) => l.productId !== productId);
  return lines.map((l) => (l.productId === productId ? { ...l, qty } : l));
}

export function removeFromTicket(lines: TicketLine[], productId: string): TicketLine[] {
  return lines.filter((l) => l.productId !== productId);
}

export function ticketTotal(lines: TicketLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
}

export function ticketItemCount(lines: TicketLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Vuelto a entregar; null si lo pagado no alcanza. */
export function changeDue(totalCents: number, paidCents: number): number | null {
  return paidCents >= totalCents ? paidCents - totalCents : null;
}
