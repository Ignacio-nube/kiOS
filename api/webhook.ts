/**
 * POST /api/webhook — Mercado Pago avisa que pasó algo con un pago.
 *
 * Es la pieza con plata en juego, así que tiene TRES puertas antes de
 * mandar el código:
 *
 *   1. Firma HMAC válida (descarta cualquier POST de un tercero).
 *   2. El pago se re-consulta CONTRA LA API de MP. El cuerpo de la
 *      notificación no se cree: solo se usa para saber qué id mirar.
 *   3. El pago tiene que estar `approved` Y por el monto correcto.
 *
 * ── Un solo código para todos ───────────────────────────────────────────
 * El código de activación NO se firma acá: se emite UNA VEZ a mano con
 * `npm run license:sign` y se pega en la variable `SHARED_LICENSE_KEY`.
 * Este endpoint solo lo reenvía por mail al que pagó.
 *
 * La consecuencia buena es de seguridad: **la clave privada de licencias
 * nunca toca el servidor**. Si alguien se mete en el hosting se lleva un
 * código —el mismo que ya circula entre los clientes— y no la capacidad de
 * fabricar códigos nuevos.
 *
 * La consecuencia asumida es que el código se puede pasar de boca en boca.
 * El plan para eso es rotarlo cada tanto (ver docs/LANZAMIENTO.md), no
 * intentar impedirlo.
 *
 * Sobre reintentos: MP reintenta ante cualquier respuesta que no sea 2xx y
 * manda duplicados por diseño. Como el código es una constante, reintentar
 * no puede generar licencias de más; lo único que se duplica es el mail.
 */
import { fetchPayment, isValidSignature } from "./_lib/mercadopago.ts";
import { sendLicenseEmail } from "./_lib/email.ts";

export const config = { runtime: "edge" };

/** Espeja `PRICE_ARS` de checkout.ts y de src/lib/config.ts. */
const PRICE_ARS = 35_000;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const {
    MP_ACCESS_TOKEN: accessToken,
    MP_WEBHOOK_SECRET: webhookSecret,
    SHARED_LICENSE_KEY: licenseKey,
    RESEND_API_KEY: resendKey,
    MAIL_FROM: mailFrom,
    VITE_SUPPORT_EMAIL: supportEmail = "hola@kios.click",
  } = process.env;

  if (!accessToken || !webhookSecret || !licenseKey || !resendKey || !mailFrom) {
    console.error("webhook: faltan variables de entorno del servidor");
    // 500 para que MP reintente: cuando termine de configurarse, las
    // compras de este rato se resuelven solas sin intervención.
    return new Response("Servidor mal configurado", { status: 500 });
  }

  // Chequeo barato contra el error tonto de pegar la clave PRIVADA, un
  // código de otro entorno, o dejar la variable con un placeholder. Sin
  // esto el cliente recibe un mail con algo que la app no acepta, y el
  // webhook responde 200 tan contento.
  if (!licenseKey.startsWith("KIOS-")) {
    console.error("webhook: SHARED_LICENSE_KEY no parece un código kiOS");
    return new Response("Servidor mal configurado", { status: 500 });
  }

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  const signatureOk = await isValidSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret: webhookSecret,
  });

  if (!signatureOk) {
    console.warn("webhook: firma inválida", { dataId });
    // 401 y NO 500: si la firma no cierra, reintentar no va a arreglarlo.
    return new Response("Firma inválida", { status: 401 });
  }

  // Solo interesan los avisos de pago. El resto se acepta y se ignora, para
  // que MP no los reintente eternamente.
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (topic && topic !== "payment") return new Response("ok", { status: 200 });
  if (!dataId) return new Response("ok", { status: 200 });

  try {
    const payment = await fetchPayment(dataId, accessToken);

    if (payment.status !== "approved") {
      // Rechazado o pendiente: no es un error, simplemente no hay licencia
      // todavía. Si después se aprueba, MP vuelve a avisar.
      return new Response("ok", { status: 200 });
    }

    // Un pago aprobado por menos de lo que vale la licencia no la paga.
    if (payment.transaction_amount < PRICE_ARS) {
      console.error("webhook: monto insuficiente", {
        paymentId: payment.id,
        amount: payment.transaction_amount,
      });
      return new Response("ok", { status: 200 });
    }

    const buyer = parseExternalReference(payment.external_reference);
    if (!buyer) {
      console.error("webhook: external_reference ilegible", {
        paymentId: payment.id,
        reference: payment.external_reference,
      });
      return new Response("ok", { status: 200 });
    }

    await sendLicenseEmail({
      to: buyer.email,
      customer: buyer.name,
      licenseKey,
      from: mailFrom,
      apiKey: resendKey,
      supportEmail,
    });

    console.log("webhook: licencia enviada", { paymentId: payment.id, to: buyer.email });
    return new Response("ok", { status: 200 });
  } catch (cause) {
    console.error("webhook: fallo procesando el pago", { dataId, cause });
    // 500 a propósito: MP reintenta. Un pago acreditado sin licencia es lo
    // peor que puede pasar acá, así que conviene que insista.
    return new Response("Error procesando el pago", { status: 500 });
  }
}

/** `kios|Nombre del negocio|mail@ejemplo.com` → sus partes. */
export function parseExternalReference(
  reference: string | null,
): { name: string; email: string } | null {
  if (!reference) return null;
  const parts = reference.split("|");
  if (parts.length !== 3 || parts[0] !== "kios") return null;
  const [, name, email] = parts;
  if (!name?.trim() || !email?.includes("@")) return null;
  return { name: name.trim(), email: email.trim() };
}
