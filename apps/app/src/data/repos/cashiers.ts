/**
 * Repositorio de cajeros. Un cajero es SOLO una identidad: quién está
 * atendiendo. Sin clave, sin roles, sin permisos — sirve para atribuir
 * ventas y cerrar la caja, no para controlar accesos.
 *
 * Son pocos (1..10), así que no hay paginación ni búsqueda.
 */
import type { SqlDriver } from "../driver";
import type { RepoContext } from "../context";
import type { Cashier } from "../types";
import { defaultCashierName, isValidCashierName, normalizeCashierName } from "../../domain/cashiers";

interface CashierRow {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const COLUMNS = "id, name, created_at, updated_at, deleted_at";

function mapCashier(row: CashierRow): Cashier {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CashiersRepo {
  list(): Promise<Cashier[]>;
  getById(id: string): Promise<Cashier | null>;
  create(input: { name: string }): Promise<Cashier>;
  rename(id: string, name: string): Promise<void>;
  /** Baja lógica. Falla si es el ÚLTIMO activo: nunca sin caja. */
  softDelete(id: string): Promise<void>;
  /**
   * Crea el cajero principal SOLO si no hay ninguno, con el nombre del
   * negocio (o "Principal"). Idempotente. Devuelve un cajero activo.
   */
  ensureDefault(businessName: string): Promise<Cashier>;
}

export function createCashiersRepo(driver: SqlDriver, ctx: RepoContext): CashiersRepo {
  async function getById(id: string): Promise<Cashier | null> {
    const rows = await driver.select<CashierRow>(
      `SELECT ${COLUMNS} FROM cashiers WHERE id = ?`,
      [id],
    );
    return rows[0] ? mapCashier(rows[0]) : null;
  }

  return {
    async list() {
      const rows = await driver.select<CashierRow>(
        `SELECT ${COLUMNS} FROM cashiers WHERE deleted_at IS NULL
         ORDER BY name COLLATE NOCASE`,
      );
      return rows.map(mapCashier);
    },

    getById,

    async create(input) {
      const name = normalizeCashierName(input.name);
      if (!isValidCashierName(name)) throw new Error("El nombre del cajero no puede estar vacío");
      const id = ctx.newId();
      const now = ctx.now();
      await driver.execute(
        `INSERT INTO cashiers (id, tenant_id, name, created_at, updated_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, ctx.tenantId, name, now, now, ctx.deviceId],
      );
      return { id, name, createdAt: now, updatedAt: now, deletedAt: null };
    },

    async rename(id, rawName) {
      const name = normalizeCashierName(rawName);
      if (!isValidCashierName(name)) throw new Error("El nombre del cajero no puede estar vacío");
      const now = ctx.now();
      await driver.execute(
        `UPDATE cashiers SET name = ?, updated_at = ?, device_id = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [name, now, ctx.deviceId, id],
      );
    },

    async softDelete(id) {
      await driver.transaction(async (tx) => {
        // El conteo y la baja van en la MISMA transacción: si no, dos bajas
        // concurrentes podrían dejar el kiosco sin ningún cajero.
        const rows = await tx.select<{ n: number }>(
          "SELECT COUNT(*) AS n FROM cashiers WHERE deleted_at IS NULL AND id != ?",
          [id],
        );
        if ((rows[0]?.n ?? 0) === 0) {
          throw new Error("Tiene que quedar al menos un cajero: creá otro antes de dar de baja este");
        }
        const now = ctx.now();
        await tx.execute(
          `UPDATE cashiers SET deleted_at = ?, updated_at = ?, device_id = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [now, now, ctx.deviceId, id],
        );
      });
    },

    async ensureDefault(businessName) {
      const id = ctx.newId();
      const now = ctx.now();
      const name = defaultCashierName(businessName);

      // BEGIN IMMEDIATE: el doble montaje de StrictMode llama a esto dos
      // veces en paralelo y sin la transacción crearía dos "Principal".
      await driver.transaction(async (tx) => {
        const existing = await tx.select<{ n: number }>(
          "SELECT COUNT(*) AS n FROM cashiers WHERE deleted_at IS NULL",
        );
        if ((existing[0]?.n ?? 0) > 0) return;
        await tx.execute(
          `INSERT INTO cashiers (id, tenant_id, name, created_at, updated_at, device_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, ctx.tenantId, name, now, now, ctx.deviceId],
        );
      });

      const created = await getById(id);
      if (created) return created;
      // Ya había cajeros: devolvemos el primero por orden alfabético.
      const rows = await driver.select<CashierRow>(
        `SELECT ${COLUMNS} FROM cashiers WHERE deleted_at IS NULL
         ORDER BY name COLLATE NOCASE LIMIT 1`,
      );
      if (!rows[0]) throw new Error("No se pudo asegurar un cajero por defecto");
      return mapCashier(rows[0]);
    },
  };
}
