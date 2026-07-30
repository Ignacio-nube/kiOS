import { describe, expect, it } from "vitest";
import { createTestDriver } from "./test-driver";
import { runMigrations, currentSchemaVersion, validateRegistry, MigrationError } from "../../src/data/migrations/runner";
import { ALL_MIGRATIONS } from "../../src/data/migrations";
import { migration001 } from "../../src/data/migrations/001_initial";
import { migration002 } from "../../src/data/migrations/002_cashiers_and_credit";
import { foldForSearch } from "../../src/domain/search";

describe("migraciones", () => {
  it("aplica el esquema completo desde cero", async () => {
    const driver = createTestDriver();
    await runMigrations(driver);

    const tables = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    for (const expected of [
      "meta", "categories", "products", "stock_movements", "sales",
      "sale_items", "sale_payments", "customers", "customer_account_movements",
      "cashiers", "schema_migrations",
    ]) {
      expect(names).toContain(expected);
    }
    // Las tablas temporales del rebuild de la 002 no quedan dando vueltas.
    expect(names).not.toContain("sale_payments_new");
    expect(names).not.toContain("customer_account_movements_new");

    const views = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'view'",
    );
    expect(views.map((v) => v.name)).toContain("current_stock");
    expect(views.map((v) => v.name)).toContain("customer_balances");

    expect(await currentSchemaVersion(driver)).toBe(ALL_MIGRATIONS.length);
  });

  it("es idempotente: correr dos veces no re-aplica nada", async () => {
    const driver = createTestDriver();
    await runMigrations(driver);
    await runMigrations(driver);
    const rows = await driver.select<{ n: number }>(
      "SELECT COUNT(*) AS n FROM schema_migrations",
    );
    expect(rows[0]!.n).toBe(ALL_MIGRATIONS.length);
  });

  it("hace backup etiquetado con la versión vieja ANTES de migrar", async () => {
    const driver = createTestDriver();
    await runMigrations(driver);
    expect(driver.backups).toEqual(["pre-v0"]);
    // Sin pendientes no hay backup nuevo.
    await runMigrations(driver);
    expect(driver.backups).toEqual(["pre-v0"]);
  });

  it("una migración rota rollbackea completa y reporta la versión", async () => {
    const driver = createTestDriver();
    await runMigrations(driver);
    const broken = [
      ...ALL_MIGRATIONS,
      {
        version: ALL_MIGRATIONS.length + 1,
        name: "broken",
        statements: [
          "CREATE TABLE will_rollback (id TEXT PRIMARY KEY)",
          "THIS IS NOT SQL",
        ],
      },
    ];
    await expect(runMigrations(driver, broken)).rejects.toThrowError(MigrationError);
    const tables = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE name = 'will_rollback'",
    );
    expect(tables).toHaveLength(0);
    expect(await currentSchemaVersion(driver)).toBe(ALL_MIGRATIONS.length);
  });

  it("valida que el registro sea consecutivo 1..N", () => {
    expect(() => validateRegistry([{ version: 2, name: "x", statements: [] }])).toThrow();
    expect(() => validateRegistry(ALL_MIGRATIONS)).not.toThrow();
  });
});

/**
 * La 002 reconstruye dos tablas (CREATE → INSERT SELECT → DROP → RENAME)
 * DENTRO de la transacción del runner, donde `PRAGMA foreign_keys` es un
 * no-op y por lo tanto no se pueden apagar las FKs. Estos tests son la
 * prueba de que la receta es segura sobre una base con datos de verdad —
 * el caso del usuario que ya venía usando la app.
 */
describe("migración 002 sobre una base v1 con datos", () => {
  /**
   * Base en v1 con datos escritos COMO LOS ESCRIBÍA la versión vieja: SQL
   * crudo con las columnas de la 001. No se usan los repos actuales a
   * propósito — ya insertan cashier_id/customer_id, que en v1 no existen, y
   * el test dejaría de representar la base real de un usuario.
   */
  async function v1WithData() {
    const driver = createTestDriver();
    await runMigrations(driver, [migration001]);
    const now = "2026-01-01T12:00:00.000Z";

    driver.raw.prepare(
      `INSERT INTO products (id, tenant_id, name, price_cents, created_at, updated_at, device_id)
       VALUES ('prod-1', 't', 'Alfajor', 120000, ?, ?, 'd')`,
    ).run(now, now);
    driver.raw.prepare(
      `INSERT INTO sales (id, tenant_id, total_cents, created_at, updated_at, device_id)
       VALUES ('sale-1', 't', 240000, ?, ?, 'd')`,
    ).run(now, now);
    driver.raw.prepare(
      `INSERT INTO sale_items (id, tenant_id, sale_id, product_id, product_name,
         unit_price_cents, qty, created_at, updated_at, device_id)
       VALUES ('item-1', 't', 'sale-1', 'prod-1', 'Alfajor', 120000, 2, ?, ?, 'd')`,
    ).run(now, now);
    driver.raw.prepare(
      `INSERT INTO sale_payments (id, tenant_id, sale_id, method, amount_cents,
         created_at, updated_at, device_id)
       VALUES ('pay-1', 't', 'sale-1', 'cash', 240000, ?, ?, 'd')`,
    ).run(now, now);
    // Un cliente cargado a mano: la 001 crea la tabla aunque no haya repo.
    driver.raw.prepare(
      `INSERT INTO customers (id, tenant_id, name, created_at, updated_at, device_id)
       VALUES ('cust-1', 't', 'Vecino', ?, ?, 'd')`,
    ).run(now, now);

    return { driver, saleId: "sale-1" };
  }

  it("preserva los pagos y deja la base íntegra", async () => {
    const { driver } = await v1WithData();
    const before = driver.raw.prepare("SELECT COUNT(*) AS n FROM sale_payments").get() as { n: number };
    expect(before.n).toBe(1);

    await runMigrations(driver);

    expect(await currentSchemaVersion(driver)).toBe(ALL_MIGRATIONS.length);
    const after = driver.raw.prepare("SELECT * FROM sale_payments").all() as { method: string }[];
    expect(after).toHaveLength(1);
    expect(after[0]!.method).toBe("cash");

    // Lo que la receta oficial protege con foreign_keys=OFF:
    expect(driver.raw.pragma("foreign_key_check")).toEqual([]);
    expect(driver.raw.pragma("integrity_check", { simple: true })).toBe("ok");
    // El PRAGMA sigue encendido: nunca lo tocamos.
    expect(driver.raw.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("hace un backup por cada salto de versión, con la versión VIEJA", async () => {
    const { driver } = await v1WithData();
    expect(driver.backups).toEqual(["pre-v0"]);
    await runMigrations(driver);
    expect(driver.backups).toEqual(["pre-v0", "pre-v1"]);
  });

  it("la FK sale_payments→sales sigue viva después del rebuild", async () => {
    const { driver } = await v1WithData();
    await runMigrations(driver);

    const indexes = driver.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sale_payments'")
      .all() as { name: string }[];
    expect(indexes.map((i) => i.name)).toContain("idx_sale_payments_sale");

    expect(() =>
      driver.raw.prepare(
        `INSERT INTO sale_payments (id, tenant_id, sale_id, method, amount_cents, created_at, updated_at, device_id)
         VALUES ('x', 't', 'venta-que-no-existe', 'cash', 100, '2026-01-01', '2026-01-01', 'd')`,
      ).run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it("el CHECK nuevo acepta 'credit' y sigue rechazando basura", async () => {
    const { driver, saleId } = await v1WithData();
    await runMigrations(driver);

    const insert = (method: string) =>
      driver.raw.prepare(
        `INSERT INTO sale_payments (id, tenant_id, sale_id, method, amount_cents, created_at, updated_at, device_id)
         VALUES (?, 't', ?, ?, 100, '2026-01-01', '2026-01-01', 'd')`,
      ).run(`p-${method}`, saleId, method);

    expect(() => insert("credit")).not.toThrow();
    expect(() => insert("bitcoin")).toThrow(/CHECK/i);
  });

  it("el ledger de cuenta acepta void_reversal y las columnas nuevas", async () => {
    const { driver } = await v1WithData();
    await runMigrations(driver);

    expect(() =>
      driver.raw.prepare(
        `INSERT INTO customer_account_movements
           (id, tenant_id, customer_id, delta_cents, type, method, cashier_id, created_at, updated_at, device_id)
         VALUES ('m1', 't', 'cust-1', -500, 'void_reversal', NULL, NULL, '2026-01-01', '2026-01-01', 'd')`,
      ).run(),
    ).not.toThrow();

    // Y la vista de saldos agrega ese ledger.
    const balance = driver.raw
      .prepare("SELECT balance_cents FROM customer_balances WHERE customer_id = 'cust-1'")
      .get() as { balance_cents: number };
    expect(balance.balance_cents).toBe(-500);
  });

  it("las ventas viejas quedan sin cajero ni cliente (no inventa datos)", async () => {
    const { driver, saleId } = await v1WithData();
    await runMigrations(driver);

    const row = driver.raw
      .prepare("SELECT cashier_id, customer_id FROM sales WHERE id = ?")
      .get(saleId) as { cashier_id: string | null; customer_id: string | null };
    expect(row.cashier_id).toBeNull();
    expect(row.customer_id).toBeNull();
  });
});

/**
 * La 003 rellena `name_folded` de las filas que YA existían usando
 * `replace()` de SQL, mientras que las filas nuevas las pliega el repo en
 * JavaScript. Son dos implementaciones del mismo plegado.
 *
 * Este bloque es lo que garantiza que no divergen: compara el resultado del
 * SQL contra `foldForSearch` carácter por carácter. Si difieren, el
 * buscador encontraría los productos cargados después de actualizar pero no
 * los de antes — un bug sin patrón visible y carísimo de diagnosticar.
 */
describe("migración 003 — relleno de name_folded", () => {
  const ACENTUADOS = [
    "Turrón de maní",
    "AZÚCAR 1KG",
    "Café instantáneo 50g",
    "Piñata grande",
    "Ñandú",
    "Crème brûlée",
    "Señor Ándrés",
    "Sin acentos 123",
  ];

  async function v2ConNombresAcentuados() {
    const driver = createTestDriver();
    await runMigrations(driver, [migration001, migration002]);
    const now = "2026-01-01T12:00:00.000Z";

    ACENTUADOS.forEach((name, i) => {
      driver.raw.prepare(
        `INSERT INTO products (id, tenant_id, name, price_cents, created_at, updated_at, device_id)
         VALUES (?, 't', ?, 100000, ?, ?, 'd')`,
      ).run(`prod-${i}`, name, now, now);
      driver.raw.prepare(
        `INSERT INTO customers (id, tenant_id, name, created_at, updated_at, device_id)
         VALUES (?, 't', ?, ?, ?, 'd')`,
      ).run(`cust-${i}`, name, now, now);
    });

    return driver;
  }

  it("el plegado en SQL da EXACTAMENTE lo mismo que foldForSearch", async () => {
    const driver = await v2ConNombresAcentuados();
    await runMigrations(driver);

    for (const tabla of ["products", "customers"]) {
      const filas = driver.raw
        .prepare(`SELECT name, name_folded FROM ${tabla}`)
        .all() as { name: string; name_folded: string }[];

      expect(filas).toHaveLength(ACENTUADOS.length);
      for (const fila of filas) {
        expect(fila.name_folded).toBe(foldForSearch(fila.name));
      }
    }
  });

  it("después de migrar, 'turron' encuentra el producto viejo", async () => {
    // La forma ejecutable del bug original, sobre datos preexistentes.
    const driver = await v2ConNombresAcentuados();
    await runMigrations(driver);

    const encontrados = driver.raw
      .prepare("SELECT name FROM products WHERE name_folded LIKE ?")
      .all(`%${foldForSearch("turron")}%`) as { name: string }[];

    expect(encontrados.map((f) => f.name)).toEqual(["Turrón de maní"]);
  });

  it("los índices nuevos existen y son parciales", async () => {
    const driver = await v2ConNombresAcentuados();
    await runMigrations(driver);

    const indices = driver.raw
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name LIKE '%name_folded%'")
      .all() as { name: string; sql: string }[];

    expect(indices.map((i) => i.name).sort()).toEqual([
      "idx_customers_name_folded",
      "idx_products_name_folded",
    ]);
    // Parciales como el resto del esquema: los borrados no se buscan nunca.
    for (const indice of indices) {
      expect(indice.sql).toContain("deleted_at IS NULL");
    }
  });
});
