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

*(Revertida el mismo día. Se deja anotada porque explica por qué el
`vercel.json` de la raíz existe y por qué `api/` no está dentro de
`apps/landing`.)*

Se separó `apps/landing` a **Ignacio-nube/kiOS-landing** con la idea de que
ya no era "estático, sin React" y tenía secretos propios.

**Por qué se volvió atrás**: el costo real no estaba en el código sino en
la operación. Dos repos son dos proyectos de Vercel, dos juegos de
variables de entorno y dos dominios que mantener sincronizados, para un
producto que hace una sola persona. La ganancia teórica de aislar el
deploy no compensaba ese trabajo recurrente.

## Actualización — 2026-07-30 (2): todo vuelve a un repo y a UN deploy

Vuelve `apps/landing`, y además ahora **hay un solo proyecto de Vercel**
para todo:

- `/` → la landing
- `/demo` → la demo web (misma app que el escritorio, driver wasm)
- `/api/*` → checkout y webhook de Mercado Pago

Tres consecuencias que hay que respetar:

1. **`api/` vive en la RAÍZ del repo**, no bajo `apps/landing`. Es donde
   Vercel busca las funciones cuando el proyecto no tiene Root Directory.
2. **La demo se compila con `base=/demo/`** (`VITE_BASE_PATH` en
   `scripts/build-vercel.mjs`). Con el default `/`, su HTML pediría los
   assets a la raíz, que ahí sirve la landing: pantalla en blanco.
3. **COOP/COEP van scopeados a `/demo`**, no a todo el sitio. La demo los
   necesita para `SharedArrayBuffer` (VFS de OPFS); la landing no, y
   aislarla de más solo agrega formas de romperla.

Lo que sigue valiendo de la ADR original: las capas por convención dentro
de `apps/app`, custodiadas por eslint, y la regla de fuente única del logo
— que vuelve a ser trivial porque los dos destinos están en este repo.
