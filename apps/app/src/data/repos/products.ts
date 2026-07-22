/**
 * Repositorio de productos y categorías (catálogo: lo único mutable del
 * modelo). Toda escritura estampa tenant/device/timestamps; el borrado es
 * siempre lógico. La base local es single-tenant, así que las lecturas no
 * filtran por tenant_id (la columna existe para el sync de fase 2).
 */
import type { SqlDriver, SqlExecutor } from "../driver";
import type { RepoContext } from "../context";
import type { Category, NewProduct, Product, ProductPatch } from "../types";

interface ProductRow {
  id: string;
  name: string;
  barcode: string | null;
  price_cents: number;
  cost_cents: number | null;
  category_id: string | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const PRODUCT_COLUMNS =
  "id, name, barcode, price_cents, cost_cents, category_id, low_stock_threshold, created_at, updated_at, deleted_at";

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    priceCents: row.price_cents,
    costCents: row.cost_cents,
    categoryId: row.category_id,
    lowStockThreshold: row.low_stock_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface ProductsRepo {
  /** Paginado: nunca trae el catálogo entero a memoria. */
  list(limit?: number, offset?: number): Promise<Product[]>;
  search(term: string, limit?: number, offset?: number): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByBarcode(barcode: string): Promise<Product | null>;
  /** Unicidad BLANDA de barcode: el dominio advierte, no bloquea. */
  findByBarcodeExcluding(barcode: string, excludeId?: string): Promise<Product[]>;
  countActive(): Promise<number>;
  create(input: NewProduct): Promise<Product>;
  update(id: string, patch: ProductPatch): Promise<void>;
  softDelete(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;
  createCategory(name: string): Promise<Category>;
}

export function createProductsRepo(driver: SqlDriver, ctx: RepoContext): ProductsRepo {
  return {
    async list(limit = 50, offset = 0) {
      const rows = await driver.select<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products WHERE deleted_at IS NULL
         ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      return rows.map(mapProduct);
    },

    async search(term, limit = 30, offset = 0) {
      const rows = await driver.select<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products
         WHERE deleted_at IS NULL AND (name LIKE ? COLLATE NOCASE OR barcode = ?)
         ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`,
        [`%${term}%`, term, limit, offset],
      );
      return rows.map(mapProduct);
    },

    async getById(id) {
      const rows = await driver.select<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ?`,
        [id],
      );
      return rows[0] ? mapProduct(rows[0]) : null;
    },

    async getByBarcode(barcode) {
      const rows = await driver.select<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products
         WHERE barcode = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
        [barcode],
      );
      return rows[0] ? mapProduct(rows[0]) : null;
    },

    async findByBarcodeExcluding(barcode, excludeId) {
      const rows = await driver.select<ProductRow>(
        `SELECT ${PRODUCT_COLUMNS} FROM products
         WHERE barcode = ? AND deleted_at IS NULL AND id != ?`,
        [barcode, excludeId ?? ""],
      );
      return rows.map(mapProduct);
    },

    async countActive() {
      const rows = await driver.select<{ n: number }>(
        "SELECT COUNT(*) AS n FROM products WHERE deleted_at IS NULL",
      );
      return rows[0]?.n ?? 0;
    },

    async create(input) {
      const id = ctx.newId();
      const now = ctx.now();
      await driver.transaction(async (tx) => {
        await tx.execute(
          `INSERT INTO products (id, tenant_id, name, barcode, price_cents, cost_cents,
             category_id, low_stock_threshold, created_at, updated_at, device_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, ctx.tenantId, input.name, input.barcode ?? null, input.priceCents,
            input.costCents ?? null, input.categoryId ?? null,
            input.lowStockThreshold ?? null, now, now, ctx.deviceId,
          ],
        );
        if (input.initialStock !== undefined && input.initialStock !== 0) {
          await insertMovement(tx, ctx, {
            productId: id, qtyDelta: input.initialStock, type: "initial", saleId: null, note: null,
          });
        }
      });
      const created = await this.getById(id);
      if (!created) throw new Error("El producto recién creado no se pudo releer");
      return created;
    },

    async update(id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const push = (column: string, value: unknown) => {
        sets.push(`${column} = ?`);
        params.push(value);
      };
      if (patch.name !== undefined) push("name", patch.name);
      if (patch.barcode !== undefined) push("barcode", patch.barcode);
      if (patch.priceCents !== undefined) push("price_cents", patch.priceCents);
      if (patch.costCents !== undefined) push("cost_cents", patch.costCents);
      if (patch.categoryId !== undefined) push("category_id", patch.categoryId);
      if (patch.lowStockThreshold !== undefined) push("low_stock_threshold", patch.lowStockThreshold);
      if (sets.length === 0) return;
      push("updated_at", ctx.now());
      push("device_id", ctx.deviceId);
      params.push(id);
      await driver.execute(
        `UPDATE products SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );
    },

    async softDelete(id) {
      const now = ctx.now();
      await driver.execute(
        "UPDATE products SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL",
        [now, now, ctx.deviceId, id],
      );
    },

    async listCategories() {
      const rows = await driver.select<{ id: string; name: string; sort_order: number }>(
        "SELECT id, name, sort_order FROM categories WHERE deleted_at IS NULL ORDER BY sort_order, name COLLATE NOCASE",
      );
      return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
    },

    async createCategory(name) {
      const id = ctx.newId();
      const now = ctx.now();
      await driver.execute(
        `INSERT INTO categories (id, tenant_id, name, sort_order, created_at, updated_at, device_id)
         VALUES (?, ?, ?, 0, ?, ?, ?)`,
        [id, ctx.tenantId, name, now, now, ctx.deviceId],
      );
      return { id, name, sortOrder: 0 };
    },
  };
}

/** Compartido con SalesRepo/StockRepo: un INSERT en el ledger. */
export async function insertMovement(
  tx: SqlExecutor,
  ctx: RepoContext,
  movement: {
    productId: string;
    qtyDelta: number;
    type: string;
    saleId: string | null;
    note: string | null;
  },
): Promise<void> {
  const now = ctx.now();
  await tx.execute(
    `INSERT INTO stock_movements (id, tenant_id, product_id, qty_delta, type, sale_id, note,
       created_at, updated_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.newId(), ctx.tenantId, movement.productId, movement.qtyDelta, movement.type,
      movement.saleId, movement.note, now, now, ctx.deviceId,
    ],
  );
}
