/**
 * `SqlDriver` de la demo web: SQLite compilado a WASM (build oficial de
 * sqlite.org) en un Web Worker.
 *
 * La demo corre EN MEMORIA por defecto — coincide con el aviso honesto de
 * "los datos no persisten de forma confiable" — con OPFS como best-effort
 * (si está disponible, el archivo sobrevive entre visitas del mismo
 * navegador). El VFS `opfs` necesita SharedArrayBuffer → headers COOP/COEP
 * en vite.config.ts y vercel.json.
 *
 * Gotchas heredados de kioskito:
 * - El worker corre en otro hilo: las filas NO llenan el array local
 *   pasado como `resultRows`; hay que leerlas de la RESPUESTA.
 * - `changes()` se pide en query aparte (seguro: la cola serializa).
 * - Cache de páginas 64 MB: cada lectura de página cruza al worker de I/O
 *   vía Atomics; con el default de 2 MB una agregación grande tarda
 *   decenas de segundos.
 */
import { sqlite3Worker1Promiser } from "@sqlite.org/sqlite-wasm";
import { AsyncQueue, type SqlDriver, type SqlExecutor } from "../driver";

export const WASM_DB_FILE = "kios.db";

let persisted = false;

/** true si la última apertura logró persistencia OPFS (para avisar en UI). */
export function wasmPersisted(): boolean {
  return persisted;
}

type Promiser = (type: string, args: Record<string, unknown>) => Promise<{
  result: Record<string, unknown>;
}>;

export async function createWasmDriver(): Promise<SqlDriver> {
  const promiser: Promiser = await new Promise((resolve) => {
    const p: unknown = sqlite3Worker1Promiser({
      onready: () => resolve(p as Promiser),
    });
  });

  try {
    await promiser("open", { filename: `file:${WASM_DB_FILE}?vfs=opfs` });
    persisted = true;
  } catch {
    await promiser("open", { filename: ":memory:" });
    persisted = false;
  }

  await promiser("exec", { sql: "PRAGMA foreign_keys = ON" });
  await promiser("exec", { sql: "PRAGMA cache_size = -65536" });

  async function exec<T>(
    sql: string,
    params: unknown[] | undefined,
    rowMode: "object" | "array",
  ): Promise<T[]> {
    const response = await promiser("exec", {
      sql,
      bind: params ?? [],
      rowMode,
      resultRows: [],
    });
    return (response.result.resultRows as T[]) ?? [];
  }

  const executor: SqlExecutor = {
    async execute(sql, params) {
      await exec(sql, params, "array");
      const meta = await exec<[number]>("SELECT changes()", undefined, "array");
      return { rowsAffected: meta[0]?.[0] ?? 0 };
    },
    async select<T>(sql: string, params?: unknown[]) {
      return exec<T>(sql, params, "object");
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
      if (!persisted) return; // en memoria no hay archivo que respaldar
      // VACUUM INTO falla si el destino existe: se borra el anterior.
      const root = await navigator.storage.getDirectory();
      try {
        await root.removeEntry(label);
      } catch {
        // No existía: primer backup con este nombre.
      }
      await promiser("exec", {
        sql: "VACUUM INTO ?",
        bind: [`file:${label}?vfs=opfs`],
      });
    },

    async close() {
      await promiser("close", {});
    },
  };
}
