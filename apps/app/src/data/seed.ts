/**
 * Productos de ejemplo para la demo web: se cargan una sola vez cuando
 * el catálogo está vacío, para poder probar sin cargar nada a mano.
 * Nombres genéricos (sin marcas) a propósito.
 */
import type { Repositories } from "./repos";

const DEMO_PRODUCTS = [
  { name: "Alfajor de chocolate", priceCents: 120000, costCents: 70000, barcode: "7790001000017", stock: 40 },
  { name: "Gaseosa cola 500ml", priceCents: 190000, costCents: 110000, barcode: "7790001000024", stock: 30 },
  { name: "Agua mineral 500ml", priceCents: 150000, costCents: 80000, barcode: "7790001000031", stock: 36 },
  { name: "Papas fritas", priceCents: 250000, costCents: 150000, barcode: "7790001000048", stock: 24 },
  { name: "Chicles menta", priceCents: 70000, costCents: 35000, barcode: "7790001000055", stock: 60 },
  { name: "Caramelos surtidos", priceCents: 40000, costCents: 18000, barcode: "7790001000062", stock: 80 },
  { name: "Cigarrillos 20u", priceCents: 850000, costCents: 700000, barcode: "7790001000079", stock: 15 },
  { name: "Fósforos", priceCents: 30000, costCents: 12000, barcode: "7790001000086", stock: 25, lowStockThreshold: 5 },
  { name: "Pilas AA x2", priceCents: 320000, costCents: 190000, barcode: "7790001000093", stock: 3, lowStockThreshold: 5 },
  { name: "Turrón de maní", priceCents: 100000, costCents: 55000, barcode: "7790001000109", stock: 20 },
  { name: "Chocolate con leche", priceCents: 260000, costCents: 160000, barcode: "7790001000116", stock: 18 },
  { name: "Barrita de cereal", priceCents: 180000, costCents: 100000, barcode: "7790001000123", stock: 0 },
] as const;

export async function seedDemoDataIfEmpty(repos: Repositories): Promise<void> {
  const existing = await repos.products.countActive();
  if (existing > 0) return;

  for (const p of DEMO_PRODUCTS) {
    await repos.products.create({
      name: p.name,
      priceCents: p.priceCents,
      costCents: p.costCents,
      barcode: p.barcode,
      lowStockThreshold: "lowStockThreshold" in p ? p.lowStockThreshold : null,
      initialStock: p.stock,
    });
  }
}
