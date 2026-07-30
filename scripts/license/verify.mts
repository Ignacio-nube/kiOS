/**
 * Verifica un código de licencia contra la clave pública EMBEBIDA EN LA APP.
 *
 *   npx tsx scripts/license/verify.mts "KIOS-XXXXX-…"
 *   npm run license:verify -- "KIOS-XXXXX-…"
 *
 * Ese detalle es todo el valor del script: no comprueba que el código esté
 * bien firmado en abstracto, sino que la app que tiene el cliente lo va a
 * aceptar. Si acá falla, no lo mandes.
 */
import {
  LICENSE_PUBLIC_KEY_HEX,
  verifyLicenseKey,
} from "../../apps/app/src/domain/license.ts";

const key = process.argv[2]?.trim();

if (!key) {
  console.error('\n  ✗ Falta el código.\n    Uso: npm run license:verify -- "KIOS-XXXXX-…"\n');
  process.exit(1);
}

// La app degrada a free en silencio ante una clave inválida (jamás rompe la
// caja), así que sin este chequeo un placeholder de ceros se vería igual
// que una clave real hasta que alguien intenta activar.
if (/^0+$/.test(LICENSE_PUBLIC_KEY_HEX)) {
  console.error(`
  ✗ La app todavía tiene la clave pública PLACEHOLDER (todo ceros).

    Ninguna licencia va a funcionar hasta que corras:

      node scripts/license/keygen.mjs

    y pegues la pública en apps/app/src/domain/license.ts.
`);
  process.exit(1);
}

const payload = await verifyLicenseKey(key);

if (!payload) {
  console.error(`
  ✗ Código INVÁLIDO para esta app.

    Puede ser que esté mal copiado, o que se haya firmado con otra clave
    privada (¿rotaste el par de claves?).
`);
  process.exit(1);
}

console.log(`
  ✓ Código válido.

    Cliente   ${payload.customer}
    Emitida   ${payload.issuedAt}

  Al activarlo, la app va a decir: "Activado a nombre de ${payload.customer}".
`);
