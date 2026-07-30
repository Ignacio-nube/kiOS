/**
 * Cajeros + cuentas corrientes (fiado).
 *
 * Dos features en una migración porque comparten columnas: el cobro de una
 * deuda lo recibe un cajero, así que `customer_account_movements` necesita
 * `cashier_id` para que el cierre de caja cuadre.
 *
 * ── Sobre los dos rebuilds de tabla ─────────────────────────────────────
 * SQLite no permite alterar un CHECK, así que `sale_payments` (para sumar
 * 'credit') y `customer_account_movements` (para sumar 'void_reversal') se
 * reconstruyen con la receta CREATE → INSERT SELECT → DROP → RENAME.
 *
 * ⚠ La receta oficial de SQLite exige `PRAGMA foreign_keys = OFF`, y acá NO
 * se puede: el runner corre cada migración dentro de una transacción, y ese
 * PRAGMA es un no-op dentro de una transacción. Es seguro igual, pero por
 * una razón MUY específica: **nadie referencia a estas dos tablas**. Ambas
 * son hojas (solo apuntan hacia afuera). El paso peligroso de la receta es
 * `ALTER TABLE ... RENAME TO`, que en SQLite ≥3.25 reescribe las cláusulas
 * REFERENCES de las tablas que apuntan a la renombrada — como no hay
 * ninguna, no hay nada que reescribir. La FK propia (sale_payments → sales)
 * se re-declara idéntica y se revalida fila por fila en el INSERT…SELECT.
 *
 * ⚠ NO COPIES ESTA RECETA para reconstruir `sales`, `products`, `categories`
 * o `customers`: esas SÍ son padres, y ahí el rebuild dentro de la
 * transacción del runner corrompería las FKs de sus hijos. Ese caso habría
 * que sacarlo fuera de la transacción.
 *
 * Los índices se recrean DESPUÉS del RENAME: el DROP se lleva los viejos, y
 * crearlos antes colisiona por nombre.
 *
 * ── Convención de signo del ledger de cuenta corriente ──────────────────
 * delta_cents > 0 AUMENTA la deuda (credit_sale); < 0 la baja (payment,
 * void_reversal). Saldo positivo = el cliente debe. Es la INVERSA del
 * stock, donde negativo es salida. Ver domain/account.ts.
 */
import type { Migration } from "./types";

export const migration002: Migration = {
  version: 2,
  name: "cashiers_and_credit",
  statements: [
    // ── Cajeros ────────────────────────────────────────────────────────
    // Solo identidad: sin clave, sin rol, sin permisos. Sirve para atribuir
    // ventas y cerrar la caja, no para controlar accesos.
    `CREATE TABLE cashiers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,

    // ADD COLUMN y no rebuild: es O(1) (solo reescribe el schema). Con 100k
    // ventas, reconstruir la tabla dentro de una transacción sería la
    // diferencia entre milisegundos y un arranque congelado.
    // Las columnas con REFERENCES deben quedar en NULL para las filas ya
    // existentes (SQLite lo exige), que es justo lo que queremos: las ventas
    // viejas no tienen cajero ni cliente.
    `ALTER TABLE sales ADD COLUMN cashier_id TEXT REFERENCES cashiers(id)`,
    `ALTER TABLE sales ADD COLUMN customer_id TEXT REFERENCES customers(id)`,
    `CREATE INDEX idx_sales_cashier ON sales(cashier_id, created_at) WHERE deleted_at IS NULL`,

    // ── Límite de fiado (BLANDO: avisa, nunca bloquea) ─────────────────
    `ALTER TABLE customers ADD COLUMN credit_limit_cents INTEGER
       CHECK (credit_limit_cents IS NULL OR credit_limit_cents >= 0)`,
    `CREATE INDEX idx_customers_name ON customers(name) WHERE deleted_at IS NULL`,

    // ── Rebuild de sale_payments: sumar 'credit' al CHECK ──────────────
    `CREATE TABLE sale_payments_new (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      method TEXT NOT NULL CHECK (method IN ('cash','card','qr','transfer','credit')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    // Columnas explícitas, nunca SELECT *: si mañana cambia el orden, esto
    // sigue siendo correcto o falla ruidosamente.
    `INSERT INTO sale_payments_new
       (id, tenant_id, sale_id, method, amount_cents, created_at, updated_at, device_id, deleted_at)
     SELECT
       id, tenant_id, sale_id, method, amount_cents, created_at, updated_at, device_id, deleted_at
     FROM sale_payments`,
    `DROP TABLE sale_payments`,
    `ALTER TABLE sale_payments_new RENAME TO sale_payments`,
    `CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id)`,

    // ── Rebuild de customer_account_movements ──────────────────────────
    // Suma 'void_reversal' al CHECK (anular una venta fiada descuenta de la
    // cuenta; usar 'adjustment' para eso lo haría indistinguible de un
    // perdón de deuda manual) + dos columnas que el cierre de caja necesita.
    // La tabla está VACÍA en toda instalación existente (ningún repo escribió
    // nunca en ella), así que agregarlas ahora sale gratis.
    `CREATE TABLE customer_account_movements_new (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      delta_cents INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('credit_sale','payment','adjustment','void_reversal')),
      sale_id TEXT,
      note TEXT,
      -- Quién recibió la plata del pago de deuda: sin esto, ese efectivo es
      -- invisible en el cierre de caja del cajero que lo cobró.
      cashier_id TEXT REFERENCES cashiers(id),
      -- Cómo pagó la deuda (NULL en credit_sale/void_reversal, que no son cobros).
      method TEXT CHECK (method IS NULL OR method IN ('cash','card','qr','transfer')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      device_id TEXT NOT NULL,
      deleted_at TEXT
    )`,
    `INSERT INTO customer_account_movements_new
       (id, tenant_id, customer_id, delta_cents, type, sale_id, note, created_at, updated_at, device_id, deleted_at)
     SELECT
       id, tenant_id, customer_id, delta_cents, type, sale_id, note, created_at, updated_at, device_id, deleted_at
     FROM customer_account_movements`,
    `DROP TABLE customer_account_movements`,
    `ALTER TABLE customer_account_movements_new RENAME TO customer_account_movements`,

    // Cubriente y parcial, MISMO NOMBRE que el índice de la 001 (que era solo
    // (customer_id)): si conviviesen, el planner elegiría el más angosto y
    // pagaría un lookup a tabla por fila. Espeja idx_stock_product.
    `CREATE INDEX idx_customer_movements_customer
       ON customer_account_movements(customer_id, delta_cents) WHERE deleted_at IS NULL`,
    // Cierre de caja: cobros de deuda de un rango, por cajero y medio.
    `CREATE INDEX idx_customer_payments_created
       ON customer_account_movements(created_at, cashier_id, method, delta_cents)
       WHERE deleted_at IS NULL AND type = 'payment'`,

    // Saldo por cliente = agregación del ledger, jamás una columna mutable.
    // Análoga a current_stock (ADR-004: "el fiado usa el mismo patrón").
    `CREATE VIEW customer_balances AS
      SELECT customer_id, SUM(delta_cents) AS balance_cents
      FROM customer_account_movements
      WHERE deleted_at IS NULL
      GROUP BY customer_id`,
  ],
};
