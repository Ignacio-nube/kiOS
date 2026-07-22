# ADR-005 — Licencias Ed25519 offline; entitlements como datos

**Estado**: aceptada, 2026-07-22

## Contexto

La activación no puede depender de un servidor (kioscos con internet
intermitente) y los límites del modo free tienen que poder crecer sin
tocar pantallas. No es DRM: es fricción honesta, reversible por un
usuario técnico.

## Decisión

- **Clave**: `KIOS-…` = base32 Crockford de `payload JSON ‖ firma Ed25519
  (64 bytes)`, en grupos de 5. La app embebe SOLO la clave pública
  (`domain/license.ts`); verifica 100% offline con `@noble/ed25519`.
  El decode base32 es estricto (bits de relleno en cero). Una clave
  inválida degrada a free en silencio: jamás rompe la caja.
- **Firmador**: CLI privado fuera del repo de la app; la clave privada
  nunca entra al repo.
- **Entitlements como DATOS** (`domain/entitlements.ts`): un único módulo
  devuelve `Entitlements` (hoy: `maxProducts: 50 | null`). Las pantallas
  consumen `useEntitlements()` y muestran límites; cero condicionales de
  licencia fuera del módulo. Sumar un límite = un campo nuevo.
- Al alcanzar el tope: se explica y se ofrece activar; lo ya cargado sigue
  funcionando y VENDER nunca se bloquea.

## Consecuencias

- Sin phone-home ni ofuscación; el vector de "crackeo" asumido y aceptado.
- El payload lleva `features` reservado: los entitlements pueden derivarse
  de la licencia sin cambiar el formato de clave.
