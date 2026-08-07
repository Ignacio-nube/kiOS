# Código de activación de kiOS

> ⚠️ **Este repo es PÚBLICO.** Cualquiera que llegue acá se lleva la
> licencia gratis. Está a propósito —el modelo es un código compartido que
> igual va a circular— pero conviene saberlo: no es solo "difícil que un
> cliente entre", es que está indexado y es buscable.
>
> Si preferís que no esté acá: borrá este archivo y guardá el código en tu
> gestor de contraseñas. La app no lo lee de ningún lado, así que sacarlo
> no rompe nada.

## El código

```
KIOS-FCH66-XBKEH-QPTSB-J48X2-4TV99-X9J4B-12D5S-Q6XB5-CH0Q8-8HT48-S30CH-P5MR3-GB9G6-XA30C-9T6GR-3MD9Q-5RV32-D2T49-YYT5A-RY5DQ-NQA2P-A2ZM9-B7Z4D-MFE6J-M62CN-P6V7S-EZJXS-45N5D-6D2FQ-VNZRZ-A8XGE-YCFQS-CSNPQ-43TXG-CAHMH-H56Y9-ZQ0FM-Q1MRZ-FZ1C
```

Emitido a nombre de **kiOS**, el 06/08/2026. No vence.

Se lo pasás al cliente después de la transferencia. Él lo pega en
**Configuración → Licencia** y activa **sin internet**: la app verifica la
firma contra la clave pública que ya trae.

## Cómo comprobar que sirve

```bash
npm run license:verify -- "KIOS-FCH66-XBKEH-QPTSB-J48X2-4TV99-X9J4B-12D5S-Q6XB5-CH0Q8-8HT48-S30CH-P5MR3-GB9G6-XA30C-9T6GR-3MD9Q-5RV32-D2T49-YYT5A-RY5DQ-NQA2P-A2ZM9-B7Z4D-MFE6J-M62CN-P6V7S-EZJXS-45N5D-6D2FQ-VNZRZ-A8XGE-YCFQS-CSNPQ-43TXG-CAHMH-H56Y9-ZQ0FM-Q1MRZ-FZ1C"
```

Verifica contra la clave pública **embebida en la app**, o sea comprueba lo
que va a pasar en la máquina del cliente.

## La clave privada

**No está en este repo, y no tiene que estar.** Cuando se generó quedó en
`.license-keys.local` (ignorado por git). Movela a tu gestor de
contraseñas y borrá ese archivo.

Si la perdés no podés emitir códigos nuevos ni rotar: hay que generar un
par nuevo, publicar una versión de la app con la pública nueva y reemitir.

## Rotar

Cuando el código haya circulado demasiado:

```bash
npm run license:keygen                                    # par nuevo
# pegar la pública en apps/app/src/domain/license.ts
LICENSE_PRIVATE_KEY_HEX=… npm run license:sign -- "kiOS"  # código nuevo
npm run license:verify -- "KIOS-…"
```

Los clientes que **ya activaron no se ven afectados**: la app pide la
verificación una sola vez y después guarda una constancia local
(`meta.license_activation`). La rotación solo frena a quien intente
activar de cero con un código viejo — que es a quien se quiere frenar.
