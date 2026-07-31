# ADR-006 — Workspace de dos apps; capas por convención, no por package

**Estado**: aceptada, 2026-07-22

## Contexto

Escritorio, demo web y landing comparten identidad y (los dos primeros)
el 100% del código. kioskito demostró que desktop y demo conviven en UN
paquete con detección de driver en runtime; partir en packages (core/db/
ui/app) agregaría fricción de build sin beneficio real a esta escala.

## Decisión

npm workspaces con dos apps:

- `apps/app`: LA app (escritorio Y demo web, mismo bundle). Capas por
  convención de carpetas custodiadas por eslint `import/no-restricted-paths`:
  `domain/` (puro, no importa de nadie) ← `data/` (no conoce UI) ←
  `features/`/`ui/`/`lib/`. Los drivers solo se importan desde
  `data/drivers/detect.ts` (excepción explícita para el bootstrap).
- `apps/landing`: estático, Vite + Tailwind, sin React. URLs por entorno
  (`VITE_DEMO_URL`, `VITE_DOWNLOAD_URL`): el dominio se compra después.

Vercel: dos proyectos sobre el mismo repo (root `apps/app` con
`vercel.json` COOP/COEP para la demo; root `apps/landing` para la landing).

## Consecuencias

- Si mañana hiciera falta compartir código con otra app real (móvil),
  recién ahí se extraen packages — con las fronteras ya marcadas por las
  carpetas y el linter.

## Actualización — 2026-07-30: la landing se fue a su propio repo

`apps/landing` ya no vive acá: es **Ignacio-nube/kiOS-landing**, con su
propio `package.json`, su lock y su proyecto de Vercel.

Motivo: dejó de ser "estático, sin React". Ahora tiene React, Motion y
funciones serverless con secretos de Mercado Pago y de envío de mail — o
sea, un ciclo de deploy y una superficie de seguridad propios. Y en la
práctica no comparte NADA de código con la app: el único punto de contacto
es el formato de licencia, que la landing ya no necesita desde que el
servidor dejó de firmar (solo reenvía un código emitido a mano).

Lo que sigue valiendo de esta ADR: las capas por convención dentro de
`apps/app`, custodiadas por eslint. Lo que cambia: el workspace tiene una
sola app, y `scripts/generate-assets.mjs` escribe los favicons de la
landing solo si encuentra ese repo clonado al lado (o `KIOS_LANDING_DIR`).
La regla de fuente única del logo no se rompe — `logo-kiOS.svg` de este
repo sigue mandando sobre los dos, pero ahora hay que commitear en dos
lados.
