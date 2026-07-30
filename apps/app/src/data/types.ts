/**
 * Entidades que la capa de datos entrega al resto de la app (camelCase,
 * booleans y nulls normalizados). Las filas snake_case de SQLite no salen
 * de los repositorios.
 */
import type { PaymentMethod } from "../domain/ticket";
import type { StockMovementType } from "../domain/stock";
import type { AccountMovementType } from "../domain/account";
import type { DateRange } from "../domain/dates";

export type { DateRange };

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
  /** Quién cobró. null en ventas anteriores a los cajeros. */
  cashierId: string | null;
  /** A quién se le vendió; obligatorio si hay pago fiado. */
  customerId: string | null;
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
  /** Resueltos por JOIN al cargar el detalle (para el ticket y la UI). */
  cashierName: string | null;
  customerName: string | null;
}

/** Input de venta: la UI manda productos y cantidades; el repositorio
 *  relee precios DENTRO de la transacción y calcula el total. */
export interface SaleInput {
  lines: { productId: string; qty: number }[];
  payments: { method: PaymentMethod; amountCents: number }[];
  /** Cajero que atiende. Opcional: las ventas viejas no lo tienen. */
  cashierId?: string | null;
  /** OBLIGATORIO si algún pago es `credit` (no se fía al aire). */
  customerId?: string | null;
}

/** Filtros de las consultas de ventas (Reportes). */
export interface SalesFilter {
  paymentMethod?: PaymentMethod;
  cashierId?: string;
  customerId?: string;
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

/** Fila del ranking de productos más vendidos (Reportes). */
export interface TopProduct {
  productId: string;
  productName: string;
  qty: number;
  revenueCents: number;
}

export interface PaymentBreakdownEntry {
  method: PaymentMethod;
  totalCents: number;
}

// ── Cajeros ─────────────────────────────────────────────────────────────
// Solo identidad (quién atiende): sin clave, sin rol, sin permisos.

export interface Cashier {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// ── Clientes y cuenta corriente (fiado) ─────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  /** Límite BLANDO: se avisa al superarlo, nunca se bloquea. null = sin tope. */
  creditLimitCents: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NewCustomer {
  name: string;
  phone?: string | null;
  notes?: string | null;
  creditLimitCents?: number | null;
}

export interface CustomerPatch {
  name?: string;
  phone?: string | null;
  notes?: string | null;
  creditLimitCents?: number | null;
}

/** Saldo agregado del ledger. Positivo = el cliente debe (ver domain/account.ts). */
export interface CustomerBalance {
  customerId: string;
  balanceCents: number;
}

export interface CustomerWithBalance extends Customer {
  balanceCents: number;
}

export interface AccountMovement {
  id: string;
  customerId: string;
  /** > 0 aumenta la deuda; < 0 la baja. INVERSO al signo del stock. */
  deltaCents: number;
  type: AccountMovementType;
  /** Cómo pagó (solo en `payment`); null en fiados y anulaciones. */
  method: PaymentMethod | null;
  cashierId: string | null;
  saleId: string | null;
  note: string | null;
  createdAt: string;
}

/** Cobro de una deuda: se guarda como movimiento con delta NEGATIVO. */
export interface AccountPaymentInput {
  customerId: string;
  /** Positivo; el repo lo convierte en delta negativo. */
  amountCents: number;
  method: PaymentMethod;
  cashierId?: string | null;
  note?: string | null;
}

/**
 * Cierre de caja de un cajero. Separa deliberadamente lo FACTURADO de lo
 * COBRADO: una venta fiada factura pero no entra plata al cajón, y un cobro
 * de deuda entra plata sin facturar nada nuevo.
 */
export interface CashierClosingEntry {
  /** null = ventas sin cajero (anteriores a la feature). */
  cashierId: string | null;
  cashierName: string | null;
  /**
   * El cajero fue dado de baja pero sus ventas siguen en el período.
   *
   * Existe porque dos personas pueden haberse llamado igual (o alguien
   * pudo renombrar y volver a crear): sin esta marca, el cierre muestra
   * dos bloques con el MISMO nombre y montos distintos, que se lee como
   * un error de la app y no como dos cajeros distintos.
   */
  cashierDeleted: boolean;
  saleCount: number;
  /** Facturado en el período; INCLUYE lo fiado. */
  salesTotalCents: number;
  /** Fiado otorgado: NO entra al cajón. */
  creditGivenCents: number;
  /** Deuda vieja cobrada en el período: SÍ entra al cajón. */
  debtCollectedCents: number;
  /** Desglose de la plata efectivamente recibida (nunca incluye `credit`). */
  collectedByMethod: { method: PaymentMethod; totalCents: number }[];
  /** La plata que tiene que estar. */
  collectedTotalCents: number;
}

/** Fila plana (una por item de venta) para la exportación a Excel. */
export interface SaleExportItem {
  saleId: string;
  saleCreatedAt: string;
  saleVoidedAt: string | null;
  productName: string;
  qty: number;
  unitPriceCents: number;
  subtotalCents: number;
}

/** Datos crudos del período para armar el Excel de Reportes. */
export interface SalesExport {
  sales: Sale[];
  items: SaleExportItem[];
  /** Nombres ya resueltos por JOIN (saleId → cajero/cliente), para no
   *  consultar por fila al exportar. */
  cashierNames: Map<string, { cashier: string | null; customer: string | null }>;
}

