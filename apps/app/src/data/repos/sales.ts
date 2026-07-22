/**
 * Repositorio de ventas. Los HECHOS son inmutables (regla B): una venta
 * jamás se edita; la única transición es voided_at NULL→valor, con
 * movimientos de stock compensatorios. El total se calcula ACÁ, releyendo
 * precios dentro de la transacción — la UI nunca manda un total propio.
 */
import type { SqlDriver } from "../driver";
import type { RepoContext } from "../context";
import type { DateRange, Sale, SaleInput, SaleItem, SalePayment, SaleWithItems } from "../types";
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
  listByRange(range: DateRange, limit?: number, offset?: number): Promise<Sale[]>;
  getWithItems(id: string): Promise<SaleWithItems | null>;
  voidSale(id: string, reason?: string): Promise<void>;
  /** Total y cantidad de ventas NO anuladas del rango. */
  totalsByRange(range: DateRange): Promise<{ count: number; totalCents: number }>;
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

    async listByRange(range, limit = 100, offset = 0) {
      const rows = await driver.select<SaleRow>(
        `SELECT id, total_cents, voided_at, void_reason, created_at FROM sales
         WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [range.from, range.to, limit, offset],
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

    async totalsByRange(range) {
      const rows = await driver.select<{ count: number; total: number | null }>(
        `SELECT COUNT(*) AS count, SUM(total_cents) AS total FROM sales
         WHERE deleted_at IS NULL AND voided_at IS NULL AND created_at >= ? AND created_at < ?`,
        [range.from, range.to],
      );
      return { count: rows[0]?.count ?? 0, totalCents: rows[0]?.total ?? 0 };
    },
  };
}
