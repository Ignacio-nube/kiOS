/**
 * Repositorio de MANTENIMIENTO: acciones de administración que no son parte
 * del flujo normal de la app, pensadas para Configuración —
 *   · seedSampleData: llena la base con un catálogo y ventas de ejemplo
 *     (repartidas en el último mes) para poder probar Reportes/Stock/Hoy.
 *   · clearSales: borra solo las ventas y su historial (libera lo que más
 *     crece), conservando productos y su stock inicial/reposiciones.
 *   · resetAll: deja la base como recién instalada (sin catálogo ni ventas),
 *     conservando identidad, licencia y ajustes (meta).
 *
 * Los borrados son DUROS (DELETE, no soft delete) porque el objetivo es
 * liberar espacio; después se corre VACUUM para devolverlo al disco. Es la
 * única parte de la app que borra de verdad, a pedido explícito del usuario.
 */
import type { SqlDriver, SqlExecutor } from "../driver";
import type { RepoContext } from "../context";
import type { PaymentMethod } from "../../domain/ticket";
import { defaultCashierName } from "../../domain/cashiers";

/** Categorías de ejemplo (orden = índice). */
const CATEGORIES = ["Golosinas", "Bebidas", "Cigarrillos", "Almacén", "Limpieza", "Varios"] as const;

/** Catálogo de ejemplo: [nombre, categoría, precio¢, costo¢, stock, umbralBajo?]. */
const CATALOG: [string, number, number, number, number, number?][] = [
  ["Alfajor de chocolate", 0, 120000, 70000, 48],
  ["Alfajor triple", 0, 160000, 95000, 30],
  ["Chocolate con leche", 0, 260000, 160000, 24],
  ["Turrón de maní", 0, 100000, 55000, 40],
  ["Caramelos surtidos x1", 0, 40000, 18000, 90],
  ["Chicles menta", 0, 70000, 35000, 60],
  ["Bombón helado", 0, 150000, 80000, 20, 6],
  ["Barrita de cereal", 0, 180000, 100000, 26],
  ["Chupetín", 0, 35000, 15000, 100],
  ["Gomitas", 0, 90000, 45000, 45],
  ["Gaseosa cola 500ml", 1, 190000, 110000, 36],
  ["Gaseosa lima 500ml", 1, 190000, 110000, 30],
  ["Gaseosa cola 2.25L", 1, 320000, 210000, 18],
  ["Agua mineral 500ml", 1, 150000, 80000, 40],
  ["Agua saborizada 1.5L", 1, 220000, 130000, 22],
  ["Jugo en caja", 1, 130000, 70000, 34],
  ["Cerveza lata 473ml", 1, 250000, 160000, 28],
  ["Energizante 250ml", 1, 300000, 190000, 16, 5],
  ["Isotónica 500ml", 1, 240000, 150000, 20],
  ["Cigarrillos 20u rubio", 2, 850000, 720000, 25],
  ["Cigarrillos 20u suave", 2, 850000, 720000, 20],
  ["Cigarrillos 10u", 2, 480000, 400000, 15, 5],
  ["Tabaco armar 30g", 2, 900000, 760000, 8, 4],
  ["Papelillos", 2, 60000, 25000, 30],
  ["Encendedor", 5, 90000, 45000, 40],
  ["Yerba 500g", 3, 350000, 240000, 24],
  ["Yerba 1kg", 3, 620000, 430000, 16],
  ["Azúcar 1kg", 3, 180000, 120000, 20],
  ["Fideos 500g", 3, 160000, 100000, 30],
  ["Arroz 1kg", 3, 190000, 120000, 26],
  ["Puré de tomate", 3, 140000, 85000, 28],
  ["Galletitas dulces", 3, 170000, 100000, 32],
  ["Galletitas de agua", 3, 150000, 90000, 30],
  ["Café instantáneo 50g", 3, 480000, 320000, 14],
  ["Té x25", 3, 210000, 130000, 18],
  ["Pan lactal", 3, 250000, 160000, 12, 4],
  ["Detergente 500ml", 4, 200000, 120000, 18],
  ["Lavandina 1L", 4, 160000, 95000, 20],
  ["Jabón en pan", 4, 90000, 50000, 26],
  ["Papel higiénico x4", 4, 280000, 180000, 22],
  ["Rollo de cocina", 4, 190000, 120000, 20],
  ["Servilletas x100", 4, 120000, 70000, 24],
  ["Pilas AA x2", 5, 320000, 190000, 12, 5],
  ["Pilas AAA x2", 5, 320000, 190000, 10, 5],
  ["Fósforos", 5, 30000, 12000, 30, 8],
  ["Preservativos x3", 5, 350000, 210000, 14],
  ["Curitas x10", 5, 110000, 60000, 20],
  ["Cuaderno chico", 5, 260000, 160000, 10],
  ["Birome azul", 5, 80000, 40000, 40],
  ["Caramelos de miel", 0, 45000, 20000, 70],
];

/** Distribución realista de kiosco: efectivo manda. */
const PAYMENT_WEIGHTED: PaymentMethod[] = [
  "cash", "cash", "cash", "cash", "cash", "card", "card", "qr", "qr", "transfer",
];

const DAYS_BACK = 30;

/** Cajeros de ejemplo (el primero se reemplaza por el nombre del negocio). */
const CASHIER_NAMES = ["Rocío", "Turno noche"];
/** Con qué peso aparece cada cajero en las ventas (índice del array). */
const CASHIER_WEIGHTS = [0, 0, 0, 0, 0, 1, 1, 1, 2, 2];

/** Clientes de ejemplo: [nombre, límite¢ | null]. */
const CUSTOMERS: [string, number | null][] = [
  ["Marta del 2º B", 2000000],
  ["Don Julio", 3000000],
  ["Sofi (la del kiosco de enfrente)", null],
  ["Ramón", 1000000],
  ["Vecina del 5º", 1500000],
  ["Nico", 500000],
  ["Familia Gómez", 3000000],
  ["Tito", null],
  ["Carla", 1000000],
  ["El del taller", 2500000],
  ["Susana", null],
  ["Pipa", 800000],
];

/** Proporción de ventas que se van fiadas. */
const CREDIT_SALE_RATIO = 0.08;

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** INSERT multi-fila: reparte `rows` en lotes chicos para no pasar el límite
 *  de variables de SQLite. Cada fila es un array de valores en orden de `cols`. */
async function insertRows(
  tx: SqlExecutor,
  table: string,
  cols: string[],
  rows: unknown[][],
): Promise<void> {
  if (rows.length === 0) return;
  const perRow = cols.length;
  const maxRowsPerStatement = Math.max(1, Math.floor(900 / perRow));
  const placeholderRow = `(${cols.map(() => "?").join(", ")})`;
  for (let i = 0; i < rows.length; i += maxRowsPerStatement) {
    const chunk = rows.slice(i, i + maxRowsPerStatement);
    await tx.execute(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${chunk.map(() => placeholderRow).join(", ")}`,
      chunk.flat(),
    );
  }
}

export interface DataCounts {
  products: number;
  sales: number;
  movements: number;
  customers: number;
  /** Cuánto deben todos los clientes juntos. */
  debtCents: number;
}

export interface SeedResult {
  products: number;
  sales: number;
  customers: number;
  cashiers: number;
}

export interface MaintenanceRepo {
  /** Cantidades actuales, para mostrar en Configuración. */
  counts(): Promise<DataCounts>;
  /** Llena la base con catálogo + ventas de ejemplo. Devuelve lo creado. */
  seedSampleData(): Promise<SeedResult>;
  /**
   * Borra ventas + su historial; conserva productos, stock cargado a mano y
   * LAS CUENTAS CORRIENTES (ver el comentario de la implementación).
   */
  clearSales(): Promise<void>;
  /** Deja la base vacía (sin catálogo ni ventas); conserva meta/licencia. */
  resetAll(): Promise<void>;
}

export function createMaintenanceRepo(driver: SqlDriver, ctx: RepoContext): MaintenanceRepo {
  async function vacuum(): Promise<void> {
    // VACUUM no puede ir dentro de una transacción; si el driver lo rechaza,
    // no es fatal (los datos ya se borraron), solo no se recupera el espacio.
    try {
      await driver.execute("VACUUM");
    } catch {
      // best-effort
    }
  }

  return {
    async counts() {
      const [p, s, m, c, d] = await Promise.all([
        driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE deleted_at IS NULL"),
        driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM sales WHERE deleted_at IS NULL"),
        driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM stock_movements"),
        driver.select<{ n: number }>("SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL"),
        driver.select<{ total: number | null }>(
          `SELECT SUM(b.balance_cents) AS total FROM customer_balances b
           JOIN customers c ON c.id = b.customer_id
           WHERE c.deleted_at IS NULL AND b.balance_cents > 0`,
        ),
      ]);
      return {
        products: p[0]?.n ?? 0,
        sales: s[0]?.n ?? 0,
        movements: m[0]?.n ?? 0,
        customers: c[0]?.n ?? 0,
        debtCents: d[0]?.total ?? 0,
      };
    },

    async seedSampleData() {
      const { tenantId, deviceId } = ctx;

      // El arranque de la app ya corrió `cashiers.ensureDefault` antes de que
      // el usuario llegue a este botón, así que casi siempre hay un cajero
      // "Principal" creado. Reutilizarlo evita un "Principal" duplicado; solo
      // se crea uno nuevo con el nombre del negocio si de verdad no hay ninguno.
      const existingCashiers = await driver.select<{ id: string; name: string }>(
        "SELECT id, name FROM cashiers WHERE deleted_at IS NULL ORDER BY created_at",
      );
      const businessName = (await driver.select<{ value: string }>(
        "SELECT value FROM meta WHERE key = 'business_name'",
      ))[0]?.value ?? "";
      const newCashierNames = existingCashiers.length > 0
        ? CASHIER_NAMES
        : [defaultCashierName(businessName), ...CASHIER_NAMES];
      const newCashiers = newCashierNames.map((name) => ({ id: ctx.newId(), name }));
      const cashiers = [...existingCashiers, ...newCashiers];

      const customers = CUSTOMERS.map(([name, limit]) => ({
        id: ctx.newId(),
        name,
        creditLimitCents: limit,
        /** Se va acumulando al fiar, para poder construir los casos límite. */
        owed: 0,
      }));

      // IDs de categorías y productos generados antes de tocar la base, así
      // las ventas pueden referenciarlos sin releer.
      const categoryIds = CATEGORIES.map(() => ctx.newId());
      const products = CATALOG.map(([name, cat, price, cost, stock, low]) => ({
        id: ctx.newId(),
        name,
        categoryId: categoryIds[cat]!,
        priceCents: price,
        costCents: cost,
        stock,
        low: low ?? null,
        barcode: `779${String(randInt(1000000, 9999999))}`,
      }));

      let salesCount = 0;

      await driver.transaction(async (tx) => {
        const now = ctx.now();

        // Cajeros nuevos (van primero: las ventas los referencian). Los que
        // ya existían de antes NO se reinsertan.
        await insertRows(
          tx, "cashiers",
          ["id", "tenant_id", "name", "created_at", "updated_at", "device_id"],
          newCashiers.map((c) => [c.id, tenantId, c.name, now, now, deviceId]),
        );

        // Clientes de cuenta corriente.
        await insertRows(
          tx, "customers",
          ["id", "tenant_id", "name", "credit_limit_cents", "created_at", "updated_at", "device_id"],
          customers.map((c) => [c.id, tenantId, c.name, c.creditLimitCents, now, now, deviceId]),
        );

        // Categorías.
        await insertRows(
          tx, "categories",
          ["id", "tenant_id", "name", "sort_order", "created_at", "updated_at", "device_id"],
          CATEGORIES.map((name, i) => [categoryIds[i], tenantId, name, i, now, now, deviceId]),
        );

        // Productos + su stock inicial (movimiento `initial` en el ledger).
        await insertRows(
          tx, "products",
          ["id", "tenant_id", "name", "barcode", "price_cents", "cost_cents", "category_id",
            "low_stock_threshold", "created_at", "updated_at", "device_id"],
          products.map((p) => [
            p.id, tenantId, p.name, p.barcode, p.priceCents, p.costCents, p.categoryId,
            p.low, now, now, deviceId,
          ]),
        );
        await insertRows(
          tx, "stock_movements",
          ["id", "tenant_id", "product_id", "qty_delta", "type", "sale_id", "note",
            "created_at", "updated_at", "device_id"],
          products.map((p) => [
            ctx.newId(), tenantId, p.id, p.stock, "initial", null, null, now, now, deviceId,
          ]),
        );

        // Ventas repartidas en los últimos DAYS_BACK días.
        const base = new Date();
        for (let d = 0; d < DAYS_BACK; d++) {
          const perDay = randInt(4, 14);
          for (let k = 0; k < perDay; k++) {
            const when = new Date(
              base.getFullYear(), base.getMonth(), base.getDate() - d,
              randInt(8, 21), randInt(0, 59), randInt(0, 59),
            ).toISOString();

            const saleId = ctx.newId();
            const lineCount = randInt(1, 4);
            const chosen = new Set<number>();
            while (chosen.size < lineCount) chosen.add(randInt(0, products.length - 1));

            let total = 0;
            const itemRows: unknown[][] = [];
            const moveRows: unknown[][] = [];
            for (const idx of chosen) {
              const p = products[idx]!;
              const qty = randInt(1, 3);
              total += p.priceCents * qty;
              itemRows.push([
                ctx.newId(), tenantId, saleId, p.id, p.name, p.priceCents, p.costCents, qty,
                when, when, deviceId,
              ]);
              moveRows.push([
                ctx.newId(), tenantId, p.id, -qty, "sale", saleId, null, when, when, deviceId,
              ]);
            }

            const cashier = cashiers[pick(CASHIER_WEIGHTS)]!;
            // Una de cada ~12 ventas se va fiada.
            const fiadoA = Math.random() < CREDIT_SALE_RATIO ? pick(customers) : null;

            await tx.execute(
              `INSERT INTO sales (id, tenant_id, total_cents, created_at, updated_at, device_id,
                 cashier_id, customer_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [saleId, tenantId, total, when, when, deviceId, cashier.id, fiadoA?.id ?? null],
            );
            await insertRows(
              tx, "sale_items",
              ["id", "tenant_id", "sale_id", "product_id", "product_name", "unit_price_cents",
                "cost_cents", "qty", "created_at", "updated_at", "device_id"],
              itemRows,
            );
            await insertRows(
              tx, "stock_movements",
              ["id", "tenant_id", "product_id", "qty_delta", "type", "sale_id", "note",
                "created_at", "updated_at", "device_id"],
              moveRows,
            );
            await tx.execute(
              `INSERT INTO sale_payments (id, tenant_id, sale_id, method, amount_cents,
                 created_at, updated_at, device_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                ctx.newId(), tenantId, saleId,
                fiadoA ? "credit" : pick(PAYMENT_WEIGHTED),
                total, when, when, deviceId,
              ],
            );
            // La deuda entra al ledger igual que en una venta real.
            if (fiadoA) {
              await tx.execute(
                `INSERT INTO customer_account_movements (id, tenant_id, customer_id, delta_cents,
                   type, sale_id, note, cashier_id, method, created_at, updated_at, device_id)
                 VALUES (?, ?, ?, ?, 'credit_sale', ?, NULL, ?, NULL, ?, ?, ?)`,
                [ctx.newId(), tenantId, fiadoA.id, total, saleId, cashier.id, when, when, deviceId],
              );
              fiadoA.owed += total;
            }
            salesCount++;
          }
        }

        // ── Pagos de deuda ──────────────────────────────────────────────
        // Para que los datos de ejemplo tengan las tres situaciones reales:
        // gente al día, gente debiendo y alguno pasado de límite. Los casos
        // límite se CONSTRUYEN, no se dejan al azar: si dependieran de
        // Math.random, la mitad de las veces no habría nada que mirar.
        const conDeuda = customers.filter((c) => c.owed > 0);
        const excedidos = new Set<string>();
        // Los dos que más deben quedan excedidos: no se les cobra nada y se
        // les fuerza el límite por debajo de lo que deben.
        for (const c of [...conDeuda].sort((a, b) => b.owed - a.owed).slice(0, 2)) {
          excedidos.add(c.id);
          const limite = Math.max(10000, Math.floor(c.owed * 0.6));
          await tx.execute(
            "UPDATE customers SET credit_limit_cents = ? WHERE id = ?",
            [limite, c.id],
          );
        }

        const cobrarA = conDeuda.filter((c) => !excedidos.has(c.id));
        const pagar = async (cliente: { id: string }, monto: number) => {
          if (monto <= 0) return;
          const when = new Date(Date.now() - randInt(0, 5) * 86_400_000).toISOString();
          await tx.execute(
            `INSERT INTO customer_account_movements (id, tenant_id, customer_id, delta_cents,
               type, sale_id, note, cashier_id, method, created_at, updated_at, device_id)
             VALUES (?, ?, ?, ?, 'payment', NULL, NULL, ?, ?, ?, ?, ?)`,
            [
              ctx.newId(), tenantId, cliente.id, -monto,
              pick(cashiers).id, pick(PAYMENT_WEIGHTED), when, when, deviceId,
            ],
          );
        };

        // Uno paga de MÁS y queda con saldo a favor. Va FUERA del sorteo de
        // abajo a propósito: si dependiera de Math.random, la mitad de las
        // veces no existiría el caso y no habría nada que mirar en la UI.
        const conSaldoAFavor = cobrarA[0];
        if (conSaldoAFavor) {
          await pagar(conSaldoAFavor, conSaldoAFavor.owed + randInt(50000, 150000));
        }

        // El resto: ~60% paga una parte, ~40% queda debiendo todo.
        for (const cliente of cobrarA.slice(1)) {
          if (Math.random() > 0.6) continue;
          await pagar(cliente, Math.floor(cliente.owed * (randInt(30, 100) / 100)));
        }
      });

      return {
        products: products.length,
        sales: salesCount,
        customers: customers.length,
        cashiers: cashiers.length,
      };
    },

    async clearSales() {
      await driver.transaction(async (tx) => {
        // Orden hijo→padre por las FKs.
        await tx.execute("DELETE FROM sale_payments");
        await tx.execute("DELETE FROM sale_items");
        await tx.execute("DELETE FROM stock_movements WHERE type IN ('sale', 'void_reversal')");
        await tx.execute("DELETE FROM sales");
        // ⚠ `customer_account_movements` NO se toca a propósito.
        //
        // Una deuda es plata que le deben al kiosquero. Este botón se ofrece
        // como "liberar espacio conservando el catálogo": quien lo aprieta
        // para que la app vaya más rápido estaría perdonando en silencio
        // todas las deudas, sin forma de recuperarlas.
        //
        // Es la misma lógica que ya aplicamos al stock: se borra el HISTORIAL
        // DE VENTAS, no el ESTADO del negocio (acá quedan los movimientos
        // initial/restock/adjustment, allá los saldos de cuenta corriente).
        //
        // Técnicamente es gratis: `sale_id` en ese ledger no tiene REFERENCES
        // (igual que en stock_movements), así que borrar las ventas no viola
        // ninguna FK. Queda apuntando a una venta inexistente, y la UI del
        // detalle de cuenta tolera ese caso.
        //
        // Para borrar TODO, incluidas las deudas, está `resetAll`.
      });
      await vacuum();
    },

    async resetAll() {
      await driver.transaction(async (tx) => {
        // Todo el dato de negocio, en orden hijo→padre. meta queda intacta
        // (identidad, licencia, nombre del negocio, tema).
        await tx.execute("DELETE FROM sale_payments");
        await tx.execute("DELETE FROM sale_items");
        await tx.execute("DELETE FROM stock_movements");
        await tx.execute("DELETE FROM customer_account_movements");
        // sales referencia cashiers y customers: va antes que ellos.
        await tx.execute("DELETE FROM sales");
        await tx.execute("DELETE FROM customers");
        await tx.execute("DELETE FROM cashiers");
        await tx.execute("DELETE FROM products");
        await tx.execute("DELETE FROM categories");
      });
      await vacuum();
    },
  };
}
