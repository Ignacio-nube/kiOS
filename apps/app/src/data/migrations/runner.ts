/**
 * Runner de migraciones. Reglas:
 * - Backup etiquetado con la versión VIEJA antes de tocar nada; si el
 *   backup falla, NO se migra.
 * - Cada migración corre en SU transacción junto al INSERT en
 *   schema_migrations: o entra completa o no entra.
 * - El registro se valida: versiones 1..N consecutivas.
 */
import type { SqlDriver } from "../driver";
import type { Migration } from "./types";
import { ALL_MIGRATIONS } from "./index";

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly failedVersion: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MigrationError";
  }
}

export function validateRegistry(migrations: Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Registro de migraciones inválido: se esperaba versión ${i + 1}, hay ${m.version} (${m.name})`,
      );
    }
  });
}

export async function currentSchemaVersion(driver: SqlDriver): Promise<number> {
  await driver.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )`,
  );
  const rows = await driver.select<{ version: number | null }>(
    "SELECT MAX(version) AS version FROM schema_migrations",
  );
  return rows[0]?.version ?? 0;
}

export async function runMigrations(
  driver: SqlDriver,
  migrations: Migration[] = ALL_MIGRATIONS,
): Promise<void> {
  validateRegistry(migrations);
  const current = await currentSchemaVersion(driver);
  const pending = migrations.filter((m) => m.version > current);
  if (pending.length === 0) return;

  // Etiqueta con la versión desde la que se migra: restaurable si algo sale mal.
  await driver.backupDatabase(`pre-v${current}`);

  for (const migration of pending) {
    try {
      await driver.transaction(async (tx) => {
        for (const statement of migration.statements) {
          await tx.execute(statement);
        }
        await tx.execute(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
          [migration.version, new Date().toISOString()],
        );
      });
    } catch (cause) {
      throw new MigrationError(
        `Falló la migración ${migration.version} (${migration.name})`,
        migration.version,
        cause,
      );
    }
  }
}
