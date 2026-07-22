# ADR-003 — Esquema sync-ready desde el día uno

**Estado**: aceptada, 2026-07-22

## Contexto

La v1 es solo escritorio, sin nube. Pero la fase 2 agrega Supabase con
2+ terminales por kiosco escribiendo offline. Si el esquema no nace
preparado, la fase 2 es una reescritura.

## Decisión

Cinco reglas de esquema en TODA tabla de datos:

1. El stock es un ledger append-only (ver ADR-004), nunca columna mutable.
2. PKs `TEXT` = UUIDv7 generados en cliente (`domain/ids.ts`). Nunca
   autoincremental: dos terminales no pueden chocar en IDs.
3. Borrado lógico con `deleted_at`. Nunca DELETE físico (los tombstones se
   sincronizan como cualquier update). Única excepción: `meta`, que es
   config local no sincronizable.
4. `tenant_id` en toda tabla, aunque localmente valga siempre lo mismo.
5. `created_at`, `updated_at` (ISO-8601 UTC) y `device_id` en toda tabla.

Más tres reglas de protocolo, sin las cuales las cinco no alcanzan:

- **A. Toda escritura pasa por el repositorio** (`data/repos/`). Lo
  custodia eslint (`import/no-restricted-paths`). Es lo que permite
  insertar el outbox de fase 2 con un decorator sin tocar dominio ni UI.
- **B. Los hechos son inmutables**: ventas, items, pagos y movimientos
  jamás se UPDATEan. Anular una venta = transición única
  `voided_at NULL→valor` + movimientos compensatorios `void_reversal`.
  Así el sync de hechos es upsert idempotente por id (cero conflictos) y
  solo el catálogo (products, categories, customers) necesita LWW por
  `updated_at` con desempate por `device_id`.
- **C. Unicidad blanda**: `barcode` sin UNIQUE duro; el dominio advierte
  duplicados. Dos terminales offline pueden crear el mismo barcode y el
  merge no debe romperse; el server de fase 2 los marca para resolución.

El pull de fase 2 se cursa por `server_received_at` (reloj del server),
nunca por `updated_at` (relojes locales no confiables).

## Consecuencias

- Fase 2 = agregar tabla outbox + decorator + endpoints + auth. Ni el
  dominio, ni la UI, ni el esquema existente se tocan.
- El esquema Supabase espejo (con RLS por tenant vía memberships) quedó
  validado contra el proyecto real el 2026-07-22 (DDL en BEGIN…ROLLBACK).
