/**
 * `SqlDriver` de escritorio: SQLite nativo vía tauri-plugin-sql (sqlx).
 * La `AsyncQueue` es obligatoria acá: el pool de sqlx repartiría queries
 * concurrentes entre conexiones distintas y partiría las transacciones.
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
