/**
 * GET /api/health — diagnóstico de la configuración del deploy.
 *
 * Existe por lo que costó el bug del `www`: el webhook no llegaba nunca y
 * desde afuera no había NINGUNA forma de ver por qué. Había que entrar a
 * los logs de Vercel, y aun ahí solo aparecía la ausencia de hits, que no
 * dice nada. Esto responde en un GET qué está configurado y con qué URL va
 * a notificar Mercado Pago.
 *
 * ── Qué NO devuelve, y por qué es seguro dejarlo público ────────────────
 * Nunca el VALOR de una variable: solo si está presente (`true`/`false`).
 * Un access token, una API key o el secreto del webhook no salen de acá ni
 * truncados — truncar igual filtra, y no aporta nada que un booleano no
 * diga.
 *
 * La `notificationUrl` sí va entera, pero no es un secreto: es una URL
 * pública nuestra, que cualquiera puede encontrar probando `/api/webhook`.
 * Lo que la protege es la firma HMAC, no que nadie la conozca.
 *
 * Del código de licencia solo se informa si tiene forma de código kiOS.
 * Ese sí es "secreto" en el sentido comercial, así que no se muestra —
 * aunque esté publicado en el repo, no hay razón para servirlo dos veces.
 */
import { resolveSiteUrl } from "./_lib/site-url";
import { DEFAULT_PRICE_ARS, priceARS } from "./_lib/price";

export const config = { runtime: "edge" };

/** Presencia, nunca contenido. */
const puesta = (value: string | undefined) => Boolean(value && value.trim() !== "");

export default async function handler(request: Request): Promise<Response> {
  const { url: siteUrl, mismatch } = resolveSiteUrl(request);

  let precio: number | string;
  try {
    precio = priceARS();
  } catch (cause) {
    // Un precio mal escrito rompe el checkout entero: se reporta como
    // problema, no como un número cualquiera.
    precio = cause instanceof Error ? `INVÁLIDO — ${cause.message}` : "INVÁLIDO";
  }

  const licenseKey = process.env.SHARED_LICENSE_KEY?.trim();

  return new Response(
    JSON.stringify(
      {
        ok: true,
        // Lo que se le pasa a Mercado Pago. Tiene que ser el host canónico
        // y responder sin redirects, o las notificaciones no llegan.
        origenDetectado: siteUrl,
        notificationUrl: `${siteUrl}/api/webhook`,
        // Solo aparece si PUBLIC_SITE_URL contradice al origen real.
        publicSiteUrlDesajustada: mismatch,

        precioARS: precio,
        precioPorDefecto: precio === DEFAULT_PRICE_ARS,

        configurado: {
          MP_ACCESS_TOKEN: puesta(process.env.MP_ACCESS_TOKEN),
          MP_WEBHOOK_SECRET: puesta(process.env.MP_WEBHOOK_SECRET),
          RESEND_API_KEY: puesta(process.env.RESEND_API_KEY),
          MAIL_FROM: puesta(process.env.MAIL_FROM),
          SHARED_LICENSE_KEY: puesta(licenseKey),
        },
        // Se chequea la FORMA, no el valor: el error más común es pegar
        // ahí la clave privada o un placeholder en vez del código.
        licenciaTieneFormaValida: Boolean(licenseKey?.startsWith("KIOS-")),
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Sin caché: se consulta justamente para ver el estado de AHORA.
        "cache-control": "no-store",
      },
    },
  );
}
