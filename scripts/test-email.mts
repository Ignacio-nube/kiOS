/**
 * Manda el mail de la licencia a una casilla, SIN pasar por Mercado Pago.
 *
 *   npm run email:test -- vos@ejemplo.com
 *
 * Existe porque probar el correo haciendo una compra entera es lentísimo y
 * mezcla dos problemas distintos: si no llega el mail, no sabés si falló el
 * webhook, el pago, o Resend. Esto aísla la última parte.
 *
 * Usa `sendLicenseEmail` DEL CÓDIGO DE PRODUCCIÓN, no una copia: lo que
 * veas en tu casilla es exactamente lo que va a recibir un cliente, con el
 * mismo asunto, el mismo HTML y el mismo remitente.
 *
 * Necesita RESEND_API_KEY y MAIL_FROM en el entorno. Se pueden pasar en la
 * misma línea:
 *
 *   RESEND_API_KEY=re_… MAIL_FROM="kiOS <info@kios.click>" \
 *     npm run email:test -- vos@ejemplo.com
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sendLicenseEmail } from "../api/_lib/email";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function die(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const to = process.argv[2]?.trim();
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
  die('Pasá una casilla de destino.\n    npm run email:test -- vos@ejemplo.com');
}

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.MAIL_FROM?.trim();
if (!apiKey) die("Falta RESEND_API_KEY en el entorno (Resend → API Keys).");
if (!from) die('Falta MAIL_FROM en el entorno. Ej: MAIL_FROM="kiOS <info@kios.click>"');

/**
 * El código real, leído del doc. Así el mail de prueba lleva exactamente lo
 * mismo que recibiría un cliente — y de paso, si el doc quedó vacío o mal,
 * se nota acá y no después de una venta.
 */
const doc = readFileSync(resolve(root, "docs/CODIGO-ACTIVACION.md"), "utf8");
const licenseKey = doc.match(/KIOS-[A-Z0-9-]+/)?.[0];
if (!licenseKey) die("No encontré ningún código KIOS- en docs/CODIGO-ACTIVACION.md");

const supportEmail = process.env.VITE_SUPPORT_EMAIL?.trim() ?? "info@kios.click";

console.log(`
· Destino    ${to}
· Remitente  ${from}
· Código     ${licenseKey.slice(0, 24)}… (${licenseKey.length} caracteres)
`);

try {
  await sendLicenseEmail({
    to,
    customer: "Kiosco de Prueba",
    licenseKey,
    from,
    apiKey,
    supportEmail,
  });
} catch (cause) {
  const detalle = cause instanceof Error ? cause.message : String(cause);
  die(
    `Resend rechazó el envío.\n\n    ${detalle}\n\n` +
      "    Lo más común:\n" +
      "      · el dominio de MAIL_FROM no está verificado en Resend;\n" +
      "      · la API key es de otro proyecto o está revocada;\n" +
      "      · sin dominio verificado, Resend SOLO deja mandar a la casilla\n" +
      "        con la que creaste la cuenta.",
  );
}

console.log(`  ✓ Resend aceptó el envío.

  Ojo: "aceptado" no es "entregado". Mirá Resend → Emails para ver el
  estado real, y revisá Spam en la casilla de destino. Si el dominio no
  tiene SPF/DKIM publicados, es probable que caiga ahí.
`);
