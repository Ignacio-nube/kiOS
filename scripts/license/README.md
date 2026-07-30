# Licencias kiOS

Las licencias son códigos `KIOS-…` firmados con Ed25519 y verificados
**100% offline** por la app (`apps/app/src/domain/license.ts`). No hay
servidor de activación: la app solo lleva la clave pública embebida.

## Modelo actual: un código para todos

Se emite **un solo código compartido** que reciben todos los que compran.
El webhook de la landing no firma nada: solo reenvía por mail el valor de
`SHARED_LICENSE_KEY`.

Consecuencia buena: **la clave privada nunca toca el servidor**. Si alguien
entra al hosting se lleva un código —el mismo que ya tienen los clientes—
y no la capacidad de fabricar códigos nuevos.

Consecuencia asumida: el código se puede pasar de boca en boca. La
respuesta a eso es **rotarlo cada tanto**, no intentar impedirlo.

---

## 1. Generar el par de claves (una vez en la vida del producto)

```bash
npm run license:keygen
```

- La **pública** va a `apps/app/src/domain/license.ts`.
- La **privada** va a tu gestor de contraseñas. **No** al repo, y **no** al
  hosting: para el modelo compartido el servidor no la necesita.

## 2. Emitir el código compartido

```bash
LICENSE_PRIVATE_KEY_HEX=… npm run license:sign -- "kiOS"
```

El nombre es lo que la app muestra en Configuración → Licencia, así que
conviene algo que se lea bien ahí.

## 3. Verificarlo antes de ponerlo en producción

```bash
npm run license:verify -- "KIOS-XXXXX-…"
```

Verifica contra la clave pública **embebida en la app**, o sea comprueba lo
que va a pasar en la máquina del cliente. Si acá falla, no lo publiques.

## 4. Ponerlo en el hosting

```
SHARED_LICENSE_KEY=KIOS-XXXXX-…
```

---

## Rotar el código

Cuando el código circule demasiado:

1. `npm run license:keygen` → par nuevo.
2. Pegá la pública nueva en `apps/app/src/domain/license.ts`.
3. Publicá una versión nueva de la app.
4. `npm run license:sign -- "kiOS"` con la privada nueva.
5. Actualizá `SHARED_LICENSE_KEY` en el hosting.

**Qué pasa con los clientes que ya pagaron:** siguen activados. La app pide
la verificación criptográfica **una sola vez, al activar**, y después deja
una constancia en su base local (`meta.license_activation`). Al actualizar,
esa constancia la mantiene activada aunque su código ya no verifique.

Quien se ve afectado es solo el que intenta **activar de cero** con un
código viejo — que es exactamente a quien se quiere frenar.

> ⚠ Por eso la constancia existe. Sin ella, rotar la clave apagaría la app
> de **todos los clientes que actualicen**, que es lo contrario de lo que
> se busca. Si algún día cambiás ese mecanismo, acordate de esto.

---

## Emitir un código a nombre de alguien

El firmador sigue sirviendo para casos sueltos (una venta por transferencia,
un cliente al que le querés dar su propio código):

```bash
LICENSE_PRIVATE_KEY_HEX=… npm run license:sign -- "Kiosco La Esquina"
```

Cualquier código firmado con la clave privada vigente sirve; no hay lista
de códigos válidos ni nada que registrar.

---

## Formato

`KIOS-` + base32 Crockford de `JSON del payload ‖ firma de 64 bytes`, en
grupos de 5 caracteres. El payload es:

```json
{ "customer": "kiOS", "issuedAt": "2026-07-30T…Z" }
```

`features` está reservado y hoy no se interpreta (ver ADR-005).
