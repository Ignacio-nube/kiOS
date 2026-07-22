# ADR-001 — Reescritura limpia con kioskito como referencia

**Estado**: aceptada, 2026-07-22

## Contexto

kiOS es el mismo producto que kioskito (`Documents/kioskito`, v1 completa):
POS y stock para kioscos argentinos, Tauri 2 + React + SQLite. kioskito
validó el stack y la arquitectura de persistencia, pero su esquema es
single-tenant, mono-dispositivo, con stock como columna mutable e IDs
autoincrementales — incompatible con el objetivo de sync multi-terminal.

## Decisión

kiOS se escribe de cero (no se copia código) heredando las decisiones
VALIDADAS de kioskito: Tauri sobre Electron (ADR-001 de kioskito),
`SqlDriver` dual (ADR-002), centavos enteros (ADR-003), snapshots en
sale_items (ADR-004), y todos los gotchas operativos (promesa singleton
del bootstrap, assets sqlite-wasm sin hash, COOP/COEP, AsyncQueue).

Lo que kiOS hace distinto: esquema sync-ready desde el día uno (ADR-003
de kiOS), stock por ledger (ADR-004), licencias Ed25519 con entitlements
como datos (ADR-005), workspace de dos apps (ADR-006).

## Consecuencias

- El costo de la reescritura se paga una vez; la fase 2 (sync) se vuelve
  aditiva en lugar de imposible.
- kioskito queda como reserva de patrones probados; no se mantiene.
