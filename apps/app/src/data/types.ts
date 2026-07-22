/**
 * Entidades que la capa de datos entrega al resto de la app (camelCase,
 * booleans y nulls normalizados). Las filas snake_case de SQLite no salen
 * de los repositorios.
 */
import type { PaymentMethod } from "../domain/ticket";
import type { StockMovementType } from "../domain/stock";

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  priceCents: number;
  costCents: number | null;
  categoryId: string | null;
  lowStockThreshold: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NewProduct {
  name: string;
  barcode?: string | null;
  priceCents: number;
  costCents?: number | null;
  categoryId?: string | null;
  lowStockThreshold?: number | null;
  /** Stock inicial opcional: genera un movimiento `initial` en el ledger. */
  initialStock?: number;
}

export interface ProductPatch {
  name?: string;
  barcode?: string | null;
  priceCents?: number;
  costCents?: number | null;
  categoryId?: string | null;
  lowStockThreshold?: number | null;
}

export interface Sale {
  id: string;
  totalCents: number;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  unitPriceCents: number;
  costCents: number | null;
  qty: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amountCents: number;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
  payments: SalePayment[];
}

/** Input de venta: la UI manda productos y cantidades; el repositorio
 *  relee precios DENTRO de la transacción y calcula el total. */
export interface SaleInput {
  lines: { productId: string; qty: number }[];
  payments: { method: PaymentMethod; amountCents: number }[];
}

export interface StockLevel {
  productId: string;
  qty: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  qtyDelta: number;
  type: StockMovementType;
  saleId: string | null;
  note: string | null;
  createdAt: string;
}

export interface StockMovementInput {
  productId: string;
  qtyDelta: number;
  type: Exclude<StockMovementType, "sale" | "void_reversal">;
  note?: string;
}

export interface DateRange {
  /** ISO inclusive. */
  from: string;
  /** ISO exclusive. */
  to: string;
}
