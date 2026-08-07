/**
 * POST /api/checkout — arranca una compra.
 *
 * Recibe { name, email }, crea la preferencia en Mercado Pago y devuelve el
 * link de pago. El PRECIO LO PONE EL SERVIDOR, nunca el cliente: si viajara
 * en el body, cualquiera abriría las herramientas del navegador y compraría
 * la licencia por un peso.
 */
import { createPreference } from "./_lib/mercadopago";
import { priceARS } from "./_lib/price";
import { resolveSiteUrl } from "./_lib/site-url";

export const config = { runtime: "edge" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    // Falta configuración del servidor: no es culpa del comprador y no
    // tiene nada que hacer al respecto, así que el mensaje no lo culpa.
    console.error("checkout: falta MP_ACCESS_TOKEN");
    return json({ error: "La compra no está disponible en este momento." }, 503);
  }

  // El origen sale del pedido, no de una variable escrita a mano: ver el
  // comentario de `_lib/site-url.ts`, que explica el bug del `www`.
  const { url: siteUrl, mismatch } = resolveSiteUrl(request);
  if (mismatch) {
    console.warn(
      "checkout: PUBLIC_SITE_URL no coincide con el origen real. " +
        "Se usa el real; revisá la variable en Vercel.",
      mismatch,
    );
  }

  /**
   * A dónde va a notificar Mercado Pago. Se loguea SIEMPRE y completa,
   * porque cuando el webhook no llega no hay ninguna otra forma de saber
   * qué URL se le pasó: MP no reporta el error de entrega en ningún lado
   * visible, simplemente no notifica.
   *
   * Tiene que verse exactamente así, sin redirects de por medio:
   *   https://www.kios.click/api/webhook
   */
  const notificationUrl = `${siteUrl}/api/webhook`;
  console.log("checkout: notification_url", notificationUrl);

  let body: { name?: unknown; email?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (name.length < 2 || name.length > 80) {
    return json({ error: "Escribí el nombre del negocio (entre 2 y 80 caracteres)." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "Revisá el mail: no parece una dirección válida." }, 400);
  }

  /**
   * `external_reference` lleva el nombre y el mail porque es lo único que
   * vuelve con el pago y no hay base de datos donde guardarlos. El webhook
   * los lee de acá para saber a nombre de quién firmar y a dónde mandar.
   * El separador es `|` — un carácter que ni un mail ni un nombre normal
   * contienen — y el nombre se recorta para no pasarse del límite de MP.
   */
  const externalReference = `kios|${name.slice(0, 80)}|${email}`;

  try {
    const url = await createPreference({
      title: "kiOS Activado — licencia de uso permanente",
      // Lee VITE_PRICE_ARS, la MISMA variable que muestra la landing. Si
      // está mal escrita lanza acá, antes de crear la preferencia: mejor
      // que el checkout falle a que cobre un precio que nadie decidió.
      priceARS: priceARS(),
      externalReference,
      payerEmail: email,
      siteUrl,
      accessToken,
    });
    return json({ url });
  } catch (cause) {
    console.error("checkout: fallo creando la preferencia", cause);
    return json({ error: "No pudimos abrir el pago. Probá de nuevo en un momento." }, 502);
  }
}
