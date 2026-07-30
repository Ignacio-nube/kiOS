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
  /**
   * Constancia de que esta instalación YA se activó con un código válido,
   * como JSON del payload. Es lo que hace que rotar la clave de licencias
   * no le apague la app a un cliente que pagó.
   *
   * Sin esto: se rota la clave pública para que los códigos viejos dejen de
   * servir en las descargas nuevas → el cliente que compró hace seis meses
   * actualiza → su código ya no verifica → la app cae a plan gratis sola.
   * Con esto, la verificación se exige UNA VEZ (al activar) y después la
   * instalación queda activada; la rotación solo afecta a quien intenta
   * activar de cero, que es justo lo que se busca.
   */
  licenseActivation: "license_activation",
  businessName: "business_name",
  /** "1" = imprimir el ticket automáticamente al confirmar un cobro. */
  printOnSale: "print_on_sale",
  /**
   * Cajero que está atendiendo. Vive en `meta` y no en localStorage porque
   * es config local del dispositivo (la excepción que ADR-003 le concede a
   * `meta`) y así funciona igual en la demo web y en escritorio.
   * ⚠ `resetAll` conserva `meta` pero borra `cashiers`: quien lo lea tiene
   * que validar que el id siga existiendo.
   */
  activeCashierId: "active_cashier_id",
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
