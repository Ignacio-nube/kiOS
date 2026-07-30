/**
 * ¿El fiado aguanta el mismo volumen que el stock? ADR-004 dice que "el
 * fiado usa el mismo patrón" (ledger append-only + agregación); esto lo
 * verifica en vez de asumirlo.
 *
 * Volumen: 2.000 clientes con 300.000 movimientos de cuenta — muy por
 * encima de lo que junta un kiosco, que fía a decenas de vecinos.
 */
import { bench, describe } from "vitest";
import { createTestDriver, createTestContext } from "../integration/test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { createRepositories } from "../../src/data/repos";

const CUSTOMERS = 2_000;
const MOVEMENTS = 300_000;

const driver = createTestDriver();
await runMigrations(driver);
const repos = createRepositories(driver, createTestContext());

// Seed masivo directo por better-sqlite3: no es lo que medimos.
{
  const now = new Date().toISOString();
  const insertCustomer = driver.raw.prepare(
    `INSERT INTO customers (id, tenant_id, name, credit_limit_cents, created_at, updated_at, device_id)
     VALUES (?, 't', ?, 500000, ?, ?, 'd')`,
  );
  const insertMovement = driver.raw.prepare(
    `INSERT INTO customer_account_movements (id, tenant_id, customer_id, delta_cents, type,
       created_at, updated_at, device_id)
     VALUES (?, 't', ?, ?, ?, ?, ?, 'd')`,
  );
  driver.raw.transaction(() => {
    for (let c = 0; c < CUSTOMERS; c++) {
      insertCustomer.run(`c-${c}`, `Cliente ${c}`, now, now);
    }
    for (let m = 0; m < MOVEMENTS; m++) {
      const customerId = `c-${m % CUSTOMERS}`;
      // 2 de cada 3 son fiados, 1 es pago: el saldo queda positivo (deben).
      const isCredit = m % 3 !== 0;
      insertMovement.run(
        `am-${m}`, customerId, isCredit ? 1200 : -2000,
        isCredit ? "credit_sale" : "payment", now, now,
      );
    }
  })();
}

describe(`cuenta corriente con ${MOVEMENTS.toLocaleString("es-AR")} movimientos`, () => {
  bench("balanceFor de UN cliente (al fiar en el mostrador)", async () => {
    await repos.customers.balanceFor("c-42");
  });

  bench("balancesFor de una página de 20 (pantalla Clientes)", async () => {
    await repos.customers.balancesFor(Array.from({ length: 20 }, (_, i) => `c-${i}`));
  });

  bench("listDebtors primera página (toggle 'solo los que deben')", async () => {
    await repos.customers.listDebtors(21, 0);
  });

  bench("totalDebt (KPI de cuánto te deben)", async () => {
    await repos.customers.totalDebt();
  });
});
