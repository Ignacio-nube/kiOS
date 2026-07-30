/**
 * `SqlDriver` de escritorio: SQLite nativo vía tauri-plugin-sql (sqlx).
 * La `AsyncQueue` es obligatoria acá: el pool de sqlx repartiría queries
 * concurrentes entre conexiones distintas y partiría las transacciones.
 *
 * ⚠ Las FOREIGN KEYS no están garantizadas en este driver. sqlx las activa
 * por default, pero al ser un POOL un `PRAGMA foreign_keys = ON` solo
 * afectaría a la conexión que lo atendió — ponerlo acá sería un placebo.
 * Por eso los repositorios validan la existencia de las filas referenciadas
 * con SELECTs explícitos dentro de la transacción, en vez de confiar en que
 * la FK explote. (El driver wasm y el de tests sí las activan.)
 */
import Database from "@tauri-apps/plugin-sql";
import { BaseDirectory, copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { AsyncQueue, type SqlDriver, type SqlExecutor } from "../driver";

export const DB_FILE = "kios.db";

export async function createTauriDriver(): Promise<SqlDriver> {
  const db = await Database.load(`sqlite:${DB_FILE}`);

  const executor: SqlExecutor = {
    async execute(sql, params) {
      const result = await db.execute(sql, params ?? []);
      return { rowsAffected: result.rowsAffected };
    },
    async select<T>(sql: string, params?: unknown[]) {
      return db.select<T[]>(sql, params ?? []);
    },
  };

  const queue = new AsyncQueue();

  return {
    execute: (sql, params) => queue.run(() => executor.execute(sql, params)),
    select: (sql, params) => queue.run(() => executor.select(sql, params)),

    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return queue.run(async () => {
        await executor.execute("BEGIN IMMEDIATE");
        try {
          const result = await fn(executor);
          await executor.execute("COMMIT");
          return result;
        } catch (error) {
          try {
            await executor.execute("ROLLBACK");
          } catch {
            // Se reporta el error original, no el del rollback.
          }
          throw error;
        }
      });
    },

    async backupDatabase(label) {
      // sqlx abre SQLite en modo WAL: lo recién commiteado puede vivir solo
      // en el sidecar `kios.db-wal`, y acá copiamos ÚNICAMENTE `kios.db`.
      // Sin este checkpoint el backup previo a una migración saldría sin los
      // últimos datos — justo los que hacen falta si la migración sale mal.
      // TRUNCATE vuelca el WAL al archivo principal y lo vacía, dejando
      // `kios.db` autocontenido antes de la copia.
      await queue.run(() => executor.execute("PRAGMA wal_checkpoint(TRUNCATE)"));
      await mkdir("backups", { baseDir: BaseDirectory.AppConfig, recursive: true });
      await copyFile(DB_FILE, `backups/${label}`, {
        fromPathBaseDir: BaseDirectory.AppConfig,
        toPathBaseDir: BaseDirectory.AppConfig,
      });
    },

    async close() {
      await db.close();
    },
  };
}
