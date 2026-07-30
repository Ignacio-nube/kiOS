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

/**
 * El buscador tiene que encontrar lo que el kiosquero escribe apurado, no
 * lo que dice el diccionario. Estos tests van por el repo (no por SQL
 * crudo) porque es exactamente el camino que usa la pantalla de venta.
 */
describe("búsqueda sin acentos ni mayúsculas", () => {
  it("'turron' encuentra 'Turrón de maní'", async () => {
    await seedProduct("Turrón de maní", 900);
    await seedProduct("Alfajor triple", 1600);

    for (const termino of ["turron", "TURRON", "Turrón", "mani", "maní", "turron de mani"]) {
      const encontrados = await repos.products.search(termino);
      expect(encontrados.map((p) => p.name), `buscando "${termino}"`).toEqual(["Turrón de maní"]);
    }
  });

  it("el contador acompaña al buscador, o la paginación miente", async () => {
    await seedProduct("Turrón de maní", 900);
    await seedProduct("Alfajor triple", 1600);

    expect(await repos.products.count("turron")).toBe(1);
    expect(await repos.products.count("a")).toBe(2);
  });

  it("renombrar re-pliega: el nombre viejo deja de encontrarlo", async () => {
    // El bug clásico de las columnas materializadas: se actualiza `name` y
    // se olvida `name_folded`, y el producto queda buscable por un nombre
    // que ya no tiene.
    const p = await seedProduct("Turrón de maní", 900);
    await repos.products.update(p.id, { name: "Chocolatín" });

    expect(await repos.products.search("turron")).toHaveLength(0);
    expect((await repos.products.search("chocolatin"))[0]?.name).toBe("Chocolatín");
  });

  it("el código de barras se sigue comparando literal", async () => {
    // Plegar el barcode no tendría sentido (son dígitos) y además el match
    // es exacto, no por substring.
    await seedProduct("Alfajor", 1600, { barcode: "7797010147" });
    expect((await repos.products.search("7797010147"))[0]?.barcode).toBe("7797010147");
    expect(await repos.products.search("779701")).toHaveLength(0);
  });

  it("también funciona en clientes: 'rocio' encuentra a 'Rocío'", async () => {
    await repos.customers.create({ name: "Rocío" });
    await repos.customers.create({ name: "Ramón" });

    expect((await repos.customers.search("rocio"))[0]?.name).toBe("Rocío");
    expect((await repos.customers.search("RAMON"))[0]?.name).toBe("Ramón");
    expect(await repos.customers.count("rocio")).toBe(1);
  });
});

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

  it("list() y search() paginan con limit/offset sin traer todo a memoria", async () => {
    for (const name of ["Agua", "Bizcochos", "Coca", "Dulce de leche", "Fernet"]) {
      await seedProduct(name, 1000);
    }
    const firstPage = await repos.products.list(2, 0);
    const secondPage = await repos.products.list(2, 2);
    const thirdPage = await repos.products.list(2, 4);
    expect(firstPage.map((p) => p.name)).toEqual(["Agua", "Bizcochos"]);
    expect(secondPage.map((p) => p.name)).toEqual(["Coca", "Dulce de leche"]);
    expect(thirdPage.map((p) => p.name)).toEqual(["Fernet"]);

    // De los 5, solo "Agua" y "Coca" contienen "a".
    expect(await repos.products.search("a", 1, 0)).toEqual([expect.objectContaining({ name: "Agua" })]);
    expect(await repos.products.search("a", 1, 1)).toEqual([expect.objectContaining({ name: "Coca" })]);
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

  it("levelsFor trae solo los productos pedidos (una página), no la tabla entera", async () => {
    const a = await seedProduct("Mate", 3000, { initialStock: 5 });
    const b = await seedProduct("Bombilla", 8000, { initialStock: 1 });
    await seedProduct("Termo", 40000, { initialStock: 9 }); // no se pide, no debe aparecer

    const levels = await repos.stock.levelsFor([a.id, b.id]);
    expect(levels).toHaveLength(2);
    expect(new Map(levels.map((l) => [l.productId, l.qty]))).toEqual(
      new Map([[a.id, 5], [b.id, 1]]),
    );
    expect(await repos.stock.levelsFor([])).toEqual([]);
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

/**
 * Los contadores alimentan la paginación numerada: si cuentan distinto de lo
 * que lista su método hermano, la UI ofrece páginas vacías (o esconde la
 * última). Cada test compara contra el listado real, no contra un número
 * escrito a mano.
 */
describe("contadores de paginación", () => {
  it("products.count coincide con list y con search", async () => {
    await seedProduct("Alfajor Jorgito", 800, { barcode: "779001" });
    await seedProduct("Alfajor Guaymallén", 900);
    await seedProduct("Coca 500", 1500);

    expect(await repos.products.count()).toBe((await repos.products.list(999)).length);
    expect(await repos.products.count("alfajor")).toBe((await repos.products.search("alfajor", 999)).length);
    expect(await repos.products.count("alfajor")).toBe(2);
    // El término vacío tiene que caer al camino de `list`, no al de `search`.
    expect(await repos.products.count("   ")).toBe(3);
    expect(await repos.products.count("no existe")).toBe(0);

    // Y una baja se refleja en ambos.
    const [first] = await repos.products.search("Jorgito", 1);
    await repos.products.softDelete(first!.id);
    expect(await repos.products.count()).toBe(2);
  });

  it("customers.count y countDebtors coinciden con sus listados", async () => {
    const deudor = await repos.customers.create({ name: "Don Julio", phone: "351123" });
    await repos.customers.create({ name: "Marta" });
    await repos.customers.create({ name: "Tito" });

    expect(await repos.customers.count()).toBe((await repos.customers.list(999)).length);
    expect(await repos.customers.count("mar")).toBe((await repos.customers.search("mar", 999)).length);
    // La búsqueda también pega contra el teléfono.
    expect(await repos.customers.count("351")).toBe(1);

    // Sin deuda todavía: nadie es deudor.
    expect(await repos.customers.countDebtors()).toBe(0);

    const producto = await seedProduct("Fernet", 5000, { initialStock: 10 });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "credit", amountCents: 5000 }],
      customerId: deudor.id,
    });
    expect(await repos.customers.countDebtors()).toBe((await repos.customers.listDebtors(999)).length);
    expect(await repos.customers.countDebtors()).toBe(1);
  });

  it("sales.countByRange INCLUYE las anuladas, igual que listByRange", async () => {
    const producto = await seedProduct("Coca 500", 1500, { initialStock: 50 });
    const range = { from: "2000-01-01", to: "2100-01-01" };

    const a = await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "cash", amountCents: 1500 }],
    });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 2 }],
      payments: [{ method: "card", amountCents: 3000 }],
    });

    expect(await repos.sales.countByRange(range)).toBe((await repos.sales.listByRange(range, 999)).length);
    expect(await repos.sales.countByRange(range)).toBe(2);

    await repos.sales.voidSale(a.id);

    // Ésta es la razón de existir del método: `totalsByRange` baja a 1
    // (facturación) pero el listado sigue mostrando 2 filas, así que el
    // contador de la paginación tiene que seguir en 2.
    expect((await repos.sales.totalsByRange(range)).count).toBe(1);
    expect(await repos.sales.listByRange(range, 999)).toHaveLength(2);
    expect(await repos.sales.countByRange(range)).toBe(2);
  });

  it("sales.countByRange respeta los filtros de la pantalla de Reportes", async () => {
    const producto = await seedProduct("Coca 500", 1500, { initialStock: 50 });
    const range = { from: "2000-01-01", to: "2100-01-01" };
    const cajero = await repos.cashiers.create({ name: "Rocío" });

    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "cash", amountCents: 1500 }],
      cashierId: cajero.id,
    });
    await repos.sales.registerSale({
      lines: [{ productId: producto.id, qty: 1 }],
      payments: [{ method: "card", amountCents: 1500 }],
    });

    for (const filter of [{ paymentMethod: "cash" as const }, { cashierId: cajero.id }]) {
      expect(await repos.sales.countByRange(range, filter))
        .toBe((await repos.sales.listByRange(range, 999, 0, filter)).length);
    }
    expect(await repos.sales.countByRange(range, { paymentMethod: "cash" })).toBe(1);

    // Y un rango que no abarca nada cuenta cero.
    expect(await repos.sales.countByRange({ from: "1990-01-01", to: "1990-01-02" })).toBe(0);
  });
});
