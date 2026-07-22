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
