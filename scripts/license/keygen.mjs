/**
 * Genera el par de claves Ed25519 de kiOS. Se corre UNA VEZ en la vida del
 * producto: cambiar la clave pública invalida todas las licencias emitidas.
 *
 *   node scripts/license/keygen.mjs
 *
 * No escribe nada a disco a propósito. Un archivo con la clave privada en
 * el árbol del repo termina commiteado tarde o temprano; obligando a
 * copiarla de la terminal al gestor de contraseñas, ese accidente no pasa.
 */
import * as ed from "@noble/ed25519";

const privateKey = ed.utils.randomPrivateKey();
const publicKey = await ed.getPublicKeyAsync(privateKey);

const hex = (bytes) => Buffer.from(bytes).toString("hex");

console.log(`
╭─ Par de claves de licencias kiOS ─────────────────────────────────────

  PRIVADA (secreta — gestor de contraseñas + env del backend)

    ${hex(privateKey)}

  PÚBLICA (va embebida en la app, es pública de verdad)

    ${hex(publicKey)}

╰───────────────────────────────────────────────────────────────────────

Pasos:

  1. Guardá la PRIVADA en tu gestor de contraseñas. No hay forma de
     recuperarla: si la perdés, hay que rotar y reemitir todo.

  2. Pegá la PÚBLICA en apps/app/src/domain/license.ts:

       export const LICENSE_PUBLIC_KEY_HEX =
         "${hex(publicKey)}";

  3. Pegá la PRIVADA en el .env del backend de la landing:

       LICENSE_PRIVATE_KEY_HEX=${hex(privateKey)}

  4. Emití una licencia de prueba y activala en la app antes de publicar:

       LICENSE_PRIVATE_KEY_HEX=… node scripts/license/sign.mjs "Prueba"
`);
