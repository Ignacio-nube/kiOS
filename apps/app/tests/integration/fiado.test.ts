/**
 * Cuenta corriente (fiado) y cajeros, contra SQLite real con FKs activas.
 *
 * El foco está en la ATOMICIDAD: una venta fiada tiene que dejar la venta y
 * la deuda, o no dejar nada. Y en que el límite de crédito jamás bloquee.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTestContext, createTestDriver, type TestDriver } from "./test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { createRepositories, type Repositories } from "../../src/data/repos";

let driver: TestDriver;
let repos: Repositories;

beforeEach(async () => {
  driver = createTestDriver();
  await runMigrations(driver);
  repos = createRepositories(driver, createTestContext());
});

function countRows(table: string): number {
  return (driver.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("cajeros", () => {
  it("ensureDefault crea el principal con el nombre del negocio y es idempotente", async () => {
    const first = await repos.cashiers.ensureDefault("Kiosco La Esquina");
    expect(first.name).toBe("Kiosco La Esquina");

    // Segundo llamado (StrictMode monta doble): no debe crear otro.
    const second = await repos.cashiers.ensureDefault("Kiosco La Esquina");
    expect(second.id).toBe(first.id);
    expect(await repos.cashiers.list()).toHaveLength(1);
  });

  it("cae a Principal si el negocio no tiene nombre", async () => {
    const c = await repos.cashiers.ensureDefault("   ");
    expect(c.name).toBe("Principal");
  });

  it("no deja dar de baja al último cajero: nunca sin caja", async () => {
    const solo = await repos.cashiers.ensureDefault("Kiosco");
    await expect(repos.cashiers.softDelete(solo.id)).rejects.toThrow(/al menos un cajero/);

    // Con un segundo, sí se puede dar de baja al primero.
    await repos.cashiers.create({ name: "Rocío" });
    await repos.cashiers.softDelete(solo.id);
    expect((await repos.cashiers.list()).map((c) => c.name)).toEqual(["Rocío"]);
  });

  it("rechaza nombres vacíos", async () => {
    await expect(repos.cashiers.create({ name: "   " })).rejects.toThrow();
  });
});

describe("fiado", () => {
  async function setup() {
    const cajero = await repos.cashiers.ensureDefault("Kiosco");
    const cliente = await repos.customers.create({ name: "Vecino", creditLimitCents: 500000 });
    const producto = await repos.products.create({
      name: "Alfajor", priceCents: 120000, initialStock: 50,
    });
    return { cajero, cliente, producto };
  }

  it("la venta fiada y la deuda entran en la MISMA transacción", async () => {
    const { cajero, cliente, producto } = await setup();

    const sale = await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "credit", amountCents: 240000 }],
      cashierId: cajero.id,
      customerId: cliente.id,
    });

    expect(sale.customerId).toBe(cliente.id);
    expect(sale.cashierId).toBe(cajero.id);
    expect(sale.customerName).toBe("Vecino");
    expect(sale.cashierName).toBe("Kiosco");
    expect(await repos.customers.balanceFor(cliente.id)).toBe(240000);

    const movs = await repos.customers.movementsFor(cliente.id);
    expect(movs).toHaveLength(1);
    expect(movs[0]!.type).toBe("credit_sale");
    expect(movs[0]!.deltaCents).toBe(240000); // positivo = debe
    expect(movs[0]!.saleId).toBe(sale.id);

    // El stock se descuenta igual que en cualquier venta.
    expect(await repos.stock.levelFor(producto.id)).toBe(48);
  });

  it("fiar sin cliente se rechaza y NO deja nada a medias", async () => {
    const { producto } = await setup();

    await expect(
      repos.sales.registerSale({
        lines: [{ productId: producto.id, qty: 1 }],
        payments: [{ method: "credit", amountCents: 120000 }],
      }),
    ).rejects.toThrow(/necesita un cliente/);

    expect(countRows("sales")).toBe(0);
    expect(countRows("customer_account_movements")).toBe(0);
    expect(await repos.stock.levelFor(producto.id)).toBe(50); // stock intacto
  });

  it("rechaza cajero y cliente inexistentes sin dejar rastro", async () => {
    const { cliente, producto } = await setup();

    await expect(
      repos.sales.registerSale({
        lines: [{ productId: producto.id, qty: 1 }],
        payments: [{ method: "cash", amountCents: 120000 }],
        cashierId: "no-existe",
      }),
    ).rejects.toThrow(/Cajero inexistente/);

    await expect(
      repos.sales.registerSale({
        lines: [{ productId: producto.id, qty: 1 }],
        payments: [{ method: "credit", amountCents: 120000 }],
        customerId: "no-existe",
      }),
    ).rejects.toThrow(/Cliente inexistente/);

    expect(countRows("sales")).toBe(0);
    expect(await repos.customers.balanceFor(cliente.id)).toBe(0);
  });

  it("rechaza más de un pago fiado en la misma venta", async () => {
    const { cliente, producto } = await setup();
    await expect(
      repos.sales.registerSale({
        lines: [{ productId: producto.id, qty: 2 }],
        payments: [
          { method: "credit", amountCents: 100000 },
          { method: "credit", amountCents: 140000 },
        ],
        customerId: cliente.id,
      }),
    ).rejects.toThrow(/un solo pago fiado/);
  });

  it("venta mixta: a la cuenta va SOLO la parte fiada", async () => {
    const { cliente, producto } = await setup();

    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 3 }], // 360.000
      payments: [
        { method: "cash", amountCents: 100000 },
        { method: "credit", amountCents: 260000 },
      ],
      customerId: cliente.id,
    });

    expect(await repos.customers.balanceFor(cliente.id)).toBe(260000);
  });

  it("anular una venta fiada devuelve la deuda con void_reversal", async () => {
    const { cliente, producto } = await setup();

    const sale = await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "credit", amountCents: 240000 }],
      customerId: cliente.id,
    });
    expect(await repos.customers.balanceFor(cliente.id)).toBe(240000);

    await repos.sales.voidSale(sale.id);
    expect(await repos.customers.balanceFor(cliente.id)).toBe(0);

    const movs = await repos.customers.movementsFor(cliente.id);
    expect(movs.map((m) => m.type)).toContain("void_reversal");
    // NO se usa adjustment: un ajuste es una corrección manual del kiosquero
    // y confundirlos haría ilegible el historial de la cuenta.
    expect(movs.map((m) => m.type)).not.toContain("adjustment");
  });

  it("anular una venta al contado no toca ninguna cuenta", async () => {
    const { cliente, producto } = await setup();
    const sale = await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "cash", amountCents: 120000 }],
      customerId: cliente.id, // cliente asociado, pero pagó al contado
    });
    await repos.sales.voidSale(sale.id);
    expect(await repos.customers.movementsFor(cliente.id)).toHaveLength(0);
  });

  it("registerPayment baja la deuda y pagar de más deja saldo a favor", async () => {
    const { cajero, cliente, producto } = await setup();
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "credit", amountCents: 240000 }],
      customerId: cliente.id,
    });

    await repos.customers.registerPayment({
      customerId: cliente.id, amountCents: 100000, method: "cash", cashierId: cajero.id,
    });
    expect(await repos.customers.balanceFor(cliente.id)).toBe(140000);

    await repos.customers.registerPayment({
      customerId: cliente.id, amountCents: 200000, method: "transfer",
    });
    expect(await repos.customers.balanceFor(cliente.id)).toBe(-60000); // a favor
  });

  it("el límite de crédito NUNCA bloquea una venta", async () => {
    const { cliente, producto } = await setup(); // límite 5.000

    // Se lleva 12.000 fiado: más del doble del límite.
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 10 }],
      payments: [{ method: "credit", amountCents: 1200000 }],
      customerId: cliente.id,
    });

    expect(await repos.customers.balanceFor(cliente.id)).toBe(1200000);
  });

  it("balancesFor trae solo los pedidos y [] con lista vacía", async () => {
    const { cliente, producto } = await setup();
    const otro = await repos.customers.create({ name: "Otro" });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "credit", amountCents: 120000 }],
      customerId: cliente.id,
    });

    expect(await repos.customers.balancesFor([])).toEqual([]);
    expect(await repos.customers.balancesFor([cliente.id])).toEqual([
      { customerId: cliente.id, balanceCents: 120000 },
    ]);
    // `otro` no tiene movimientos: no aparece (no es una fila en cero).
    expect(await repos.customers.balancesFor([cliente.id, otro.id])).toHaveLength(1);
  });

  it("listDebtors y totalDebt solo cuentan a los que deben", async () => {
    const { cliente, producto } = await setup();
    const alDia = await repos.customers.create({ name: "Al día" });

    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "credit", amountCents: 120000 }],
      customerId: cliente.id,
    });
    // Este fía y paga todo: queda en cero, no es deudor.
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "credit", amountCents: 120000 }],
      customerId: alDia.id,
    });
    await repos.customers.registerPayment({
      customerId: alDia.id, amountCents: 120000, method: "cash",
    });

    expect((await repos.customers.listDebtors()).map((d) => d.name)).toEqual(["Vecino"]);
    expect(await repos.customers.totalDebt()).toEqual({ debtors: 1, totalCents: 120000 });
  });

  it("registerAdjustment corrige el saldo y exige un motivo", async () => {
    const { cliente } = await setup();
    await expect(
      repos.customers.registerAdjustment({ customerId: cliente.id, deltaCents: -1000, note: "  " }),
    ).rejects.toThrow(/motivo/);

    await repos.customers.registerAdjustment({
      customerId: cliente.id, deltaCents: -50000, note: "Le perdono el resto",
    });
    expect(await repos.customers.balanceFor(cliente.id)).toBe(-50000);
  });

  it("dar de baja un cliente NO borra su deuda", async () => {
    const { cliente, producto } = await setup();
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "credit", amountCents: 120000 }],
      customerId: cliente.id,
    });
    await repos.customers.softDelete(cliente.id);

    // El ledger queda intacto; sale del listado de deudores, no de la historia.
    expect(await repos.customers.balanceFor(cliente.id)).toBe(120000);
    expect(await repos.customers.listDebtors()).toHaveLength(0);
  });

  it("el ledger de cuenta es INMUTABLE: created_at === updated_at siempre", async () => {
    const { cajero, cliente, producto } = await setup();
    const sale = await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "credit", amountCents: 240000 }],
      customerId: cliente.id, cashierId: cajero.id,
    });
    await repos.customers.registerPayment({
      customerId: cliente.id, amountCents: 50000, method: "cash", cashierId: cajero.id,
    });
    await repos.sales.voidSale(sale.id);

    const rows = driver.raw
      .prepare("SELECT created_at, updated_at FROM customer_account_movements")
      .all() as { created_at: string; updated_at: string }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.updated_at).toBe(r.created_at);
  });
});

describe("cierre de caja", () => {
  const RANGE = { from: "2000-01-01", to: "2100-01-01" };

  it("separa lo facturado de la plata que entró al cajón", async () => {
    const ana = await repos.cashiers.create({ name: "Ana" });
    const beto = await repos.cashiers.create({ name: "Beto" });
    const cliente = await repos.customers.create({ name: "Vecino" });
    const producto = await repos.products.create({
      name: "Alfajor", priceCents: 100000, initialStock: 100,
    });

    // Ana: una al contado y una fiada.
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "cash", amountCents: 200000 }],
      cashierId: ana.id,
    });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 3 }],
      payments: [{ method: "credit", amountCents: 300000 }],
      cashierId: ana.id, customerId: cliente.id,
    });
    // Beto cobra parte de esa deuda vieja.
    await repos.customers.registerPayment({
      customerId: cliente.id, amountCents: 120000, method: "cash", cashierId: beto.id,
    });

    const closing = await repos.sales.closingByCashier(RANGE);
    const porAna = closing.find((c) => c.cashierId === ana.id)!;
    const porBeto = closing.find((c) => c.cashierId === beto.id)!;

    // Ana facturó 500.000 pero solo entraron 200.000 al cajón.
    expect(porAna.saleCount).toBe(2);
    expect(porAna.salesTotalCents).toBe(500000);
    expect(porAna.creditGivenCents).toBe(300000);
    expect(porAna.collectedTotalCents).toBe(200000);
    expect(porAna.collectedByMethod).toEqual([{ method: "cash", totalCents: 200000 }]);

    // Beto no vendió nada, pero cobró deuda: esa plata está en su cajón.
    expect(porBeto.saleCount).toBe(0);
    expect(porBeto.debtCollectedCents).toBe(120000);
    expect(porBeto.collectedTotalCents).toBe(120000);
  });

  it("cuenta bien las ventas con pago mixto (no las duplica)", async () => {
    const ana = await repos.cashiers.create({ name: "Ana" });
    const cliente = await repos.customers.create({ name: "Vecino" });
    const producto = await repos.products.create({
      name: "Alfajor", priceCents: 100000, initialStock: 100,
    });

    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 4 }], // 400.000
      payments: [
        { method: "cash", amountCents: 150000 },
        { method: "credit", amountCents: 250000 },
      ],
      cashierId: ana.id, customerId: cliente.id,
    });

    const [porAna] = await repos.sales.closingByCashier(RANGE);
    expect(porAna!.saleCount).toBe(1); // UNA venta, aunque tenga dos pagos
    expect(porAna!.salesTotalCents).toBe(400000);
    expect(porAna!.collectedTotalCents).toBe(150000);
    expect(porAna!.creditGivenCents).toBe(250000);
  });

  it("excluye las ventas anuladas", async () => {
    const ana = await repos.cashiers.create({ name: "Ana" });
    const producto = await repos.products.create({
      name: "Alfajor", priceCents: 100000, initialStock: 10,
    });
    const sale = await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "cash", amountCents: 100000 }],
      cashierId: ana.id,
    });
    await repos.sales.voidSale(sale.id);

    const closing = await repos.sales.closingByCashier(RANGE);
    expect(closing.find((c) => c.cashierId === ana.id)).toBeUndefined();
  });

  it("sigue mostrando al cajero dado de baja, pero MARCADO", async () => {
    // Dos cajeros con el mismo nombre: uno de baja, otro activo. Es el caso
    // real (se dio de baja un duplicado, o entró alguien que se llama igual)
    // y sin la marca el cierre muestra dos bloques idénticos con montos
    // distintos — que se lee como un error de la app, no como dos personas.
    const viejo = await repos.cashiers.create({ name: "Principal" });
    const producto = await repos.products.create({
      name: "Alfajor", priceCents: 100000, initialStock: 10,
    });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "cash", amountCents: 100000 }],
      cashierId: viejo.id,
    });

    const activo = await repos.cashiers.create({ name: "Principal" });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "cash", amountCents: 200000 }],
      cashierId: activo.id,
    });

    await repos.cashiers.softDelete(viejo.id);

    const closing = await repos.sales.closingByCashier(RANGE);
    const deBaja = closing.find((c) => c.cashierId === viejo.id);
    const enActividad = closing.find((c) => c.cashierId === activo.id);

    // La plata del que se fue no desaparece: pasó por la caja igual.
    expect(deBaja?.collectedTotalCents).toBe(100000);
    expect(deBaja?.cashierDeleted).toBe(true);

    expect(enActividad?.collectedTotalCents).toBe(200000);
    expect(enActividad?.cashierDeleted).toBe(false);
  });
});
