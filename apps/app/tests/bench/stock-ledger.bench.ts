/**
 * Riesgo #3 del plan: ¿aguanta la agregación del ledger con años de datos?
 * Volumen simulado: 1.000.000 de movimientos sobre 500 productos
 * (~200 ventas/día ≈ 150k movimientos/año → esto es ~6-7 años de kiosco).
 */
import { bench, describe } from "vitest";
import { createTestDriver } from "../integration/test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { createTestContext } from "../integration/test-driver";
import { createRepositories } from "../../src/data/repos";

const PRODUCTS = 500;
const MOVEMENTS = 1_000_000;

const driver = createTestDriver();
await runMigrations(driver);
const repos = createRepositories(driver, createTestContext());

// Seed masivo por better-sqlite3 directo: no es lo que medimos.
{
  const now = new Date().toISOString();
  const insertProduct = driver.raw.prepare(
    `INSERT INTO products (id, tenant_id, name, price_cents, created_at, updated_at, device_id)
     VALUES (?, 't', ?, 100, ?, ?, 'd')`,
  );
  const insertMovement = driver.raw.prepare(
    `INSERT INTO stock_movements (id, tenant_id, product_id, qty_delta, type, created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, ?, ?, ?, 'd')`,
  );
  driver.raw.transaction(() => {
    for (let p = 0; p < PRODUCTS; p++) {
      insertProduct.run(`p-${p}`, `Producto ${p}`, now, now);
    }
    for (let m = 0; m < MOVEMENTS; m++) {
      const productId = `p-${m % PRODUCTS}`;
      const isSale = m % 10 !== 0;
      insertMovement.run(
        `m-${m}`, productId, isSale ? -1 : 12, isSale ? "sale" : "restock", now, now,
      );
    }
  })();
}

describe(`ledger con ${MOVEMENTS.toLocaleString("es-AR")} movimientos`, () => {
  bench("current_stock completo (pantalla de stock)", async () => {
    await repos.stock.levels();
  });

  bench("current_stock de UN producto (fila de venta)", async () => {
    await repos.stock.levelFor("p-42");
  });

  bench("levelsFor de una página de 20 productos (Productos/Stock paginados)", async () => {
    await repos.stock.levelsFor(Array.from({ length: 20 }, (_, i) => `p-${i}`));
  });

  bench("totales del día (ventas de hoy)", async () => {
    await repos.sales.totalsByRange({ from: "2000-01-01", to: "2100-01-01" });
  });
});
