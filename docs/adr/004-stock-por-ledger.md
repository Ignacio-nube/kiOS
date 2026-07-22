# ADR-004 — Stock por ledger append-only

**Estado**: aceptada, 2026-07-22

## Contexto

kioskito usa `products.stock` mutable (`UPDATE … SET stock = stock - ?`).
Funciona mono-terminal, pero con dos cajas offline el contador diverge sin
manera de reconciliar, y no hay historia de POR QUÉ cambió el stock.

## Decisión

No existe columna de stock. `stock_movements` es un ledger append-only:
`qty_delta` con signo + `type` (`sale`, `restock`, `adjustment`,
`shrinkage`, `initial`, `void_reversal`) + `sale_id` opcional. El stock
actual es la vista `current_stock` (`SUM(qty_delta) GROUP BY product_id`).

- El stock PUEDE quedar negativo: una venta jamás se bloquea por
  inventario; el kiosquero corrige con un ajuste.
- Índice cubriente parcial `(product_id, qty_delta) WHERE deleted_at IS
  NULL`: la vista se resuelve solo con el índice.
- El fiado usa el mismo patrón (`customer_account_movements`).

## Consecuencias

- Multi-terminal: dos cajas venden offline y el merge es la unión de
  movimientos — el total converge solo, sin resolución de conflictos.
- Auditoría gratis: cada cambio tiene fecha, motivo y dispositivo.
- Costo: el stock es una agregación. Medido con 1.000.000 de movimientos
  (~6-7 años de kiosco): vista completa ~108 ms, un producto ~0,3 ms,
  totales del día ~0,03 ms. Si algún día molesta, se agrega snapshot
  periódico (movimiento `initial` + archivado) — decisión diferida.
