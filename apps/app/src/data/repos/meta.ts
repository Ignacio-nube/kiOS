/** Key-value de configuración local (licencia, nombre del negocio, etc.). */
import type { SqlDriver } from "../driver";

export interface MetaRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createMetaRepo(driver: SqlDriver): MetaRepo {
  return {
    async get(key) {
      const rows = await driver.select<{ value: string }>(
        "SELECT value FROM meta WHERE key = ?",
        [key],
      );
      return rows[0]?.value ?? null;
    },
    async set(key, value) {
      await driver.execute(
        "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
      );
    },
    async remove(key) {
      // Única excepción al no-DELETE: meta es config local, no data sincronizable.
      await driver.execute("DELETE FROM meta WHERE key = ?", [key]);
    },
  };
}
