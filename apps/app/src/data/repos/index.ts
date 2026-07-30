/**
 * Fábrica de repositorios: la ÚNICA puerta de escritura de la app
 * (regla A del plan). En fase 2, acá se envuelven con el SyncDecorator
 * que registra cada escritura en la tabla outbox — sin tocar nada más.
 */
import type { SqlDriver } from "../driver";
import type { RepoContext } from "../context";
import { createProductsRepo, type ProductsRepo } from "./products";
import { createSalesRepo, type SalesRepo } from "./sales";
import { createStockRepo, type StockRepo } from "./stock";
import { createMetaRepo, type MetaRepo } from "./meta";
import { createMaintenanceRepo, type MaintenanceRepo } from "./maintenance";
import { createCustomersRepo, type CustomersRepo } from "./customers";
import { createCashiersRepo, type CashiersRepo } from "./cashiers";

export interface Repositories {
  products: ProductsRepo;
  sales: SalesRepo;
  stock: StockRepo;
  meta: MetaRepo;
  /** Clientes y cuenta corriente (fiado). */
  customers: CustomersRepo;
  /** Quién atiende la caja (solo identidad, sin permisos). */
  cashiers: CashiersRepo;
  /** Acciones de administración (datos de ejemplo, borrado, reset). */
  maintenance: MaintenanceRepo;
}

export function createRepositories(driver: SqlDriver, ctx: RepoContext): Repositories {
  return {
    products: createProductsRepo(driver, ctx),
    sales: createSalesRepo(driver, ctx),
    stock: createStockRepo(driver, ctx),
    meta: createMetaRepo(driver),
    customers: createCustomersRepo(driver, ctx),
    cashiers: createCashiersRepo(driver, ctx),
    maintenance: createMaintenanceRepo(driver, ctx),
  };
}

export type {
  ProductsRepo, SalesRepo, StockRepo, MetaRepo, CustomersRepo, CashiersRepo, MaintenanceRepo,
};
