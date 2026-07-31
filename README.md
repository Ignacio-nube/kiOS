# kiOS

Gestión para kioscos argentinos: vender rápido, llevar el stock, fiar y ver
cuánto se vendió hoy. Escritorio (Tauri + SQLite local) con demo 100% en el
navegador. Sin cuentas ni internet obligatoria.

La landing (**kios.click**) vive en un repo aparte:
**[Ignacio-nube/kiOS-landing](https://github.com/Ignacio-nube/kiOS-landing)**.

## Estructura

```
apps/app        la app (escritorio Y demo web: mismo bundle, driver en runtime)
  src/domain    lógica pura (dinero, ticket, stock, cuentas, licencias)
  src/data      SqlDriver + drivers (tauri/wasm) + migraciones + repositorios
  src/ui        design system propio + shadcn selectivo (ui/shadcn)
  src/features  pantallas
  src-tauri     shell Rust (plugins sql + fs)
scripts/license firmador y verificador de códigos de activación
docs/adr        decisiones de arquitectura (leer 003: esquema sync-ready)
docs/LANZAMIENTO.md  qué falta para vender
kios-design     skill del design system — leer antes de tocar UI
```

## Comandos (desde la raíz)

```
npm run dev            # demo web en http://localhost:1420
npm run tauri dev      # app de escritorio
npm test               # unit + integración (vitest + better-sqlite3)
npm run bench          # benchmarks de los ledgers (stock y cuenta corriente)
npm run lint           # eslint (incluye las reglas de capas)
npm run build:web      # build de la demo (deploy Vercel, root apps/app)

npm run license:keygen                    # par Ed25519 (una vez en la vida)
npm run license:sign -- "kiOS"            # emite un código de activación
npm run license:verify -- "KIOS-…"        # valida contra la clave de la app
```

## Reglas no negociables

- Dinero en centavos enteros. IDs UUIDv7 de cliente. Borrado lógico.
- El stock es un ledger append-only; el actual es la vista `current_stock`.
  El fiado usa el MISMO patrón, con el signo invertido: en la cuenta
  corriente, delta positivo aumenta la deuda.
- Toda escritura pasa por `src/data/repos/` (lo custodia eslint): es lo
  que hace posible el sync de fase 2 sin reescribir nada.
- UI: leer `kios-design/SKILL.md` antes de tocar nada visual.

## Deploy

Proyecto Vercel sobre este repo con Root Directory `apps/app` y build
`npm run build:web`. Los headers COOP/COEP de `apps/app/vercel.json` no son
opcionales: sin ellos SQLite WASM no puede usar OPFS y la demo pierde los
datos al recargar.

Dominio: `demo.kios.click`.
