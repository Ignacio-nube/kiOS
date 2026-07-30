/**
 * Escalabilidad de Reportes: ¿aguantan las consultas y la exportación con
 * años de ventas encima? Volumen simulado de un kiosco activo:
 *   2.000 productos · 100.000 ventas · ~300.000 ítems · ~300.000 movimientos
 * (~200 ventas/día ≈ 1,5 años de operación) repartidas en ~2 años de fechas,
 * para que los rangos ("hoy", "este mes", "todo") filtren de verdad.
 *
 * Mide lo que toca la pantalla de Reportes: agregados, listado paginado y
 * el `listForExport` completo que alimenta el Excel (el caso más pesado,
 * porque materializa TODAS las filas del período).
 */
import { bench, describe } from "vitest";
import { createTestDriver, createTestContext } from "../integration/test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { createRepositories } from "../../src/data/repos";
import type { PaymentMethod } from "../../src/domain/ticket";

const PRODUCTS = 2_000;
const SALES = 100_000;
const METHODS: PaymentMethod[] = ["cash", "card", "qr", "transfer"];

const driver = createTestDriver();
await runMigrations(driver);
const repos = createRepositories(driver, createTestContext());

// Seed masivo por better-sqlite3 directo (no es lo que medimos).
{
  const insertProduct = driver.raw.prepare(
    `INSERT INTO products (id, tenant_id, name, price_cents, cost_cents, created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, ?, ?, ?, 'd')`,
  );
  const insertCashier = driver.raw.prepare(
    `INSERT INTO cashiers (id, tenant_id, name, created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, ?, 'd')`,
  );
  const insertSale = driver.raw.prepare(
    `INSERT INTO sales (id, tenant_id, total_cents, created_at, updated_at, device_id, cashier_id)
     VALUES (?, 't', ?, ?, ?, 'd', ?)`,
  );
  const insertItem = driver.raw.prepare(
    `INSERT INTO sale_items (id, tenant_id, sale_id, product_id, product_name, unit_price_cents, cost_cents, qty, created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, ?, ?, ?, ?, ?, ?, 'd')`,
  );
  const insertPayment = driver.raw.prepare(
    `INSERT INTO sale_payments (id, tenant_id, sale_id, method, amount_cents, created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, ?, ?, ?, 'd')`,
  );
  const insertMovement = driver.raw.prepare(
    `INSERT INTO stock_movements (id, tenant_id, product_id, qty_delta, type, sale_id, created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, 'sale', ?, ?, ?, 'd')`,
  );

  // ~2 años de fechas terminando hoy.
  const end = Date.now();
  const span = 1000 * 60 * 60 * 24 * 730;

  driver.raw.transaction(() => {
    for (let k = 0; k < 3; k++) {
      insertCashier.run(`k-${k}`, `Cajero ${k}`, "2024-01-01", "2024-01-01");
    }
    for (let p = 0; p < PRODUCTS; p++) {
      insertProduct.run(`p-${p}`, `Producto ${p}`, 100 + (p % 900), 50 + (p % 400), "2024-01-01", "2024-01-01");
    }
    for (let s = 0; s < SALES; s++) {
      const when = new Date(end - Math.floor((s / SALES) * span)).toISOString();
      const saleId = `s-${s}`;
      const lineCount = 1 + (s % 4); // 1..4 ítems por venta
      const lines = Array.from({ length: lineCount }, (_, l) => {
        const pi = (s * 7 + l * 13) % PRODUCTS;
        return { l, pi, price: 100 + (pi % 900), qty: 1 + (l % 3) };
      });
      const total = lines.reduce((sum, ln) => sum + ln.price * ln.qty, 0);
      // La venta va PRIMERO: sale_items y stock_movements la referencian (FK).
      insertSale.run(saleId, total, when, when, `k-${s % 3}`);
      for (const ln of lines) {
        insertItem.run(`si-${s}-${ln.l}`, saleId, `p-${ln.pi}`, `Producto ${ln.pi}`, ln.price, 50 + (ln.pi % 400), ln.qty, when, when);
        insertMovement.run(`m-${s}-${ln.l}`, `p-${ln.pi}`, -ln.qty, saleId, when, when);
      }
      insertPayment.run(`pay-${s}`, saleId, METHODS[s % METHODS.length]!, total, when, when);
    }
  })();
}

const ALL_TIME = { from: "2000-01-01", to: "2100-01-01" } as const;

describe(`Reportes con ${SALES.toLocaleString("es-AR")} ventas`, () => {
  bench("totalsByRange (KPIs, todo el histórico)", async () => {
    await repos.sales.totalsByRange(ALL_TIME);
  });

  bench("paymentBreakdown (medios de pago)", async () => {
    await repos.sales.paymentBreakdown(ALL_TIME);
  });

  bench("topProducts limit 100 (más vendidos)", async () => {
    await repos.sales.topProducts(ALL_TIME, { limit: 100 });
  });

  bench("listByRange primera página (20 ventas)", async () => {
    await repos.sales.listByRange(ALL_TIME, 21, 0);
  });

  bench("listByRange filtrada por medio de pago", async () => {
    await repos.sales.listByRange(ALL_TIME, 21, 0, { paymentMethod: "card" });
  });

  bench("listByRange filtrada por cajero", async () => {
    await repos.sales.listByRange(ALL_TIME, 21, 0, { cashierId: "k-1" });
  });

  bench("closingByCashier (cierre de caja)", async () => {
    await repos.sales.closingByCashier(ALL_TIME);
  });

  bench("listForExport TODO el histórico (el Excel más pesado)", async () => {
    await repos.sales.listForExport(ALL_TIME);
  });
});
