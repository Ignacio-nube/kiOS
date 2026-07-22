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

async function seedProduct(name: string, priceCents: number, extra?: { barcode?: string; initialStock?: number; costCents?: number }) {
  return repos.products.create({
    name,
    priceCents,
    barcode: extra?.barcode ?? null,
    costCents: extra?.costCents ?? null,
    initialStock: extra?.initialStock,
  });
}

describe("productos", () => {
  it("crea con stock inicial vía ledger y lo agrega en current_stock", async () => {
    const p = await seedProduct("Alfajor Guaymallén", 800, { initialStock: 24 });
    expect(await repos.stock.levelFor(p.id)).toBe(24);
    const movements = await repos.stock.movementsFor(p.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]!.type).toBe("initial");
  });

  it("estampa tenant, device y timestamps en cada fila (reglas 4 y 5)", async () => {
    await seedProduct("Coca 500ml", 1500);
    const row = driver.raw
      .prepare("SELECT tenant_id, device_id, created_at, updated_at, deleted_at FROM products")
      .get() as Record<string, unknown>;
    expect(row.tenant_id).toBe("tenant-test");
    expect(row.device_id).toBe("device-test");
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
    expect(row.deleted_at).toBeNull();
  });

  it("la baja es lógica y no rompe el historial", async () => {
    const p = await seedProduct("Puchos", 3500);
    await repos.products.softDelete(p.id);
    expect(await repos.products.list()).toHaveLength(0);
    expect(await repos.products.getById(p.id)).not.toBeNull(); // sigue existiendo
    const raw = driver.raw.prepare("SELECT COUNT(*) AS n FROM products").get() as { n: number };
    expect(raw.n).toBe(1); // jamás DELETE físico (regla 3)
  });

  it("barcode con unicidad BLANDA: permite duplicados y los reporta", async () => {
    const a = await seedProduct("Agua 1", 1000, { barcode: "779" });
    await seedProduct("Agua 2", 1100, { barcode: "779" });
    const dupes = await repos.products.findByBarcodeExcluding("779", a.id);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.name).toBe("Agua 2");
  });

  it("busca por nombre parcial y por barcode exacto", async () => {
    await seedProduct("Alfajor Jorgito", 900, { barcode: "7791234" });
    expect(await repos.products.search("jorgi")).toHaveLength(1);
    expect(await repos.products.search("7791234")).toHaveLength(1);
    expect(await repos.products.search("nada")).toHaveLength(0);
  });
});

describe("ventas", () => {
  it("registra la venta completa en una transacción: total del server, snapshots y ledger", async () => {
    const alfajor = await seedProduct("Alfajor", 800, { initialStock: 10, costCents: 500 });
    const coca = await seedProduct("Coca", 1500, { initialStock: 6 });

    const sale = await repos.sales.registerSale({
      lines: [
        { productId: alfajor.id, qty: 3 },
        { productId: coca.id, qty: 1 },
      ],
      payments: [{ method: "cash", amountCents: 3900 }],
    });

    expect(sale.totalCents).toBe(3 * 800 + 1500);
    expect(sale.items).toHaveLength(2);
    const itemAlfajor = sale.items.find((i) => i.productId === alfajor.id)!;
    expect(itemAlfajor.productName).toBe("Alfajor"); // snapshot
    expect(itemAlfajor.unitPriceCents).toBe(800);
    expect(itemAlfajor.costCents).toBe(500);
    expect(sale.payments).toEqual([{ method: "cash", amountCents: 3900 }]);

    expect(await repos.stock.levelFor(alfajor.id)).toBe(7);
    expect(await repos.stock.levelFor(coca.id)).toBe(5);
  });

  it("rechaza pagos que no igualan el total y no deja nada a medias", async () => {
    const p = await seedProduct("Chicle", 500, { initialStock: 5 });
    await expect(
      repos.sales.registerSale({
        lines: [{ productId: p.id, qty: 1 }],
        payments: [{ method: "cash", amountCents: 400 }],
      }),
    ).rejects.toThrow(/no igualan/);
    expect(await repos.stock.levelFor(p.id)).toBe(5);
    expect(driver.raw.prepare("SELECT COUNT(*) AS n FROM sales").get()).toEqual({ n: 0 });
  });

  it("editar el producto DESPUÉS no cambia el historial (snapshot)", async () => {
    const p = await seedProduct("Caramelo", 100);
    const sale = await repos.sales.registerSale({
      lines: [{ productId: p.id, qty: 2 }],
      payments: [{ method: "qr", amountCents: 200 }],
    });
    await repos.products.update(p.id, { priceCents: 999, name: "Caramelo caro" });
    const reloaded = await repos.sales.getWithItems(sale.id);
    expect(reloaded!.items[0]!.unitPriceCents).toBe(100);
    expect(reloaded!.items[0]!.productName).toBe("Caramelo");
  });

  it("el stock puede quedar negativo: la venta nunca se bloquea", async () => {
    const p = await seedProduct("Fósforos", 300); // sin stock inicial
    await repos.sales.registerSale({
      lines: [{ productId: p.id, qty: 2 }],
      payments: [{ method: "cash", amountCents: 600 }],
    });
    expect(await repos.stock.levelFor(p.id)).toBe(-2);
  });

  it("anular es una transición única + movimientos compensatorios (regla B)", async () => {
    const p = await seedProduct("Turrón", 400, { initialStock: 8 });
    const sale = await repos.sales.registerSale({
      lines: [{ productId: p.id, qty: 3 }],
      payments: [{ method: "card", amountCents: 1200 }],
    });
    expect(await repos.stock.levelFor(p.id)).toBe(5);

    await repos.sales.voidSale(sale.id, "cliente se arrepintió");
    expect(await repos.stock.levelFor(p.id)).toBe(8); // compensado, no borrado

    const movements = await repos.stock.movementsFor(p.id);
    expect(movements.map((m) => m.type).sort()).toEqual(["initial", "sale", "void_reversal"]);

    await expect(repos.sales.voidSale(sale.id)).rejects.toThrow(/ya está anulada/);

    const voided = await repos.sales.getWithItems(sale.id);
    expect(voided!.voidedAt).toBeTruthy();
    expect(voided!.voidReason).toBe("cliente se arrepintió");
  });

  it("totalsByRange excluye anuladas y respeta el rango [from, to)", async () => {
    const p = await seedProduct("Gaseosa", 1000);
    const s1 = await repos.sales.registerSale({
      lines: [{ productId: p.id, qty: 1 }],
      payments: [{ method: "cash", amountCents: 1000 }],
    });
    await repos.sales.registerSale({
      lines: [{ productId: p.id, qty: 2 }],
      payments: [{ method: "transfer", amountCents: 2000 }],
    });
    await repos.sales.voidSale(s1.id);

    const totals = await repos.sales.totalsByRange({ from: "2000-01-01", to: "2100-01-01" });
    expect(totals).toEqual({ count: 1, totalCents: 2000 });
  });
});

describe("stock", () => {
  it("reposición, merma y ajuste como movimientos del ledger", async () => {
    const p = await seedProduct("Yerba", 5000, { initialStock: 2 });
    await repos.stock.addMovement({ productId: p.id, qtyDelta: 12, type: "restock" });
    await repos.stock.addMovement({ productId: p.id, qtyDelta: -1, type: "shrinkage", note: "vencido" });
    expect(await repos.stock.levelFor(p.id)).toBe(13);
    await expect(
      repos.stock.addMovement({ productId: p.id, qtyDelta: 0, type: "adjustment" }),
    ).rejects.toThrow();
  });
});

describe("meta", () => {
  it("get/set/remove", async () => {
    expect(await repos.meta.get("business_name")).toBeNull();
    await repos.meta.set("business_name", "Kiosco Don Nacho");
    await repos.meta.set("business_name", "Kiosco Doña Rosa");
    expect(await repos.meta.get("business_name")).toBe("Kiosco Doña Rosa");
    await repos.meta.remove("business_name");
    expect(await repos.meta.get("business_name")).toBeNull();
  });
});
