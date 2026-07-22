# ADR-002 — Un solo juego de repositorios sobre la interfaz `SqlDriver`

**Estado**: aceptada, 2026-07-22 (heredada de kioskito ADR-002)

## Contexto

La misma app corre en escritorio (SQLite nativo vía tauri-plugin-sql), en
el navegador como demo (sqlite-wasm) y en tests (better-sqlite3). Duplicar
queries por target sería triplicar bugs.

## Decisión

La frontera portable es la interfaz mínima `SqlDriver`
(`apps/app/src/data/driver.ts`): `execute` / `select` / `transaction` /
`backupDatabase` / `close`. Un solo juego de repositorios por encima; tres
drivers por debajo. Reglas del contrato:

- Parámetros SIEMPRE por placeholders `?`.
- `transaction` = `BEGIN IMMEDIATE … COMMIT`, `ROLLBACK` en catch,
  re-throw del error original.
- Toda operación pasa por la `AsyncQueue`: el pool sqlx de tauri-plugin-sql
  repartiría queries concurrentes entre conexiones y partiría transacciones.
- Sin `lastInsertId` en el contrato: los IDs son UUIDv7 de cliente.

La selección de driver es en runtime (`detect.ts`, `__TAURI_INTERNALS__`)
con `import()` dinámico: mismo bundle, cada target baja solo su driver.

## Consecuencias

- La demo web comparte el 100% de la lógica con escritorio por diseño.
- Los tests de integración corren las queries reales contra SQLite real.
- En fase 2, el SyncDecorator envuelve repositorios, no drivers.
