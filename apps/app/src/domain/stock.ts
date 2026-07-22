/**
 * Reglas puras de stock. El stock actual NUNCA es una columna: es la
 * agregación del ledger de movimientos (regla 1 del esquema sync-ready).
 * Puede ser negativo: una venta jamás se bloquea por inventario; el
 * kiosquero corrige después con un ajuste.
 */

export type StockMovementType =
  | "sale"
  | "restock"
  | "adjustment"
  | "shrinkage"
  | "initial"
  | "void_reversal";

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  sale: "Venta",
  restock: "Reposición",
  adjustment: "Ajuste",
  shrinkage: "Merma",
  initial: "Carga inicial",
  void_reversal: "Venta anulada",
};

export type StockStatus = "ok" | "low" | "out";

export function stockStatus(qty: number, lowThreshold: number | null): StockStatus {
  if (qty <= 0) return "out";
  if (lowThreshold !== null && qty <= lowThreshold) return "low";
  return "ok";
}
