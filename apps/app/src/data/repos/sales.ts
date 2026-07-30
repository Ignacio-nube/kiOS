/**
 * Repositorio de ventas. Los HECHOS son inmutables (regla B): una venta
 * jamás se edita; la única transición es voided_at NULL→valor, con
 * movimientos de stock compensatorios. El total se calcula ACÁ, releyendo
 * precios dentro de la transacción — la UI nunca manda un total propio.
 */
import type { SqlDriver } from "../driver";
import type { RepoContext } from "../context";
import type {
  CashierClosingEntry, DateRange, PaymentBreakdownEntry, Sale, SaleExportItem, SaleInput,
  SaleItem, SalePayment, SalesExport, SalesFilter, SaleWithItems, TopProduct,
} from "../types";
import type { PaymentMethod } from "../../domain/ticket";
import { insertMovement } from "./products";
import { assertCustomerExists, insertAccountMovement } from "./customers";

interface SaleRow {
  id: string;
  total_cents: number;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  cashier_id: string | null;
  customer_id: string | null;
}

const SALE_COLUMNS =
  "id, total_cents, voided_at, void_reason, created_at, cashier_id, customer_id";

/**
 * Filtros de ventas como fragmento SQL reusable. Existe porque el `EXISTS`
 * del medio de pago estaba copiado en cuatro consultas con dos alias
 * distintos — exactamente donde se colaría un bug al sumar un filtro nuevo.
 * `alias` es el nombre con el que la consulta llama a la tabla `sales`.
 */
function buildSalesFilter(filter: SalesFilter | undefined, alias: string): {
  sql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter?.paymentMethod) {
    clauses.push(
      `AND EXISTS (SELECT 1 FROM sale_payments sp_f WHERE sp_f.sale_id = ${alias}.id
         AND sp_f.method = ? AND sp_f.deleted_at IS NULL)`,
    );
    params.push(filter.paymentMethod);
  }
  if (filter?.cashierId) {
    clauses.push(`AND ${alias}.cashier_id = ?`);
    params.push(filter.cashierId);
  }
  if (filter?.customerId) {
    clauses.push(`AND ${alias}.customer_id = ?`);
    params.push(filter.customerId);
  }
  return { sql: clauses.join(" "), params };
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
    cashierId: row.cashier_id,
    customerId: row.customer_id,
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
  listByRange(range: DateRange, limit?: number, offset?: number, filter?: SalesFilter): Promise<Sale[]>;
  /**
   * Cuántas filas devolvería `listByRange`. Ojo: **INCLUYE las anuladas**,
   * porque el listado también las muestra (tachadas). NO sirve
   * `totalsByRange.count`, que es facturación y las excluye — usarlo dejaría
   * la última página de la paginación fuera de alcance.
   */
  countByRange(range: DateRange, filter?: SalesFilter): Promise<number>;
  getWithItems(id: string): Promise<SaleWithItems | null>;
  voidSale(id: string, reason?: string): Promise<void>;
  /**
   * Total y cantidad de ventas NO anuladas del rango. Es FACTURACIÓN: una
   * venta fiada cuenta acá aunque todavía no haya entrado la plata. Para lo
   * efectivamente cobrado, ver `closingByCashier`.
   */
  totalsByRange(range: DateRange, filter?: SalesFilter): Promise<{ count: number; totalCents: number }>;
  /** Ranking por facturación; `categoryId` filtra por la categoría ACTUAL del producto. */
  topProducts(range: DateRange, opts?: { categoryId?: string; limit?: number }): Promise<TopProduct[]>;
  /**
   * Cómo se saldó cada venta, agrupado por medio. INCLUYE una fila `credit`
   * (fiado), así que NO es "plata cobrada": para separarlas usá
   * `isCashInMethod` del dominio.
   */
  paymentBreakdown(range: DateRange, filter?: SalesFilter): Promise<PaymentBreakdownEntry[]>;
  /** Todas las ventas del rango + sus items en filas planas (para exportar). */
  listForExport(range: DateRange, filter?: SalesFilter): Promise<SalesExport>;
  /** Cierre de caja: qué facturó y qué plata recibió realmente cada cajero. */
  closingByCashier(range: DateRange): Promise<CashierClosingEntry[]>;
}

export function createSalesRepo(driver: SqlDriver, ctx: RepoContext): SalesRepo {
  async function loadWithItems(id: string): Promise<SaleWithItems | null> {
    // Los JOIN resuelven cajero y cliente en la misma fila: el ticket y el
    // detalle no pagan consultas extra por nombre.
    const sales = await driver.select<SaleRow & {
      cashier_name: string | null;
      customer_name: string | null;
    }>(
      `SELECT s.id, s.total_cents, s.voided_at, s.void_reason, s.created_at,
              s.cashier_id, s.customer_id,
              k.name AS cashier_name, c.name AS customer_name
       FROM sales s
       LEFT JOIN cashiers k ON k.id = s.cashier_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ?`,
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
      cashierName: sales[0].cashier_name,
      customerName: sales[0].customer_name,
    };
  }

  return {
    async registerSale(input) {
      if (input.lines.length === 0) throw new Error("La venta no tiene items");
      if (input.lines.some((l) => !Number.isInteger(l.qty) || l.qty <= 0)) {
        throw new Error("Cantidad inválida en la venta");
      }
      if (input.payments.length === 0) throw new Error("La venta no tiene pago");

      // Fiado: se valida ANTES de abrir la transacción (falla barato).
      const creditPayments = input.payments.filter((p) => p.method === "credit");
      const creditCents = creditPayments.reduce((sum, p) => sum + p.amountCents, 0);
      if (creditPayments.length > 1) {
        throw new Error("Una venta admite un solo pago fiado");
      }
      if (creditCents > 0 && !input.customerId) {
        throw new Error("Una venta fiada necesita un cliente");
      }

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

        // Cajero y cliente se validan con SELECT explícito, no confiando en
        // la FK: el driver de escritorio usa un pool de sqlx y no garantiza
        // `PRAGMA foreign_keys` en todas las conexiones.
        if (input.cashierId) {
          const found = await tx.select<{ id: string }>(
            "SELECT id FROM cashiers WHERE id = ? AND deleted_at IS NULL",
            [input.cashierId],
          );
          if (!found[0]) throw new Error("Cajero inexistente");
        }
        if (input.customerId) await assertCustomerExists(tx, input.customerId);

        const now = ctx.now();
        await tx.execute(
          `INSERT INTO sales (id, tenant_id, total_cents, created_at, updated_at, device_id,
             cashier_id, customer_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleId, ctx.tenantId, totalCents, now, now, ctx.deviceId,
            input.cashierId ?? null, input.customerId ?? null,
          ],
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

        // La deuda entra en la MISMA transacción que la venta: o quedan las
        // dos cosas, o no queda ninguna. Nunca una venta fiada sin deuda.
        // En una venta mixta solo va a la cuenta la parte fiada.
        if (creditCents > 0) {
          await insertAccountMovement(tx, ctx, {
            customerId: input.customerId!,
            deltaCents: creditCents, // positivo: AUMENTA la deuda
            type: "credit_sale",
            saleId,
            method: null,
            cashierId: input.cashierId ?? null,
            note: null,
          });
        }
      });

      const sale = await loadWithItems(saleId);
      if (!sale) throw new Error("La venta recién registrada no se pudo releer");
      return sale;
    },

    async listByRange(range, limit = 100, offset = 0, filter) {
      const f = buildSalesFilter(filter, "sales");
      const rows = await driver.select<SaleRow>(
        `SELECT ${SALE_COLUMNS} FROM sales
         WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${f.sql}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [range.from, range.to, ...f.params, limit, offset],
      );
      return rows.map(mapSale);
    },

    async countByRange(range, filter) {
      // Mismo WHERE que `listByRange`, anuladas incluidas.
      const f = buildSalesFilter(filter, "sales");
      const rows = await driver.select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sales
         WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? ${f.sql}`,
        [range.from, range.to, ...f.params],
      );
      return rows[0]?.n ?? 0;
    },

    getWithItems: loadWithItems,

    async voidSale(id, reason) {
      await driver.transaction(async (tx) => {
        const rows = await tx.select<SaleRow>(
          `SELECT ${SALE_COLUMNS} FROM sales WHERE id = ? AND deleted_at IS NULL`,
          [id],
        );
        if (!rows[0]) throw new Error("Venta inexistente");
        if (rows[0].voided_at) throw new Error("La venta ya está anulada");
        const sale = rows[0];

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

        // Si fue fiada, la deuda también se revierte. `void_reversal` y no
        // `adjustment` a propósito: un ajuste es una corrección manual del
        // kiosquero ("te perdono $500") y confundirlos haría ilegible el
        // historial de la cuenta. Es el mismo nombre que usa el ledger de
        // stock para lo mismo.
        if (sale.customer_id) {
          const credit = await tx.select<{ credit: number }>(
            `SELECT COALESCE(SUM(amount_cents), 0) AS credit FROM sale_payments
             WHERE sale_id = ? AND method = 'credit' AND deleted_at IS NULL`,
            [id],
          );
          const creditCents = credit[0]?.credit ?? 0;
          if (creditCents > 0) {
            await insertAccountMovement(tx, ctx, {
              customerId: sale.customer_id,
              deltaCents: -creditCents, // negativo: BAJA la deuda
              type: "void_reversal",
              saleId: id,
              method: null,
              cashierId: null,
              note: null,
            });
          }
        }
      });
    },

    async totalsByRange(range, filter) {
      const f = buildSalesFilter(filter, "sales");
      const rows = await driver.select<{ count: number; total: number | null }>(
        `SELECT COUNT(*) AS count, SUM(total_cents) AS total FROM sales
         WHERE deleted_at IS NULL AND voided_at IS NULL AND created_at >= ? AND created_at < ? ${f.sql}`,
        [range.from, range.to, ...f.params],
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

    async paymentBreakdown(range, filter) {
      const f = buildSalesFilter(filter, "s");
      const rows = await driver.select<{ method: PaymentMethod; total_cents: number }>(
        `SELECT sp.method AS method, SUM(sp.amount_cents) AS total_cents
         FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
         WHERE s.deleted_at IS NULL AND s.voided_at IS NULL AND sp.deleted_at IS NULL
           AND s.created_at >= ? AND s.created_at < ? ${f.sql}
         GROUP BY sp.method
         ORDER BY total_cents DESC`,
        [range.from, range.to, ...f.params],
      );
      return rows.map((r): PaymentBreakdownEntry => ({ method: r.method, totalCents: r.total_cents }));
    },

    async listForExport(range, filter) {
      const f = buildSalesFilter(filter, "s");

      const saleRows = await driver.select<SaleRow & {
        cashier_name: string | null;
        customer_name: string | null;
      }>(
        `SELECT s.id, s.total_cents, s.voided_at, s.void_reason, s.created_at,
                s.cashier_id, s.customer_id,
                k.name AS cashier_name, c.name AS customer_name
         FROM sales s
         LEFT JOIN cashiers k ON k.id = s.cashier_id
         LEFT JOIN customers c ON c.id = s.customer_id
         WHERE s.deleted_at IS NULL AND s.created_at >= ? AND s.created_at < ? ${f.sql}
         ORDER BY s.created_at ASC`,
        [range.from, range.to, ...f.params],
      );

      const itemRows = await driver.select<{
        sale_id: string;
        sale_created_at: string;
        sale_voided_at: string | null;
        product_name: string;
        unit_price_cents: number;
        qty: number;
      }>(
        `SELECT si.sale_id AS sale_id, s.created_at AS sale_created_at, s.voided_at AS sale_voided_at,
                si.product_name AS product_name, si.unit_price_cents AS unit_price_cents, si.qty AS qty
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.deleted_at IS NULL AND si.deleted_at IS NULL
           AND s.created_at >= ? AND s.created_at < ? ${f.sql}
         ORDER BY s.created_at ASC`,
        [range.from, range.to, ...f.params],
      );

      // Nombres resueltos por el JOIN, para no re-consultar por fila al exportar.
      const namesBySale = new Map(
        saleRows.map((r) => [r.id, { cashier: r.cashier_name, customer: r.customer_name }]),
      );

      return {
        sales: saleRows.map(mapSale),
        cashierNames: namesBySale,
        items: itemRows.map((r): SaleExportItem => ({
          saleId: r.sale_id,
          saleCreatedAt: r.sale_created_at,
          saleVoidedAt: r.sale_voided_at,
          productName: r.product_name,
          qty: r.qty,
          unitPriceCents: r.unit_price_cents,
          subtotalCents: r.unit_price_cents * r.qty,
        })),
      };
    },

    async closingByCashier(range) {
      // Tres consultas y merge en JS (son ≤ cajeros × 5 filas), no un UNION:
      // facturar y cobrar son cosas distintas y así se lee cuál es cuál.
      //
      // Q0 — facturación y cantidad de ventas, por cajero. Va aparte de Q1
      // a propósito: agrupando por medio, una venta con pago mixto caería en
      // dos grupos y el conteo saldría inflado.
      // El JOIN a `cashiers` NO filtra `deleted_at`: las ventas de un cajero
      // dado de baja siguen siendo plata que pasó por la caja y tienen que
      // aparecer. Lo que sí se trae es la marca, para que la UI las
      // distinga de las de un cajero activo con el mismo nombre.
      const totalsRows = await driver.select<{
        cashier_id: string | null;
        cashier_name: string | null;
        cashier_deleted: number;
        total: number;
        sale_count: number;
      }>(
        `SELECT s.cashier_id AS cashier_id, k.name AS cashier_name,
                (k.deleted_at IS NOT NULL) AS cashier_deleted,
                SUM(s.total_cents) AS total, COUNT(*) AS sale_count
         FROM sales s
         LEFT JOIN cashiers k ON k.id = s.cashier_id
         WHERE s.deleted_at IS NULL AND s.voided_at IS NULL
           AND s.created_at >= ? AND s.created_at < ?
         GROUP BY s.cashier_id`,
        [range.from, range.to],
      );

      // Q1 — cómo se saldó cada venta del período, por cajero y medio.
      const salesRows = await driver.select<{
        cashier_id: string | null;
        cashier_name: string | null;
        method: PaymentMethod;
        total: number;
      }>(
        `SELECT s.cashier_id AS cashier_id, k.name AS cashier_name, sp.method AS method,
                SUM(sp.amount_cents) AS total
         FROM sale_payments sp
         JOIN sales s ON s.id = sp.sale_id
         LEFT JOIN cashiers k ON k.id = s.cashier_id
         WHERE s.deleted_at IS NULL AND s.voided_at IS NULL AND sp.deleted_at IS NULL
           AND s.created_at >= ? AND s.created_at < ?
         GROUP BY s.cashier_id, sp.method`,
        [range.from, range.to],
      );

      // Q2 — cobros de deuda vieja: entra plata sin facturar nada nuevo.
      const debtRows = await driver.select<{
        cashier_id: string | null;
        cashier_name: string | null;
        method: PaymentMethod | null;
        total: number;
      }>(
        `SELECT m.cashier_id AS cashier_id, k.name AS cashier_name, m.method AS method,
                SUM(-m.delta_cents) AS total
         FROM customer_account_movements m
         LEFT JOIN cashiers k ON k.id = m.cashier_id
         WHERE m.deleted_at IS NULL AND m.type = 'payment'
           AND m.created_at >= ? AND m.created_at < ?
         GROUP BY m.cashier_id, m.method`,
        [range.from, range.to],
      );

      const byCashier = new Map<string, CashierClosingEntry>();
      const entryFor = (id: string | null, name: string | null): CashierClosingEntry => {
        const key = id ?? "";
        let entry = byCashier.get(key);
        if (!entry) {
          entry = {
            cashierId: id, cashierName: name, cashierDeleted: false,
            saleCount: 0, salesTotalCents: 0,
            creditGivenCents: 0, debtCollectedCents: 0,
            collectedByMethod: [], collectedTotalCents: 0,
          };
          byCashier.set(key, entry);
        }
        return entry;
      };
      const addCollected = (entry: CashierClosingEntry, method: PaymentMethod, cents: number) => {
        const found = entry.collectedByMethod.find((m) => m.method === method);
        if (found) found.totalCents += cents;
        else entry.collectedByMethod.push({ method, totalCents: cents });
        entry.collectedTotalCents += cents;
      };

      for (const row of totalsRows) {
        const entry = entryFor(row.cashier_id, row.cashier_name);
        // SQLite devuelve los booleanos como 0/1.
        entry.cashierDeleted = row.cashier_deleted === 1;
        entry.salesTotalCents += row.total;
        entry.saleCount += row.sale_count;
      }
      for (const row of salesRows) {
        const entry = entryFor(row.cashier_id, row.cashier_name);
        if (row.method === "credit") {
          // Fiar factura pero NO entra plata al cajón.
          entry.creditGivenCents += row.total;
        } else {
          addCollected(entry, row.method, row.total);
        }
      }
      for (const row of debtRows) {
        const entry = entryFor(row.cashier_id, row.cashier_name);
        entry.debtCollectedCents += row.total;
        // `method` puede ser NULL en datos viejos: se cuenta como efectivo.
        addCollected(entry, row.method ?? "cash", row.total);
      }

      return [...byCashier.values()].sort((a, b) => b.collectedTotalCents - a.collectedTotalCents);
    },
  };
}
