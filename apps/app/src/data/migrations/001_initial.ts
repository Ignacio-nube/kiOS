/**
 * Esquema inicial, sync-ready desde el día uno:
 * 1. Stock por LEDGER append-only (stock_movements), nunca columna mutable.
 * 2. PKs TEXT = UUIDv7 generados en cliente.
 * 3. Borrado lógico con deleted_at; jamás DELETE físico.
 * 4. tenant_id en toda tabla (localmente vale siempre lo mismo).
 * 5. created_at / updated_at / device_id en toda tabla.
 * Además: los HECHOS (ventas, items, pagos, movimientos) son inmutables —
 * única transición permitida: sales.voided_at NULL→valor. `barcode` sin
 * UNIQUE duro (unicidad blanda, se valida en dominio: dos terminales
 * offline podrían chocar al mergear en fase 2).
 *
 * La tabla `outbox` NO existe: la agrega la migración de fase 2.
 */
import type { Migration } from "./types";

export const migration001: Migration = {
  version: 1,
  name: "initial",
  statements: [
    `CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,

    `CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,

    `CREATE TABLE products (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      cost_cents INTEGER CHECK (cost_cents IS NULL OR cost_cents >= 0),
      category_id TEXT REFERENCES categories(id),
      low_stock_threshold INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_products_barcode ON products(barcode) WHERE deleted_at IS NULL`,
    `CREATE INDEX idx_products_name ON products(name) WHERE deleted_at IS NULL`,

    `CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      qty_delta INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('sale','restock','adjustment','shrinkage','initial','void_reversal')),
      sale_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    // Cubriente y parcial: current_stock (SUM por producto, sin borrados)
    // se resuelve solo con el índice, sin tocar la tabla.
    `CREATE INDEX idx_stock_product ON stock_movements(product_id, qty_delta) WHERE deleted_at IS NULL`,

    `CREATE VIEW current_stock AS
      SELECT product_id, SUM(qty_delta) AS qty
      FROM stock_movements
      WHERE deleted_at IS NULL
      GROUP BY product_id`,

    `CREATE TABLE sales (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
      voided_at TEXT,
      void_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_sales_created ON sales(created_at)`,

    `CREATE TABLE sale_items (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
      cost_cents INTEGER,
      qty INTEGER NOT NULL CHECK (qty > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_sale_items_sale ON sale_items(sale_id)`,

    `CREATE TABLE sale_payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      method TEXT NOT NULL CHECK (method IN ('cash','card','qr','transfer')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id)`,

    `CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,

    `CREATE TABLE customer_account_movements (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      delta_cents INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('credit_sale','payment','adjustment')),
      sale_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `CREATE INDEX idx_customer_movements_customer ON customer_account_movements(customer_id)`,
  ],
};
