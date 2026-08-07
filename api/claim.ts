/**
 * POST /api/claim — red de seguridad para cuando el webhook no llegó.
 *
 * La página `/gracias` la llama con el `payment_id` que Mercado Pago pone
 * en la URL de vuelta. Si el pago está aprobado, manda el código.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────
 * El webhook depende de que MP consiga hacerle POST a nuestro servidor. Eso
 * falla por cosas que no controlamos y que no dejan rastro: un redirect en
 * el medio (el bug del `www`), un deploy caído justo en ese minuto, un
 * timeout. Cuando falla, el cliente pagó y no recibe nada — el peor
 * resultado posible.
 *
 * Este camino no reemplaza al webhook: lo cubre. El webhook sigue siendo el
 * principal porque funciona aunque el comprador cierre la pestaña.
 *
 * ── Qué NO se hace acá, a propósito ─────────────────────────────────────
 * No se le cree NADA al cliente más que el `payment_id`, y ni siquiera eso:
 * el pago se re-consulta contra la API de MP con nuestro access token, que
 * solo ve pagos de nuestra cuenta. El mail de destino sale del
 * `external_reference` que guardamos al crear la preferencia, NUNCA de la
 * request — si viniera de ahí, cualquiera podría pedir que la licencia se
 * mande a su propia casilla citando un pago ajeno.
 *
 * ── Lo que sí puede pasar ───────────────────────────────────────────────
 * Alguien que adivine ids de pago puede provocar que a un comprador real le
 * llegue el mail dos veces. Es molesto y no más que eso: el código es el
 * mismo para todos y el mail va a la casilla del comprador, no a la de
 * quien llamó. Deduplicar de verdad necesita un KV (ver LANZAMIENTO.md).
 */
import { fetchPayment } from "./_lib/mercadopago";
import { sendLicenseEmail } from "./_lib/email";
import { priceARS } from "./_lib/price";
// Se reusa el parser del webhook en vez de copiarlo: es el mismo formato
// que escribe checkout.ts, y dos implementaciones divergirían.
import { parseExternalReference } from "./webhook";

export const config = { runtime: "edge" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const {
    MP_ACCESS_TOKEN: accessToken,
    SHARED_LICENSE_KEY: licenseKey,
    RESEND_API_KEY: resendKey,
    MAIL_FROM: mailFrom,
    VITE_SUPPORT_EMAIL: supportEmail = "info@kios.click",
  } = process.env;

  if (!accessToken || !licenseKey || !resendKey || !mailFrom) {
    console.error("claim: faltan variables de entorno del servidor");
    return json({ status: "error" }, 503);
  }
  if (!licenseKey.startsWith("KIOS-")) {
    console.error("claim: SHARED_LICENSE_KEY no parece un código kiOS");
    return json({ status: "error" }, 503);
  }

  let body: { paymentId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }

  // MP manda el id como número o string según el parámetro; se normaliza y
  // se exige que sean solo dígitos para no reenviar basura a su API.
  const paymentId = String(body.paymentId ?? "").trim();
  if (!/^\d+$/.test(paymentId)) return json({ error: "payment_id inválido." }, 400);

  try {
    const payment = await fetchPayment(paymentId, accessToken);

    if (payment.status !== "approved") {
      // Puede estar legítimamente pendiente (transferencia, efectivo). No
      // es un error: el webhook va a avisar cuando se acredite.
      console.log("claim: pago no aprobado", { paymentId, status: payment.status });
      return json({ status: "pending" });
    }

    const esperado = priceARS();
    if (payment.transaction_amount < esperado) {
      console.error("claim: monto insuficiente", {
        paymentId,
        amount: payment.transaction_amount,
        esperado,
      });
      return json({ status: "pending" });
    }

    const buyer = parseExternalReference(payment.external_reference);
    if (!buyer) {
      // El pago existe y está aprobado pero no lo generó nuestro checkout,
      // o la referencia se corrompió. Hay que mirarlo a mano.
      console.error("claim: external_reference ilegible", {
        paymentId,
        reference: payment.external_reference,
      });
      return json({ status: "manual" });
    }

    await sendLicenseEmail({
      to: buyer.email,
      customer: buyer.name,
      licenseKey,
      from: mailFrom,
      apiKey: resendKey,
      supportEmail,
    });

    console.log("claim: licencia enviada por la vía de respaldo", {
      paymentId,
      to: buyer.email,
    });
    // Se devuelve el mail para que /gracias pueda decir "te lo mandamos a
    // v***@ejemplo.com" y el comprador sepa dónde mirar. Va enmascarado:
    // la respuesta la puede ver cualquiera que tenga el payment_id.
    return json({ status: "sent", email: maskEmail(buyer.email) });
  } catch (cause) {
    console.error("claim: fallo procesando el pago", { paymentId, cause });
    return json({ status: "error" }, 502);
  }
}

/** `vos@ejemplo.com` → `v***@ejemplo.com`. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(user.length - 1, 1))}@${domain}`;
}
