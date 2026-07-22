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

export interface Repositories {
  products: ProductsRepo;
  sales: SalesRepo;
  stock: StockRepo;
  meta: MetaRepo;
}

export function createRepositories(driver: SqlDriver, ctx: RepoContext): Repositories {
  return {
    products: createProductsRepo(driver, ctx),
    sales: createSalesRepo(driver, ctx),
    stock: createStockRepo(driver, ctx),
    meta: createMetaRepo(driver),
  };
}

export type { ProductsRepo, SalesRepo, StockRepo, MetaRepo };
