# ADR-007 — Cajeros sin clave y fiado con límite blando

**Estado**: aceptada, 2026-07-28

## Contexto

Faltaban dos cosas que un kiosco de barrio usa todos los días: anotar lo que
se lleva alguien para pagar después, y saber qué empleado cobró cada venta.

El esquema de fiado (`customers`, `customer_account_movements`) existía desde
la migración 001 por ADR-004, pero estaba muerto: sin repo, sin tipos, sin
pantalla. De cajeros no había nada.

## Decisión

### Cajeros: identidad, no autenticación

Un cajero es un nombre y nada más. **Sin clave, sin roles, sin permisos.**
Sirve para atribuir ventas y cerrar la caja, no para restringir accesos.

- Se crea uno solo si no hay ninguno (`cashiers.ensureDefault`), llamado como
  el negocio o "Principal". Es un valor INICIAL: si después se renombra el
  negocio, el cajero conserva su nombre (es una identidad, no un espejo).
- No se puede dar de baja al último: nunca sin caja.
- El activo vive en `meta.active_cashier_id` y se elige desde el pie del rail,
  visible desde todas las pantallas. Cobrar con el nombre del turno anterior
  arruina el cierre y no hay forma de darse cuenta después.

Un PIN se evaluó y se descartó: agrega fricción a la tarea más frecuente de
la app para proteger un dato que nadie tiene incentivo de falsear en un
kiosco familiar. Si algún día hace falta, es aditivo (columna + verificación).

### Fiado: `credit` es un medio de pago

Fiar registra una venta normal con un pago `method = 'credit'` que iguala el
total, más un movimiento `credit_sale` en la cuenta del cliente, **todo en la
misma transacción**. Así la facturación es correcta (una venta fiada es una
venta) y la deuda vive en un solo lugar: el ledger.

- **Convención de signo**: `delta_cents > 0` AUMENTA la deuda. Saldo positivo
  = el cliente debe. Es la INVERSA del stock (donde negativo es salida), y
  confundirlas es el error más probable de la feature.
- Anular una venta fiada inserta un `void_reversal` negativo — no un
  `adjustment`, que es la corrección manual del kiosquero ("te perdono
  $500"). Mezclarlos haría ilegible el historial de la cuenta.
- `sales.customer_id` se denormaliza junto al movimiento: una venta puede
  tener cliente sin ser fiada, y `voidSale` necesita el cliente para
  compensar. No divergen porque la regla B prohíbe UPDATEar ambas.

### El límite de crédito AVISA, nunca bloquea

Mismo criterio que el stock negativo (ADR-004): una venta no se traba con el
cliente enfrente. La UI muestra el saldo, cuánto quedaría debiendo y un
cartel claro si se pasa — y el botón de confirmar sigue habilitado.

**El repositorio ni siquiera lee `credit_limit_cents`.** Que la regla no viva
en la capa de datos es deliberado: impide que alguien reintroduzca un bloqueo
"por las dudas" dentro de seis meses.

### `clearSales` conserva las deudas

"Borrar historial de ventas" elimina ventas, items, pagos y movimientos de
stock de venta, pero **NO** los movimientos de cuenta corriente.

Una deuda es plata que le deben al kiosquero. El botón se ofrece como
"liberar espacio conservando el catálogo": quien lo aprieta para que la app
vaya más rápido perdonaría en silencio todas las deudas, sin vuelta atrás.
Es la misma línea que ya trazaba con el stock — se borra el *historial de
ventas*, no el *estado del negocio*. Para borrar todo está `resetAll`.

Es gratis técnicamente: `customer_account_movements.sale_id` no tiene
`REFERENCES` (igual que `stock_movements.sale_id`), así que no viola FKs.

## Consecuencias

- **`paymentBreakdown` dejó de ser "plata cobrada"**: ahora incluye una fila
  Fiado. La UI separa con `isCashInMethod`. `totalsByRange` sigue siendo
  facturación e incluye fiado, a propósito.
- **`PAYMENT_METHODS` se partió**: los cuatro que entran plata al cajón, y
  `ALL_PAYMENT_METHODS` con los cinco para filtros y etiquetas. Meter
  `credit` en el primero rompe el cobro en silencio; hay un test que lo
  custodia.
- **Cierre de caja** (card en Reportes, no pantalla nueva: ya tiene los
  presets de rango y "Hoy" es el cierre del turno) separa lo facturado de lo
  cobrado, y suma los cobros de deuda — por eso el ledger de cuenta lleva
  `cashier_id` y `method`.
- **Migración 002** reconstruye `sale_payments` y `customer_account_movements`
  para alterar sus CHECK. Es seguro dentro de la transacción del runner —
  donde `PRAGMA foreign_keys` es un no-op— **solo porque nadie referencia a
  esas dos tablas**. Está documentado en la migración para que nadie copie la
  receta al reconstruir una tabla padre.
- **Costo del saldo**: es una agregación, igual que el stock. Medido con
  300.000 movimientos sobre 2.000 clientes: un cliente ~0,09 ms (el camino
  caliente, al fiar), una página de 20 ~1,9 ms, `listDebtors` ~39 ms,
  `totalDebt` ~55 ms. Confirma la apuesta de ADR-004.
- **Sync (fase 2)**: el ledger de cuenta es append-only, así que entra en la
  categoría de upsert idempotente sin conflictos. `customers` es catálogo y
  va con LWW, como estaba previsto en ADR-003.
