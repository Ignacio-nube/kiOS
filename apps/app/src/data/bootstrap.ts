/**
 * Identidad local: tenant_id y device_id se generan una sola vez en el
 * primer arranque y viven en `meta`. Localmente el tenant es siempre el
 * mismo (regla 4); en fase 2 el sync los usa tal cual.
 */
import { uuidv7 } from "../domain/ids";
import type { SqlDriver } from "./driver";
import type { RepoContext } from "./context";

export const META_KEYS = {
  tenantId: "tenant_id",
  deviceId: "device_id",
  licenseKey: "license_key",
  businessName: "business_name",
} as const;

async function metaGet(driver: SqlDriver, key: string): Promise<string | null> {
  const rows = await driver.select<{ value: string }>(
    "SELECT value FROM meta WHERE key = ?",
    [key],
  );
  return rows[0]?.value ?? null;
}

async function ensureMetaId(driver: SqlDriver, key: string): Promise<string> {
  const existing = await metaGet(driver, key);
  if (existing) return existing;
  const id = uuidv7();
  // ON CONFLICT por si dos montajes concurrentes llegan acá (StrictMode).
  await driver.execute(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
    [key, id],
  );
  return (await metaGet(driver, key)) ?? id;
}

/** Corre después de las migraciones; devuelve el contexto de producción. */
export async function ensureIdentity(driver: SqlDriver): Promise<RepoContext> {
  const tenantId = await ensureMetaId(driver, META_KEYS.tenantId);
  const deviceId = await ensureMetaId(driver, META_KEYS.deviceId);
  return {
    tenantId,
    deviceId,
    now: () => new Date().toISOString(),
    newId: () => uuidv7(),
  };
}
