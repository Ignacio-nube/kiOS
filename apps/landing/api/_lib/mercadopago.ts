/**
 * Lo que hace falta de Mercado Pago, con `fetch` pelado.
 *
 * Sin el SDK a propósito: se usan dos endpoints y una validación de firma.
 * Un SDK acá sumaría dependencia, peso de bundle y una capa más donde
 * mirar cuando algo falle, a cambio de nada.
 */

const API = "https://api.mercadopago.com";

// ── Preferencia de pago (Checkout Pro) ──────────────────────────────────

export interface PreferenceInput {
  title: string;
  priceARS: number;
  /** Nuestro identificador de la compra; vuelve en el pago. */
  externalReference: string;
  payerEmail: string;
  siteUrl: string;
  accessToken: string;
}

export async function createPreference(input: PreferenceInput): Promise<string> {
  const response = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          title: input.title,
          quantity: 1,
          unit_price: input.priceARS,
          currency_id: "ARS",
        },
      ],
      payer: { email: input.payerEmail },
      external_reference: input.externalReference,
      back_urls: {
        success: `${input.siteUrl}/gracias`,
        pending: `${input.siteUrl}/gracias`,
        failure: `${input.siteUrl}/?pago=fallido`,
      },
      auto_return: "approved",
      notification_url: `${input.siteUrl}/api/webhook`,
      // El binary mode evita el estado "in_process": o se aprueba o se
      // rechaza. Sin esto hay compras que quedan colgadas días y el cliente
      // espera un mail que no llega hasta que MP se decide.
      binary_mode: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago rechazó la preferencia (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { init_point?: string };
  if (!data.init_point) throw new Error("Mercado Pago no devolvió init_point");
  return data.init_point;
}

// ── Consulta del pago ───────────────────────────────────────────────────

export interface Payment {
  id: number;
  status: string;
  transaction_amount: number;
  external_reference: string | null;
  date_approved: string | null;
  payer?: { email?: string | null };
}

export async function fetchPayment(paymentId: string, accessToken: string): Promise<Payment> {
  const response = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`No se pudo leer el pago ${paymentId} (${response.status})`);
  }
  return (await response.json()) as Payment;
}

// ── Validación de la firma del webhook ──────────────────────────────────

/**
 * Mercado Pago firma cada notificación con HMAC-SHA256 sobre un manifiesto
 * armado con el id del recurso, el `x-request-id` y el timestamp:
 *
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * ESTO NO ES OPCIONAL. El webhook es una URL pública que, al recibir un
 * "pago aprobado", emite una licencia y la manda por mail. Sin verificar la
 * firma, cualquiera que adivine la URL se autoemite licencias gratis con un
 * `curl`. Es la diferencia entre cobrar y regalar el producto.
 *
 * Se re-consulta el pago contra la API igual (abajo), así que un atacante
 * necesitaría además un payment id real y aprobado — pero la firma es la
 * primera puerta y la más barata.
 */
export async function isValidSignature(params: {
  /** Header `x-signature`: "ts=1704908010,v1=abc123…" */
  signatureHeader: string | null;
  /** Header `x-request-id`. */
  requestId: string | null;
  /** Query param `data.id` de la URL de notificación. */
  dataId: string | null;
  secret: string;
}): Promise<boolean> {
  const { signatureHeader, requestId, dataId, secret } = params;
  if (!signatureHeader || !dataId) return false;

  const parts = new Map(
    signatureHeader.split(",").map((piece) => {
      const [key, ...rest] = piece.split("=");
      return [key?.trim() ?? "", rest.join("=").trim()];
    }),
  );
  const ts = parts.get("ts");
  const received = parts.get("v1");
  if (!ts || !received) return false;

  // MP documenta que si el id es alfanumérico va en minúsculas.
  let manifest = `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return timingSafeEqual(expected, received);
}

/**
 * Comparación de tiempo constante. Un `===` sobre strings corta en el
 * primer carácter distinto, y esa diferencia de microsegundos alcanza para
 * ir adivinando la firma byte a byte.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
