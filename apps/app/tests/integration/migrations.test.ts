import { describe, expect, it } from "vitest";
import { createTestDriver } from "./test-driver";
import { runMigrations, currentSchemaVersion, validateRegistry, MigrationError } from "../../src/data/migrations/runner";
import { ALL_MIGRATIONS } from "../../src/data/migrations";

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
      "schema_migrations",
    ]) {
      expect(names).toContain(expected);
    }

    const views = await driver.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'view'",
    );
    expect(views.map((v) => v.name)).toContain("current_stock");

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
