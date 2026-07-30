/**
 * Repositorio de clientes y cuenta corriente (fiado).
 *
 * El saldo NUNCA es una columna: es la agregación del ledger append-only
 * `customer_account_movements`, igual que el stock (ADR-004). No existe
 * "setear el saldo": todo cambio es un movimiento con motivo.
 *
 * ⚠ SIGNO: delta > 0 AUMENTA la deuda, delta < 0 la baja. Saldo positivo =
 * el cliente debe. Es la INVERSA del stock. Ver domain/account.ts.
 *
 * ⚠ Este repo NO conoce `credit_limit_cents` para decidir nada: el límite es
 * un AVISO de la UI, jamás un bloqueo. Que la regla no viva acá impide que
 * alguien reintroduzca un "por las dudas no dejes fiar" dentro de seis meses.
 */
import type { SqlDriver, SqlExecutor } from "../driver";
import type { RepoContext } from "../context";
import type {
  AccountMovement, AccountPaymentInput, Customer, CustomerBalance,
  CustomerPatch, CustomerWithBalance, NewCustomer,
} from "../types";
import type { AccountMovementType } from "../../domain/account";
import type { PaymentMethod } from "../../domain/ticket";
import { foldForSearch } from "../../domain/search";

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  credit_limit_cents: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface MovementRow {
  id: string;
  customer_id: string;
  delta_cents: number;
  type: AccountMovementType;
  method: PaymentMethod | null;
  cashier_id: string | null;
  sale_id: string | null;
  note: string | null;
  created_at: string;
}

const CUSTOMER_COLUMNS =
  "id, name, phone, notes, credit_limit_cents, created_at, updated_at, deleted_at";
const MOVEMENT_COLUMNS =
  "id, customer_id, delta_cents, type, method, cashier_id, sale_id, note, created_at";

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    creditLimitCents: row.credit_limit_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapMovement(row: MovementRow): AccountMovement {
  return {
    id: row.id,
    customerId: row.customer_id,
    deltaCents: row.delta_cents,
    type: row.type,
    method: row.method,
    cashierId: row.cashier_id,
    saleId: row.sale_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

export interface CustomersRepo {
  list(limit?: number, offset?: number): Promise<Customer[]>;
  search(term: string, limit?: number, offset?: number): Promise<Customer[]>;
  /** Solo los que deben, del que más debe al que menos. */
  listDebtors(limit?: number, offset?: number): Promise<CustomerWithBalance[]>;
  getById(id: string): Promise<Customer | null>;
  countActive(): Promise<number>;
  /**
   * Cuántas filas devolvería `list`/`search` con el mismo término, y cuántos
   * `listDebtors`. Espejan sus WHERE al pie de la letra: si divergen, la
   * paginación numerada ofrece páginas vacías.
   */
  count(term?: string): Promise<number>;
  countDebtors(): Promise<number>;
  create(input: NewCustomer): Promise<Customer>;
  update(id: string, patch: CustomerPatch): Promise<void>;
  softDelete(id: string): Promise<void>;

  /** Saldos SOLO de los clientes pedidos (una página). */
  balancesFor(customerIds: string[]): Promise<CustomerBalance[]>;
  balanceFor(customerId: string): Promise<number>;
  /** KPI: cuántos deben y cuánto en total. */
  totalDebt(): Promise<{ debtors: number; totalCents: number }>;

  movementsFor(customerId: string, limit?: number, offset?: number): Promise<AccountMovement[]>;
  /** Cobro de deuda: movimiento `payment` con delta NEGATIVO. */
  registerPayment(input: AccountPaymentInput): Promise<void>;
  /** Corrección manual (perdón de deuda, error de carga). `deltaCents` con signo. */
  registerAdjustment(input: {
    customerId: string; deltaCents: number; note: string; cashierId?: string | null;
  }): Promise<void>;
}

export function createCustomersRepo(driver: SqlDriver, ctx: RepoContext): CustomersRepo {
  async function getById(id: string): Promise<Customer | null> {
    const rows = await driver.select<CustomerRow>(
      `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = ?`,
      [id],
    );
    return rows[0] ? mapCustomer(rows[0]) : null;
  }

  return {
    async list(limit = 50, offset = 0) {
      const rows = await driver.select<CustomerRow>(
        `SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE deleted_at IS NULL
         ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      return rows.map(mapCustomer);
    },

    async search(term, limit = 30, offset = 0) {
      const rows = await driver.select<CustomerRow>(
        `SELECT ${CUSTOMER_COLUMNS} FROM customers
         WHERE deleted_at IS NULL AND (name_folded LIKE ? OR phone LIKE ?)
         ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`,
        // "rocio" tiene que encontrar a "Rocío". El teléfono no se pliega:
        // son dígitos.
        [`%${foldForSearch(term)}%`, `%${term}%`, limit, offset],
      );
      return rows.map(mapCustomer);
    },

    async listDebtors(limit = 50, offset = 0) {
      // Usa la vista: materializa el agregado de TODO el ledger. Es una
      // consulta deliberada de "todo el negocio" detrás de un toggle, igual
      // que stock.levels() — NO es el listado por defecto de la pantalla.
      const rows = await driver.select<CustomerRow & { balance_cents: number }>(
        `SELECT c.id, c.name, c.phone, c.notes, c.credit_limit_cents,
                c.created_at, c.updated_at, c.deleted_at, b.balance_cents
         FROM customers c
         JOIN customer_balances b ON b.customer_id = c.id
         WHERE c.deleted_at IS NULL AND b.balance_cents > 0
         ORDER BY b.balance_cents DESC LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      return rows.map((r): CustomerWithBalance => ({
        ...mapCustomer(r),
        balanceCents: r.balance_cents,
      }));
    },

    getById,

    async countActive() {
      const rows = await driver.select<{ n: number }>(
        "SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL",
      );
      return rows[0]?.n ?? 0;
    },

    async count(term) {
      const trimmed = term?.trim() ?? "";
      const rows = trimmed === ""
        ? await driver.select<{ n: number }>(
            "SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL",
          )
        : await driver.select<{ n: number }>(
            `SELECT COUNT(*) AS n FROM customers
             WHERE deleted_at IS NULL AND (name_folded LIKE ? OR phone LIKE ?)`,
            [`%${foldForSearch(trimmed)}%`, `%${trimmed}%`],
          );
      return rows[0]?.n ?? 0;
    },

    async countDebtors() {
      const rows = await driver.select<{ n: number }>(
        `SELECT COUNT(*) AS n FROM customers c
         JOIN customer_balances b ON b.customer_id = c.id
         WHERE c.deleted_at IS NULL AND b.balance_cents > 0`,
      );
      return rows[0]?.n ?? 0;
    },

    async create(input) {
      const name = input.name.trim();
      if (name === "") throw new Error("El cliente necesita un nombre");
      const id = ctx.newId();
      const now = ctx.now();
      await driver.execute(
        `INSERT INTO customers (id, tenant_id, name, name_folded, phone, notes,
           credit_limit_cents, created_at, updated_at, device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, ctx.tenantId, name, foldForSearch(name),
          input.phone ?? null, input.notes ?? null,
          input.creditLimitCents ?? null, now, now, ctx.deviceId,
        ],
      );
      const created = await getById(id);
      if (!created) throw new Error("El cliente recién creado no se pudo releer");
      return created;
    },

    async update(id, patch) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const push = (column: string, value: unknown) => {
        sets.push(`${column} = ?`);
        params.push(value);
      };
      if (patch.name !== undefined) {
        // `name` y `name_folded` se mueven siempre juntas: si divergen, el
        // cliente queda buscable por un nombre que ya no tiene.
        push("name", patch.name.trim());
        push("name_folded", foldForSearch(patch.name.trim()));
      }
      if (patch.phone !== undefined) push("phone", patch.phone);
      if (patch.notes !== undefined) push("notes", patch.notes);
      if (patch.creditLimitCents !== undefined) push("credit_limit_cents", patch.creditLimitCents);
      if (sets.length === 0) return;
      push("updated_at", ctx.now());
      push("device_id", ctx.deviceId);
      params.push(id);
      await driver.execute(
        `UPDATE customers SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        params,
      );
    },

    async softDelete(id) {
      // Baja lógica: el ledger queda intacto. Si debía plata, la deuda sigue
      // existiendo (y vuelve a la vista si lo reactivás).
      const now = ctx.now();
      await driver.execute(
        "UPDATE customers SET deleted_at = ?, updated_at = ?, device_id = ? WHERE id = ? AND deleted_at IS NULL",
        [now, now, ctx.deviceId, id],
      );
    },

    async balancesFor(customerIds) {
      if (customerIds.length === 0) return [];
      // Contra la tabla (no la vista): el IN + GROUP BY lo resuelve solo el
      // índice cubriente idx_customer_movements_customer, sin tocar la tabla.
      const placeholders = customerIds.map(() => "?").join(", ");
      const rows = await driver.select<{ customer_id: string; balance: number }>(
        `SELECT customer_id, SUM(delta_cents) AS balance FROM customer_account_movements
         WHERE deleted_at IS NULL AND customer_id IN (${placeholders})
         GROUP BY customer_id`,
        customerIds,
      );
      return rows.map((r): CustomerBalance => ({
        customerId: r.customer_id,
        balanceCents: r.balance,
      }));
    },

    async balanceFor(customerId) {
      const rows = await driver.select<{ balance_cents: number | null }>(
        "SELECT balance_cents FROM customer_balances WHERE customer_id = ?",
        [customerId],
      );
      return rows[0]?.balance_cents ?? 0;
    },

    async totalDebt() {
      const rows = await driver.select<{ n: number; total: number | null }>(
        `SELECT COUNT(*) AS n, SUM(b.balance_cents) AS total
         FROM customer_balances b
         JOIN customers c ON c.id = b.customer_id
         WHERE c.deleted_at IS NULL AND b.balance_cents > 0`,
      );
      return { debtors: rows[0]?.n ?? 0, totalCents: rows[0]?.total ?? 0 };
    },

    async movementsFor(customerId, limit = 50, offset = 0) {
      const rows = await driver.select<MovementRow>(
        `SELECT ${MOVEMENT_COLUMNS} FROM customer_account_movements
         WHERE customer_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [customerId, limit, offset],
      );
      return rows.map(mapMovement);
    },

    async registerPayment(input) {
      if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
        throw new Error("El pago necesita un monto mayor a cero");
      }
      await driver.transaction(async (tx) => {
        await assertCustomerExists(tx, input.customerId);
        await insertAccountMovement(tx, ctx, {
          customerId: input.customerId,
          deltaCents: -input.amountCents, // pagar BAJA la deuda
          type: "payment",
          saleId: null,
          method: input.method,
          cashierId: input.cashierId ?? null,
          note: input.note ?? null,
        });
      });
    },

    async registerAdjustment(input) {
      if (!Number.isInteger(input.deltaCents) || input.deltaCents === 0) {
        throw new Error("El ajuste necesita un monto entero distinto de cero");
      }
      if (input.note.trim() === "") {
        throw new Error("El ajuste necesita un motivo");
      }
      await driver.transaction(async (tx) => {
        await assertCustomerExists(tx, input.customerId);
        await insertAccountMovement(tx, ctx, {
          customerId: input.customerId,
          deltaCents: input.deltaCents,
          type: "adjustment",
          saleId: null,
          method: null,
          cashierId: input.cashierId ?? null,
          note: input.note.trim(),
        });
      });
    },
  };
}

/**
 * Valida que el cliente exista y esté activo DENTRO de la transacción.
 * No se delega a la FK a propósito: el driver de escritorio usa un pool de
 * sqlx y no garantiza `PRAGMA foreign_keys` en todas las conexiones.
 */
export async function assertCustomerExists(tx: SqlExecutor, customerId: string): Promise<void> {
  const rows = await tx.select<{ id: string }>(
    "SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL",
    [customerId],
  );
  if (!rows[0]) throw new Error("Cliente inexistente");
}

/** Compartido con SalesRepo: un INSERT en el ledger de cuenta corriente.
 *  (Mismo rol que `insertMovement` para el ledger de stock.) */
export async function insertAccountMovement(
  tx: SqlExecutor,
  ctx: RepoContext,
  movement: {
    customerId: string;
    deltaCents: number;
    type: AccountMovementType;
    saleId: string | null;
    method: PaymentMethod | null;
    cashierId: string | null;
    note: string | null;
  },
): Promise<void> {
  const now = ctx.now();
  await tx.execute(
    `INSERT INTO customer_account_movements (id, tenant_id, customer_id, delta_cents, type,
       sale_id, note, cashier_id, method, created_at, updated_at, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ctx.newId(), ctx.tenantId, movement.customerId, movement.deltaCents, movement.type,
      movement.saleId, movement.note, movement.cashierId, movement.method,
      now, now, ctx.deviceId,
    ],
  );
}
