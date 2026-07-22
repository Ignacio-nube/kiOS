/**
 * Repositorio de ventas. Los HECHOS son inmutables (regla B): una venta
 * jamás se edita; la única transición es voided_at NULL→valor, con
 * movimientos de stock compensatorios. El total se calcula ACÁ, releyendo
 * precios dentro de la transacción — la UI nunca manda un total propio.
 */
import type { SqlDriver } from "../driver";
import type { RepoContext } from "../context";
import type {
  DateRange, PaymentBreakdownEntry, Sale, SaleInput, SaleItem, SalePayment, SaleWithItems, TopProduct,
} from "../types";
import type { PaymentMethod } from "../../domain/ticket";
import { insertMovement } from "./products";

interface SaleRow {
  id: string;
  total_cents: number;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  unit_price_cents: number;
  cost_cents: number | null;
  qty: number;
}

function mapSale(row: SaleRow): Sale {
  return {
    id: row.id,
    totalCents: row.total_cents,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
  };
}

function mapItem(row: SaleItemRow): SaleItem {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    productName: row.product_name,
    unitPriceCents: row.unit_price_cents,
    costCents: row.cost_cents,
    qty: row.qty,
  };
}

export interface SalesRepo {
  registerSale(input: SaleInput): Promise<SaleWithItems>;
  /** `paymentMethod` filtra a ventas pagadas con ese medio (para Reportes). */
  listByRange(range: DateRange, limit?: number, offset?: number, paymentMethod?: PaymentMethod): Promise<Sale[]>;
  getWithItems(id: string): Promise<SaleWithItems | null>;
  voidSale(id: string, reason?: string): Promise<void>;
  /** Total y cantidad de ventas NO anuladas del rango. */
  totalsByRange(range: DateRange, paymentMethod?: PaymentMethod): Promise<{ count: number; totalCents: number }>;
  /** Ranking por facturación; `categoryId` filtra por la categoría ACTUAL del producto. */
  topProducts(range: DateRange, opts?: { categoryId?: string; limit?: number }): Promise<TopProduct[]>;
  /** Facturación agrupada por medio de pago, excluyendo ventas anuladas. */
  paymentBreakdown(range: DateRange): Promise<PaymentBreakdownEntry[]>;
}

export function createSalesRepo(driver: SqlDriver, ctx: RepoContext): SalesRepo {
  async function loadWithItems(id: string): Promise<SaleWithItems | null> {
    const sales = await driver.select<SaleRow>(
      "SELECT id, total_cents, voided_at, void_reason, created_at FROM sales WHERE id = ?",
      [id],
    );
    if (!sales[0]) return null;
    const items = await driver.select<SaleItemRow>(
      `SELECT id, sale_id, product_id, product_name, unit_price_cents, cost_cents, qty
       FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL`,
      [id],
    );
    const payments = await driver.select<{ method: PaymentMethod; amount_cents: number }>(
      "SELECT method, amount_cents FROM sale_payments WHERE sale_id = ? AND deleted_at IS NULL",
      [id],
    );
    return {
      ...mapSale(sales[0]),
      items: items.map(mapItem),
      payments: payments.map((p): SalePayment => ({ method: p.method, amountCents: p.amount_cents })),
    };
  }

  return {
    async registerSale(input) {
      if (input.lines.length === 0) throw new Error("La venta no tiene items");
      if (input.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0)) {
        throw new Error("Cantidad inválida en la venta");
      }
      if (input.payments.length === 0) throw new Error("La venta no tiene pago");

      const saleId = ctx.newId();

      await driver.transaction(async (tx) => {
        // Precios y nombres se releen DENTRO de la transacción: snapshot fiel
        // aunque otra pantalla haya editado el producto un instante antes.
        const placeholders = input.lines.map(() => "?").join(", ");
        const products = await tx.select<{
          id: string;
          name: string;
          price_cents: number;
          cost_cents: number | null;
        }>(
          `SELECT id, name, price_cents, cost_cents FROM products
           WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
          input.lines.map((l) => l.productId),
        );
        const byId = new Map(products.map((p) => [p.id, p]));

        let totalCents = 0;
        for (const line of input.lines) {
          const product = byId.get(line.productId);
          if (!product) throw new Error(`Producto inexistente en la venta: ${line.productId}`);
          totalCents += product.price_cents * line.qty;
        }

        const paid = input.payments.reduce((sum, p) => sum + p.amountCents, 0);
        if (paid !== totalCents) {
          throw new Error(`Los pagos (${paid}) no igualan el total (${totalCents})`);
        }

        const now = ctx.now();
        await tx.execute(
          `INSERT INTO sales (id, tenant_id, total_cents, created_at, updated_at, device_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [saleId, ctx.tenantId, totalCents, now, now, ctx.deviceId],
        );

        for (const line of input.lines) {
          const product = byId.get(line.productId)!;
          await tx.execute(
            `INSERT INTO sale_items (id, tenant_id, sale_id, product_id, product_name,
               unit_price_cents, cost_cents, qty, created_at, updated_at, device_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              ctx.newId(), ctx.tenantId, saleId, product.id, product.name,
              product.price_cents, product.cost_cents, line.qty, now, now, ctx.deviceId,
            ],
          );
          await insertMovement(tx, ctx, {
            productId: product.id, qtyDelta: -line.qty, type: "sale", saleId, note: null,
          });
        }

        for (const payment of input.payments) {
          await tx.execute(
            `INSERT INTO sale_payments (id, tenant_id, sale_id, method, amount_cents,
               created_at, updated_at, device_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ctx.newId(), ctx.tenantId, saleId, payment.method, payment.amountCents, now, now, ctx.deviceId],
          );
        }
      });

      const sale = await loadWithItems(saleId);
      if (!sale) throw new Error("La venta recién registrada no se pudo releer");
      return sale;
    },

    async listByRange(range, limit = 100, offset = 0, paymentMethod) {
      const paymentFilter = paymentMethod
        ? `AND EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = sales.id
             AND sp.method = ? AND sp.deleted_at IS NULL)`
        : "";
      const params: unknown[] = [range.from, range.to];
      if (paymentMethod) params.push(paymentMethod);
      params.push(limit, offset);

      const rows = await driver.select<SaleRow>(
        `SELECT id, total_cents, voided_at, void_reason, created_at FROM sales
         WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${paymentFilter}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        params,
      );
      return rows.map(mapSale);
    },

    getWithItems: loadWithItems,

    async voidSale(id, reason) {
      await driver.transaction(async (tx) => {
        const rows = await tx.select<SaleRow>(
          "SELECT id, total_cents, voided_at, void_reason, created_at FROM sales WHERE id = ? AND deleted_at IS NULL",
          [id],
        );
        if (!rows[0]) throw new Error("Venta inexistente");
        if (rows[0].voided_at) throw new Error("La venta ya está anulada");

        const now = ctx.now();
        await tx.execute(
          `UPDATE sales SET voided_at = ?, void_reason = ?, updated_at = ?, device_id = ?
           WHERE id = ? AND voided_at IS NULL`,
          [now, reason ?? null, now, ctx.deviceId, id],
        );

        const items = await tx.select<{ product_id: string; qty: number }>(
          "SELECT product_id, qty FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL",
          [id],
        );
        for (const item of items) {
          await insertMovement(tx, ctx, {
            productId: item.product_id, qtyDelta: item.qty, type: "void_reversal", saleId: id, note: null,
          });
        }
      });
    },

    async totalsByRange(range, paymentMethod) {
      const paymentFilter = paymentMethod
        ? `AND EXISTS (SELECT 1 FROM sale_payments sp WHERE sp.sale_id = sales.id
             AND sp.method = ? AND sp.deleted_at IS NULL)`
        : "";
      const params: unknown[] = [range.from, range.to];
      if (paymentMethod) params.push(paymentMethod);

      const rows = await driver.select<{ count: number; total: number | null }>(
        `SELECT COUNT(*) AS count, SUM(total_cents) AS total FROM sales
         WHERE deleted_at IS NULL AND voided_at IS NULL AND created_at >= ? AND created_at < ? ${paymentFilter}`,
        params,
      );
      return { count: rows[0]?.count ?? 0, totalCents: rows[0]?.total ?? 0 };
    },

    async topProducts(range, opts) {
      const categoryFilter = opts?.categoryId ? "AND p.category_id = ?" : "";
      const params: unknown[] = [range.from, range.to];
      if (opts?.categoryId) params.push(opts.categoryId);
      params.push(opts?.limit ?? 10);

      const rows = await driver.select<{
        product_id: string;
        product_name: string;
        qty: number;
        revenue_cents: number;
      }>(
        `SELECT si.product_id AS product_id,
                COALESCE(p.name, MIN(si.product_name)) AS product_name,
                SUM(si.qty) AS qty,
                SUM(si.unit_price_cents * si.qty) AS revenue_cents
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN products p ON p.id = si.product_id
         WHERE s.deleted_at IS NULL AND s.voided_at IS NULL AND si.deleted_at IS NULL
           AND s.created_at >= ? AND s.created_at < ? ${categoryFilter}
         GROUP BY si.product_id
         ORDER BY revenue_cents DESC
         LIMIT ?`,
        params,
      );
      return rows.map((r): TopProduct => ({
        productId: r.product_id, productName: r.product_name, qty: r.qty, revenueCents: r.revenue_cents,
      }));
    },

    async paymentBreakdown(range) {
      const rows = await driver.select<{ method: PaymentMethod; total_cents: number }>(
        `SELECT sp.method AS method, SUM(sp.amount_cents) AS total_cents
         FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
         WHERE s.deleted_at IS NULL AND s.voided_at IS NULL AND sp.deleted_at IS NULL
           AND s.created_at >= ? AND s.created_at < ?
         GROUP BY sp.method
         ORDER BY total_cents DESC`,
        [range.from, range.to],
      );
      return rows.map((r): PaymentBreakdownEntry => ({ method: r.method, totalCents: r.total_cents }));
    },
  };
}
