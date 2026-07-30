# kiOS — qué falta para vender

Estado al **30 de julio de 2026**. La app funciona de punta a punta y la
landing está lista; lo que falta es casi todo *alrededor* del producto.

Cada punto dice **por qué** bloquea, no solo qué hacer. Los ✅ ya están.

---

## 🔴 Bloqueantes: sin esto no se puede cobrar

### 1. Generar las claves y emitir el código compartido

`apps/app/src/domain/license.ts` todavía tiene la clave pública
**placeholder (64 ceros)**. Con eso, *ninguna* licencia funciona: la app
rechaza cualquier código y degrada a plan gratis en silencio.

```bash
npm run license:keygen                                   # una sola vez
LICENSE_PRIVATE_KEY_HEX=… npm run license:sign -- "kiOS" # el código compartido
npm run license:verify -- "KIOS-…"                       # antes de publicarlo
```

- La **pública** va a `apps/app/src/domain/license.ts`.
- La **privada** va a tu gestor de contraseñas. **No** al hosting.
- El **código** emitido va a `SHARED_LICENSE_KEY` en el hosting.

> El servidor no firma nada: solo reenvía ese código por mail. Por eso la
> clave privada no necesita existir ahí — si te entran al hosting se llevan
> un código que ya circula, no la máquina de fabricar códigos.

**Rotación** (cuando el código circule demasiado): claves nuevas → app
nueva → código nuevo → actualizar `SHARED_LICENSE_KEY`. Los clientes que ya
activaron **no se ven afectados**: la app exige la verificación una sola
vez y después guarda una constancia local (`meta.license_activation`).
Detalle completo en `scripts/license/README.md`.

✅ Ya está: firmador, verificador, el mecanismo de constancia y los tests.

### 2. Credenciales de Mercado Pago

En **Tus integraciones → Credenciales de producción**:

| Variable | Dónde sale |
|---|---|
| `MP_ACCESS_TOKEN` | Access token de producción |
| `MP_WEBHOOK_SECRET` | Webhooks → "Firma secreta" |

El webhook hay que darlo de alta apuntando a `https://TU-DOMINIO/api/webhook`,
evento **Pagos**.

> La firma **no es opcional**: el webhook es una URL pública que emite
> licencias. Sin validarla, cualquiera se autoemite uno con un `curl`.
> Ya está implementada y testeada — solo falta el secreto.

**Probá primero en sandbox** con las credenciales de prueba y las
[tarjetas de test](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).

### 3. Envío de mail (Resend)

| Variable | Qué es |
|---|---|
| `RESEND_API_KEY` | API key |
| `MAIL_FROM` | Remitente verificado, ej. `kiOS <hola@kios.com.ar>` |

Hay que **verificar el dominio** en Resend y publicar los registros
**SPF + DKIM + DMARC**. Sin eso, el mail con el código de activación cae
en spam — y ese mail es el único lugar donde el cliente va a tener su
licencia.

### 4. Dominio y deploy

| Variable | Qué es |
|---|---|
| `PUBLIC_SITE_URL` | `https://kios.com.ar` — arma los `back_urls` de MP |
| `VITE_DEMO_URL` | URL de la demo web desplegada |
| `VITE_DOWNLOAD_URL` | Instalador firmado |
| `VITE_SUPPORT_EMAIL` | Casilla de soporte |

Sin `VITE_DEMO_URL` y `VITE_DOWNLOAD_URL` los CTA de la landing se ven
apagados y no hacen nada (a propósito: mejor un botón que admite que no
está listo que uno que lleva a un 404).

### 5. Instalador de escritorio firmado

Hoy no hay release. Y **sin firma de código**, Windows SmartScreen muestra
"Windows protegió tu PC" y la mayoría de la gente cancela ahí.

- Certificado **OV o EV** para firmar el `.exe` (Sectigo, DigiCert; ~US$200-400/año).
- Configurar `tauri.conf.json` → `bundle.windows.certificateThumbprint`.
- La reputación de SmartScreen se construye con descargas: los primeros
  días avisa igual aunque esté firmado.

---

## 🟠 Importante: se puede lanzar, pero va a doler

### 6. Actualizaciones automáticas

No hay updater configurado. Hoy, para que un cliente pase a una versión
nueva, tiene que enterarse solo y reinstalar a mano. Con el plugin
`tauri-plugin-updater` + un JSON firmado en un hosting estático alcanza.

### 7. Backup de la base

Los datos viven en un SQLite en la PC del cliente. Si se le rompe el disco,
perdió el negocio entero. Ya existe el backup automático previo a cada
migración (`backups/pre-vN`), pero **no hay backup periódico ni exportación
manual**. Mínimo viable: un botón "Guardar copia" en Configuración → Datos
que escriba el `.db` donde el usuario elija.

### 8. Mails duplicados del webhook

El código es una constante, así que un reintento de Mercado Pago no puede
generar licencias de más — pero **sí puede mandar el mail dos veces**.
Molesto, no grave. La solución prolija es un KV (Vercel KV / Upstash)
marcando `payment_id` ya procesado.

### 9. Registro de ventas fuera del sistema

No hay ningún registro propio de a quién se le vendió. Si alguien pierde el
mail, la única fuente es el panel de Mercado Pago + reemitir con
`npm run license:sign`. Funciona, pero es a mano. Una planilla o un KV con
`{fecha, nombre, mail, payment_id}` ahorra mucho soporte.

### 10. Legales

- **Términos y condiciones** y **Política de privacidad** enlazados en el
  pie. La landing hoy no los tiene.
- **Botón de arrepentimiento** — obligatorio en Argentina para venta online
  (Res. 424/2020), tiene que estar visible en la home.
- **Datos del vendedor** (razón social o monotributo, CUIT, domicilio).
- **Defensa del Consumidor**: enlace al formulario oficial.

> Esto no es opcional para vender a consumidores finales en el país.

### 11. Facturación

Cada venta necesita factura electrónica AFIP/ARCA. Hoy no hay nada
automatizado: se puede emitir a mano al principio, pero conviene decidirlo
antes de la primera venta y no después.

---

## 🟡 Deseable

### 12. Analítica de la landing

Sin métricas no se sabe si la gente llega a Precios o se va en el hero.
Algo liviano y sin cookies (Plausible, Umami) evita además el banner de
consentimiento.

### 13. Peso del bundle de la landing

368 kB (119 kB gzip), casi todo Motion + React. Aceptable, pero para una
página de marketing es mucho. Si importa el tiempo de carga en 3G, se puede
bajar bastante con `LazyMotion` de Motion.

### 14. Vulnerabilidades de dependencias

`npm audit` marca 13 altas, todas transitivas (`minimatch`/`brace-expansion`
vía `eslint`, y `glob` vía `exceljs`). Son de build o no alcanzables desde
la app; conviene resolverlas igual antes de publicar el repo.

### 15. Screenshots de la landing

Las capturas actuales son de datos de ejemplo reales, pero muestran
productos con **stock negativo** ("Sin stock · -29"). Es correcto —la app
permite vender sin stock a propósito— pero en marketing se lee como un
error. Conviene sembrar un set de datos "de vitrina" antes de la próxima
tanda de capturas.

---

## ✅ Lo que ya está resuelto

- App completa: venta, stock por ledger, fiado con cuentas corrientes,
  cajeros, cierre de caja, reportes, exportación a Excel, ticket térmico.
- **137 tests** en la app + **11** en el backend de compra. Lint y
  typecheck limpios en los dos.
- Firmador y verificador de licencias, y el mecanismo que hace que rotar el
  código no le apague la app a los clientes que ya pagaron.
- Activación **sin internet**: la firma se verifica contra la clave pública
  que la app ya trae, sin llamar a ningún servidor.
- Checkout de Mercado Pago, webhook con validación de firma HMAC, y mail
  con el código — todo escrito y testeado, esperando credenciales.
- Landing con la página `/gracias` de vuelta del pago.
- Backup automático de la base antes de cada migración.
- Búsqueda sin acentos ni mayúsculas en productos y clientes
  (migración 003), con test de paridad entre el plegado en SQL y el de JS.

---

## Orden sugerido

1. Claves de licencia (5 min) → sin esto no hay producto que vender.
2. Sandbox de Mercado Pago + Resend → probar una compra de punta a punta.
3. Dominio + deploy de landing y demo.
4. Legales (botón de arrepentimiento + T&C) → es lo que más tarda si se deja para el final.
5. Certificado de firma de código → tarda días en emitirse, pedilo temprano.
6. Recién ahí, credenciales de producción de MP.
