# kiOS

Gestión para kioscos argentinos: vender rápido, llevar el stock, fiar y ver
cuánto se vendió hoy. Escritorio (Tauri + SQLite local) con demo 100% en el
navegador. Sin cuentas ni internet obligatoria.

## Estructura

```
apps/app        la app (escritorio Y demo web: mismo bundle, driver en runtime)
  src/domain    lógica pura (dinero, ticket, stock, cuentas, licencias)
  src/data      SqlDriver + drivers (tauri/wasm) + migraciones + repositorios
  src/ui        design system propio + shadcn selectivo (ui/shadcn)
  src/features  pantallas
  src-tauri     shell Rust (plugins sql + fs)
apps/landing    kios.click — la página que vende (React + Vite + Motion)
api/            funciones serverless del flujo de compra (Mercado Pago)
scripts/        assets del logo, builds y firmador de licencias
docs/adr        decisiones de arquitectura (leer 003: esquema sync-ready)
docs/LANZAMIENTO.md   qué falta para vender
kios-design     skill del design system — leer antes de tocar UI
```

`api/` está en la raíz y no dentro de `apps/landing` porque es ahí donde
Vercel busca las funciones cuando el proyecto no tiene Root Directory.

## Comandos (desde la raíz)

```
npm run dev            # app / demo web en http://localhost:1420
npm run dev:landing    # landing en http://localhost:1430
npm run tauri dev      # app de escritorio

npm test               # tests de la app + de api/
npm run lint           # eslint (incluye las reglas de capas)
npm run typecheck      # landing + api/

npm run build:vercel   # arma dist/ con la landing en / y la demo en /demo
npm run build:installer  # instalador de Windows, listo para Google Drive

npm run license:keygen             # par Ed25519 (una vez en la vida)
npm run license:sign -- "kiOS"     # emite un código de activación
npm run license:verify -- "KIOS-…" # valida contra la clave de la app
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

**Un solo proyecto de Vercel** sobre este repo.

> ⚠️ **Root Directory: vacío** (la raíz del repo). Es el error más fácil de
> cometer y el más confuso de diagnosticar: si apunta a `apps/app`, Vercel
> no ve la landing, ni `api/`, ni este `vercel.json` — despliega solo la
> demo y todo lo demás "desaparece" sin ningún error.

El `vercel.json` de la raíz ya trae build command, salida y headers; en la
interfaz solo se cargan las variables de entorno (importá `.env.example`
directo desde *Settings → Environment Variables → Import .env*).

| Ruta | Qué sirve |
|---|---|
| `/` | la landing |
| `/demo` | la demo web |
| `/api/*` | checkout y webhook de Mercado Pago |

### Por qué el `vercel.json` es como es

No tiene comentarios porque **no puede**: JSON no los soporta, y Vercel
valida el archivo contra un esquema que rechaza cualquier propiedad que no
conozca — incluido el truco de meter una clave `"//"`. Las razones van acá.

- **COOP/COEP en `/demo`**: sin esos dos headers no hay
  `SharedArrayBuffer`, el VFS de OPFS de sqlite-wasm no arranca, y la demo
  cuelga en el spinner o pierde los datos al recargar. Van scopeados a
  `/demo` a propósito: la landing no los necesita y aislarla de más solo
  agrega formas de romperla. Están duplicados para `/demo` y `/demo/:path*`
  porque el documento se sirve con y sin barra final.
- **Rewrite de `/gracias`**: es el `back_url` de Mercado Pago y la landing
  es un SPA de un solo `index.html`. Sin esto, el cliente que acaba de
  pagar se come un 404.
- **`cache-control` inmutable solo en `/assets`, no en `/demo/assets`**:
  los de la landing llevan hash en el nombre, pero `sqlite3.wasm` y
  `sqlite3-opfs-async-proxy.js` salen SIN hash a propósito (ver el
  `vite.config` de la app). Cachearlos para siempre dejaría la demo clavada
  en una versión vieja.

Después del deploy hay que dar de alta el webhook en Mercado Pago apuntando
a `https://kios.click/api/webhook`, evento **Pagos**.
