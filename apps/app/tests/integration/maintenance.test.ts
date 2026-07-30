/**
 * El repo de mantenimiento borra DE VERDAD (DELETE, no soft delete), así que
 * se ejercita contra SQLite real con foreign_keys ON: si el orden hijo→padre
 * estuviera mal, estos tests fallan con "FOREIGN KEY constraint failed".
 */
import { describe, expect, it } from "vitest";
import { createTestDriver, createTestContext } from "./test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { createRepositories } from "../../src/data/repos";

async function freshRepos() {
  const driver = createTestDriver();
  await runMigrations(driver);
  return { driver, repos: createRepositories(driver, createTestContext()) };
}

/** Cuenta filas de una tabla sin pasar por los repos. */
function rows(driver: Awaited<ReturnType<typeof freshRepos>>["driver"], table: string): number {
  return (driver.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("mantenimiento", () => {
  it("seedSampleData carga catálogo y ventas coherentes", async () => {
    const { driver, repos } = await freshRepos();

    const result = await repos.maintenance.seedSampleData();
    expect(result.products).toBe(50);
    expect(result.sales).toBeGreaterThan(0);

    const counts = await repos.maintenance.counts();
    expect(counts.products).toBe(50);
    expect(counts.sales).toBe(result.sales);

    // Cada venta tiene al menos un ítem y un pago que iguala su total.
    const orphanSales = driver.raw.prepare(
      `SELECT COUNT(*) AS n FROM sales s
       WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)`,
    ).get() as { n: number };
    expect(orphanSales.n).toBe(0);

    const mismatched = driver.raw.prepare(
      `SELECT COUNT(*) AS n FROM sales s
       WHERE s.total_cents != (
         SELECT COALESCE(SUM(sp.amount_cents), -1) FROM sale_payments sp WHERE sp.sale_id = s.id
       )`,
    ).get() as { n: number };
    expect(mismatched.n).toBe(0);

    // El total de cada venta = suma de sus ítems (precio × cantidad).
    const badTotals = driver.raw.prepare(
      `SELECT COUNT(*) AS n FROM sales s
       WHERE s.total_cents != (
         SELECT COALESCE(SUM(si.unit_price_cents * si.qty), -1)
         FROM sale_items si WHERE si.sale_id = s.id
       )`,
    ).get() as { n: number };
    expect(badTotals.n).toBe(0);

    // El ledger tiene el stock inicial (50) más un movimiento por ítem vendido.
    const items = rows(driver, "sale_items");
    expect(counts.movements).toBe(50 + items);

    // Las ventas caen dentro de los últimos 30 días.
    const oldest = driver.raw.prepare("SELECT MIN(created_at) AS d FROM sales").get() as { d: string };
    const daysAgo = (Date.now() - new Date(oldest.d).getTime()) / 86_400_000;
    expect(daysAgo).toBeLessThan(31);
  });

  it("clearSales borra el historial pero conserva catálogo y stock cargado a mano", async () => {
    const { driver, repos } = await freshRepos();
    await repos.maintenance.seedSampleData();

    // Stock inicial antes de vender (los movimientos `initial` del seed).
    const initialMovements = rows(driver, "stock_movements") - rows(driver, "sale_items");

    await repos.maintenance.clearSales();

    const counts = await repos.maintenance.counts();
    expect(counts.sales).toBe(0);
    expect(counts.products).toBe(50); // el catálogo queda
    expect(rows(driver, "sale_items")).toBe(0);
    expect(rows(driver, "sale_payments")).toBe(0);
    expect(rows(driver, "categories")).toBe(6);

    // Solo se fueron los movimientos de venta: quedan los `initial`.
    expect(counts.movements).toBe(initialMovements);
    const leftoverSaleMoves = driver.raw.prepare(
      "SELECT COUNT(*) AS n FROM stock_movements WHERE type IN ('sale', 'void_reversal')",
    ).get() as { n: number };
    expect(leftoverSaleMoves.n).toBe(0);
  });

  it("resetAll vacía el negocio pero conserva meta (licencia e identidad)", async () => {
    const { driver, repos } = await freshRepos();
    await repos.maintenance.seedSampleData();
    await repos.meta.set("license_key", "KIOS-TEST");

    await repos.maintenance.resetAll();

    const counts = await repos.maintenance.counts();
    expect(counts).toEqual({ products: 0, sales: 0, movements: 0, customers: 0, debtCents: 0 });
    expect(rows(driver, "sale_items")).toBe(0);
    expect(rows(driver, "sale_payments")).toBe(0);
    expect(rows(driver, "categories")).toBe(0);
    // Cajeros y deudas también se van: "como recién instalada".
    expect(rows(driver, "cashiers")).toBe(0);
    expect(rows(driver, "customer_account_movements")).toBe(0);

    // meta sobrevive: la licencia sigue activada tras restablecer.
    expect(await repos.meta.get("license_key")).toBe("KIOS-TEST");
  });

  it("la app sigue usable después de restablecer (se puede vender de nuevo)", async () => {
    const { repos } = await freshRepos();
    await repos.maintenance.seedSampleData();
    await repos.maintenance.resetAll();

    const product = await repos.products.create({
      name: "Alfajor", priceCents: 120000, initialStock: 10,
    });
    const sale = await repos.sales.registerSale({
      lines: [{ productId: product.id, qty: 2 }],
      payments: [{ method: "cash", amountCents: 240000 }],
    });

    expect(sale.totalCents).toBe(240000);
    expect(await repos.stock.levelFor(product.id)).toBe(8);
  });
});

describe("datos de ejemplo: cajeros y fiado", () => {
  it("siembra cajeros, clientes y ventas fiadas coherentes", async () => {
    const { driver, repos } = await freshRepos();
    await repos.meta.set("business_name", "Kiosco La Esquina");

    const result = await repos.maintenance.seedSampleData();
    expect(result.cashiers).toBe(3);
    expect(result.customers).toBe(12);

    // El cajero principal se llama como el negocio.
    const cashiers = await repos.cashiers.list();
    expect(cashiers.map((c) => c.name)).toContain("Kiosco La Esquina");

    // Toda venta tiene cajero.
    const sinCajero = driver.raw
      .prepare("SELECT COUNT(*) AS n FROM sales WHERE cashier_id IS NULL")
      .get() as { n: number };
    expect(sinCajero.n).toBe(0);

    // Hay ventas fiadas, y CADA UNA tiene su movimiento de cuenta por el
    // total exacto de la venta (la invariante de registerSale).
    const fiadas = driver.raw
      .prepare("SELECT id, total_cents, customer_id FROM sales WHERE customer_id IS NOT NULL")
      .all() as { id: string; total_cents: number; customer_id: string }[];
    expect(fiadas.length).toBeGreaterThan(0);
    for (const venta of fiadas) {
      const mov = driver.raw
        .prepare("SELECT delta_cents, customer_id FROM customer_account_movements WHERE sale_id = ? AND type = 'credit_sale'")
        .get(venta.id) as { delta_cents: number; customer_id: string };
      expect(mov.delta_cents).toBe(venta.total_cents);
      expect(mov.customer_id).toBe(venta.customer_id);
    }

    // Y toda venta fiada tiene su pago 'credit'.
    const sinPagoCredit = driver.raw.prepare(
      `SELECT COUNT(*) AS n FROM sales s WHERE s.customer_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM sale_payments p WHERE p.sale_id = s.id AND p.method = 'credit')`,
    ).get() as { n: number };
    expect(sinPagoCredit.n).toBe(0);
  });

  it("construye los casos límite: deudores, excedidos y saldo a favor", async () => {
    const { repos } = await freshRepos();
    await repos.maintenance.seedSampleData();

    const deudores = await repos.customers.listDebtors(100);
    expect(deudores.length).toBeGreaterThan(0);

    // Al menos 2 pasados de límite: se construyen, no se dejan al azar.
    const excedidos = deudores.filter(
      (d) => d.creditLimitCents !== null && d.balanceCents >= d.creditLimitCents,
    );
    expect(excedidos.length).toBeGreaterThanOrEqual(2);

    // Y alguien con saldo a favor (pagó de más).
    const todos = await repos.customers.list(100);
    const balances = await repos.customers.balancesFor(todos.map((c) => c.id));
    expect(balances.some((b) => b.balanceCents < 0)).toBe(true);
  });

  it("no duplica el cajero Principal si ya lo creó ensureDefault al arrancar", async () => {
    const { repos } = await freshRepos();
    // Así arranca la app de verdad: ensureDefault corre ANTES de que el
    // usuario llegue al botón "Cargar datos de ejemplo".
    await repos.cashiers.ensureDefault("Kiosco La Esquina");

    const result = await repos.maintenance.seedSampleData();
    // Se suman los 2 nuevos (Rocío, Turno noche) al que ya existía: 3, no 4.
    expect(result.cashiers).toBe(3);

    const cashiers = await repos.cashiers.list();
    expect(cashiers.length).toBe(3);
    expect(cashiers.filter((c) => c.name === "Kiosco La Esquina").length).toBe(1);
  });

  it("clearSales borra las ventas pero NO perdona las deudas", async () => {
    const { driver, repos } = await freshRepos();
    await repos.maintenance.seedSampleData();

    const deudaAntes = await repos.customers.totalDebt();
    expect(deudaAntes.totalCents).toBeGreaterThan(0);
    const movsAntes = rows(driver, "customer_account_movements");

    await repos.maintenance.clearSales();

    // Las ventas se fueron...
    expect(rows(driver, "sales")).toBe(0);
    // ...pero la plata que le deben al kiosquero NO. Esta es la forma
    // ejecutable del argumento: borrar historial ≠ perdonar deudas.
    expect(await repos.customers.totalDebt()).toEqual(deudaAntes);
    expect(rows(driver, "customer_account_movements")).toBe(movsAntes);
    // Los cajeros tampoco se tocan.
    expect(rows(driver, "cashiers")).toBe(3);
  });

  it("se puede seguir fiando y cobrando después de clearSales", async () => {
    const { repos } = await freshRepos();
    await repos.maintenance.seedSampleData();
    await repos.maintenance.clearSales();

    const [cliente] = await repos.customers.listDebtors(1);
    const saldo = cliente!.balanceCents;
    await repos.customers.registerPayment({
      customerId: cliente!.id, amountCents: saldo, method: "cash",
    });
    expect(await repos.customers.balanceFor(cliente!.id)).toBe(0);
  });
});
