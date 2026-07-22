/**
 * Repositorio de stock: SOLO inserta movimientos y agrega el ledger.
 * No existe "setear stock": todo cambio es un movimiento con motivo.
 */
import type { SqlDriver } from "../driver";
import type { RepoContext } from "../context";
import type { StockLevel, StockMovement, StockMovementInput } from "../types";
import type { StockMovementType } from "../../domain/stock";
import { insertMovement } from "./products";

export interface StockRepo {
  levels(): Promise<StockLevel[]>;
  /** Solo los productos pedidos (una página): evita agregar la tabla entera. */
  levelsFor(productIds: string[]): Promise<StockLevel[]>;
  levelFor(productId: string): Promise<number>;
  addMovement(input: StockMovementInput): Promise<void>;
  movementsFor(productId: string, limit?: number): Promise<StockMovement[]>;
}

export function createStockRepo(driver: SqlDriver, ctx: RepoContext): StockRepo {
  return {
    async levels() {
      const rows = await driver.select<{ product_id: string; qty: number }>(
        "SELECT product_id, qty FROM current_stock",
      );
      return rows.map((r): StockLevel => ({ productId: r.product_id, qty: r.qty }));
    },

    async levelsFor(productIds) {
      if (productIds.length === 0) return [];
      // Contra stock_movements directo (no la vista): mismo resultado, y
      // el IN + GROUP BY sobre product_id lo resuelve solo el índice
      // cubriente idx_stock_product, sin tocar la tabla.
      const placeholders = productIds.map(() => "?").join(", ");
      const rows = await driver.select<{ product_id: string; qty: number }>(
        `SELECT product_id, SUM(qty_delta) AS qty FROM stock_movements
         WHERE deleted_at IS NULL AND product_id IN (${placeholders})
         GROUP BY product_id`,
        productIds,
      );
      return rows.map((r): StockLevel => ({ productId: r.product_id, qty: r.qty }));
    },

    async levelFor(productId) {
      const rows = await driver.select<{ qty: number | null }>(
        "SELECT qty FROM current_stock WHERE product_id = ?",
        [productId],
      );
      return rows[0]?.qty ?? 0;
    },

    async addMovement(input) {
      if (!Number.isInteger(input.qtyDelta) || input.qtyDelta === 0) {
        throw new Error("El movimiento de stock necesita una cantidad entera distinta de cero");
      }
      await driver.transaction(async (tx) => {
        await insertMovement(tx, ctx, {
          productId: input.productId,
          qtyDelta: input.qtyDelta,
          type: input.type,
          saleId: null,
          note: input.note ?? null,
        });
      });
    },

    async movementsFor(productId, limit = 50) {
      const rows = await driver.select<{
        id: string;
        product_id: string;
        qty_delta: number;
        type: StockMovementType;
        sale_id: string | null;
        note: string | null;
        created_at: string;
      }>(
        `SELECT id, product_id, qty_delta, type, sale_id, note, created_at
         FROM stock_movements WHERE product_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ?`,
        [productId, limit],
      );
      return rows.map((r): StockMovement => ({
        id: r.id,
        productId: r.product_id,
        qtyDelta: r.qty_delta,
        type: r.type,
        saleId: r.sale_id,
        note: r.note,
        createdAt: r.created_at,
      }));
    },
  };
}
