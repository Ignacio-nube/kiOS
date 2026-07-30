/**
 * Emite un código de licencia kiOS firmado.
 *
 *   npm run license:sign -- "kiOS"                 # el código COMPARTIDO
 *   npm run license:sign -- "Kiosco La Esquina"    # uno a nombre de alguien
 *
 * Necesita `LICENSE_PRIVATE_KEY_HEX` en el entorno.
 *
 * En el modelo actual se emite UN código compartido que reciben todos los
 * que compran (ver docs/LANZAMIENTO.md). El nombre que se le ponga acá es
 * lo que la app va a mostrar en Configuración → Licencia, así que conviene
 * algo que se lea bien ahí: "kiOS" queda como "Activado a nombre de kiOS".
 *
 * IMPORTA `encodeLicenseKey` DEL MÓDULO REAL DE LA APP en vez de reescribir
 * el base32 acá. Es la única defensa contra la falla más cara posible de
 * esta herramienta: un firmador que produce códigos con un formato apenas
 * distinto al que la app verifica. Eso no se detecta hasta que un cliente
 * que ya pagó dice que su código "no anda".
 */
import * as ed from "@noble/ed25519";
import { encodeLicenseKey, type LicensePayload } from "../../apps/app/src/domain/license.ts";

const customer = process.argv[2]?.trim();
const privateKeyHex = process.env.LICENSE_PRIVATE_KEY_HEX?.trim();

function die(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

if (!customer) {
  die('Falta el nombre de la licencia.\n    Uso: npm run license:sign -- "kiOS"');
}
if (!privateKeyHex) {
  die("Falta LICENSE_PRIVATE_KEY_HEX en el entorno.\n    Se genera con: npm run license:keygen");
}
if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
  die(`LICENSE_PRIVATE_KEY_HEX tiene que ser 64 caracteres hex (son ${privateKeyHex.length}).`);
}

const payload: LicensePayload = {
  customer,
  issuedAt: new Date().toISOString(),
};

// El payload se firma EXACTAMENTE como se serializa. Cualquier reordenado
// de claves o espacio distinto cambia los bytes y rompe la verificación.
const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
const signature = await ed.signAsync(payloadBytes, privateKeyHex);
const key = encodeLicenseKey(payloadBytes, signature);

console.log(`
╭─ Licencia emitida ────────────────────────────────────────────────────

  Nombre    ${payload.customer}
  Emitida   ${payload.issuedAt}

  ${key}

╰───────────────────────────────────────────────────────────────────────

1. Verificala contra la clave pública embebida en la app:

     npm run license:verify -- "${key}"

2. Pegala en la variable de entorno del hosting, para que el webhook la
   mande por mail a cada comprador:

     SHARED_LICENSE_KEY=${key}
`);
