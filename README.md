# kiOS

Gestión para kioscos argentinos: vender rápido, llevar el stock y ver
cuánto se vendió hoy. Escritorio (Tauri + SQLite local) con demo 100% en
el navegador. Sin cuentas ni internet obligatoria en v1.

## Estructura

```
apps/app       la app (escritorio Y demo web: mismo bundle, driver en runtime)
  src/domain   lógica pura (dinero, ticket, stock, licencias, entitlements)
  src/data     SqlDriver + drivers (tauri/wasm) + migraciones + repositorios
  src/ui       design system propio + shadcn selectivo (ui/shadcn)
  src/features pantallas
  src-tauri    shell Rust (plugins sql + fs)
apps/landing   landing estática (Vite + Tailwind)
docs/adr       decisiones de arquitectura (leer 003: esquema sync-ready)
kios-design    skill del design system — leer antes de tocar UI
```

## Comandos (desde la raíz)

```
npm run dev            # demo web en http://localhost:1420
npm run tauri dev      # app de escritorio
npm test               # unit + integración (vitest + better-sqlite3)
npm run bench          # benchmark del ledger de stock (1M movimientos)
npm run lint           # eslint (incluye las reglas de capas)
npm run build:web      # build de la demo (deploy Vercel, root apps/app)
npm run build:landing  # build de la landing (deploy Vercel, root apps/landing)
```

## Reglas no negociables

- Dinero en centavos enteros. IDs UUIDv7 de cliente. Borrado lógico.
- El stock es un ledger append-only; el actual es la vista `current_stock`.
- Toda escritura pasa por `src/data/repos/` (lo custodia eslint): es lo
  que hace posible el sync de fase 2 sin reescribir nada.
- UI: leer `kios-design/SKILL.md` antes de tocar nada visual.

## Deploy

Dos proyectos Vercel sobre este repo: demo (`apps/app`, `npm run build:web`,
headers COOP/COEP en `vercel.json`) y landing (`apps/landing`). URLs por
entorno: `VITE_DEMO_URL`, `VITE_DOWNLOAD_URL`.
