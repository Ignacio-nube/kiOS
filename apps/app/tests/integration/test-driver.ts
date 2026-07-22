/**
 * `SqlDriver` de tests: better-sqlite3 en memoria (síncrono, envuelto en
 * promesas). Ejercita las MISMAS queries y migraciones que producción
 * contra un SQLite real: constraints, FKs y transacciones de verdad.
 */
import DatabaseConstructor, { type Database } from "better-sqlite3";
import { AsyncQueue, type SqlDriver, type SqlExecutor } from "../../src/data/driver";

export interface TestDriver extends SqlDriver {
  /** Acceso directo para seeds masivos y aserciones de bajo nivel. */
  raw: Database;
  /** Etiquetas de backup pedidas (para asertar en tests de migraciones). */
  backups: string[];
}

export function createTestDriver(): TestDriver {
  const db = new DatabaseConstructor(":memory:");
  db.pragma("foreign_keys = ON");

  const executor: SqlExecutor = {
    async execute(sql, params) {
      const info = db.prepare(sql).run(...((params ?? []) as never[]));
      return { rowsAffected: info.changes };
    },
    async select<T>(sql: string, params?: unknown[]) {
      return db.prepare(sql).all(...((params ?? []) as never[])) as T[];
    },
  };

  const queue = new AsyncQueue();
  const backups: string[] = [];

  return {
    raw: db,
    backups,
    execute: (sql, params) => queue.run(() => executor.execute(sql, params)),
    select: (sql, params) => queue.run(() => executor.select(sql, params)),

    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      // El executor va directo (sin re-encolar) para no deadlockear la cola.
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
            // Se reporta el error original.
          }
          throw error;
        }
      });
    },

    async backupDatabase(label) {
      backups.push(label);
    },

    async close() {
      db.close();
    },
  };
}

/** Contexto determinista para tests: reloj fijable e IDs secuenciales legibles. */
export function createTestContext(overrides?: { now?: () => string }) {
  let counter = 0;
  return {
    tenantId: "tenant-test",
    deviceId: "device-test",
    now: overrides?.now ?? (() => new Date().toISOString()),
    newId: () => `id-${String(++counter).padStart(6, "0")}`,
  };
}
