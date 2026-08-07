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

### Notificaciones de Mercado Pago

`api/checkout.ts` manda un `notification_url` en cada preferencia, y según
la [documentación de MP](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/notifications/webhooks)
**ése tiene precedencia** sobre lo que se configure en el panel. Registrar
el webhook en *Tus integraciones → tu app → Webhooks* (evento **Pagos**) es
opcional, pero conviene: cubre preferencias creadas por fuera de este
código.

> ⚠️ **La trampa del `www`.** Mercado Pago **no sigue redirects** al
> notificar. Si el `notification_url` apunta a un host que responde 301/308
> —por ejemplo `kios.click` cuando el canónico en Vercel es
> `www.kios.click`— la notificación **nunca llega**, MP no reporta el error
> en ningún lado, y en los logs no aparece ni un solo hit al webhook. Es
> exactamente esto lo que pasó la primera vez.
>
> Por eso el origen ya **no** sale de `PUBLIC_SITE_URL` sino del pedido que
> llega al servidor (`api/_lib/site-url.ts`): si el comprador está en el
> host canónico, ése es el que se usa. `PUBLIC_SITE_URL` quedó solo como
> señal — si difiere, se avisa en los logs.
>
> Para verificarlo: `/api/checkout` loguea `checkout: notification_url …`
> en cada compra. Tiene que decir el host canónico, sin barra final.

**Red de seguridad**: si el webhook igual no llega, `/gracias` llama a
`POST /api/claim` con el `payment_id` que MP pone en la URL de vuelta. Ese
endpoint reconsulta el pago contra la API de MP y, si está aprobado y por
el monto correcto, manda el código. No le cree nada al navegador: el mail
de destino sale del `external_reference` guardado al crear la preferencia.

Además **muestra el código en pantalla**, no solo lo manda por mail. El
peor resultado de todo el flujo es que alguien pague y se quede sin nada,
y el mail falla por cosas que no controlamos (Resend caído, dominio sin
verificar, la casilla mal escrita por el propio comprador). Se muestra
recién después de que MP confirmó el pago, y no agrega exposición: el
código es uno solo para todos y ya está en `docs/CODIGO-ACTIVACION.md`.

### Probar el mail sin hacer una compra

```bash
RESEND_API_KEY=re_… MAIL_FROM="kiOS <info@kios.click>" \
  npm run email:test -- vos@ejemplo.com
```

Manda el mail real —mismo template, mismo remitente, y el código leído de
`docs/CODIGO-ACTIVACION.md`— sin pasar por Mercado Pago. Sirve para separar
"falla el webhook" de "falla Resend", que es imposible de distinguir
mirando solo el resultado final.

> Si Resend rechaza con 403 o solo llegan mails a tu propia casilla, es que
> el dominio todavía no está verificado ahí.
