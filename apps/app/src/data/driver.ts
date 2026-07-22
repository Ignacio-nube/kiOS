/**
 * `SqlDriver`: la frontera portable de kiOS. Un solo juego de repositorios
 * por encima; tres implementaciones por debajo (tauri-plugin-sql en
 * escritorio, sqlite-wasm en la demo web, better-sqlite3 en tests).
 *
 * Contrato:
 * - Parámetros SIEMPRE por placeholders `?`, nunca interpolados.
 * - `transaction` = BEGIN IMMEDIATE … COMMIT, ROLLBACK en el catch y
 *   re-throw del error ORIGINAL (no el del rollback).
 * - Sin `lastInsertId`: los IDs son UUIDv7 generados en cliente.
 */

export interface ExecuteResult {
  rowsAffected: number;
}

export interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface SqlDriver extends SqlExecutor {
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  /** Copia consistente de la base con esta etiqueta (pre-migración). */
  backupDatabase(label: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Serializa toda operación de DB. Necesaria porque (1) una transacción
 * abre estado que cualquier query concurrente rompería y (2) el pool sqlx
 * de tauri-plugin-sql repartiría queries concurrentes entre conexiones
 * distintas, partiendo la transacción. Un error NO envenena la cola.
 */
export class AsyncQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
