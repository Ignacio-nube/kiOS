/**
 * Arranque de la compra.
 *
 * La landing NO habla con Mercado Pago: le pide a su propio backend
 * (`/api/checkout`) que cree la preferencia y devuelva el link de pago. El
 * access token de MP es un secreto de servidor; si el navegador pudiera
 * crear preferencias, cualquiera podría crear una de $1 y recibir el mismo
 * código de activación.
 *
 * El precio tampoco viaja desde acá por la misma razón: lo fija el servidor.
 * Lo único que manda el cliente es a nombre de quién va la licencia y a qué
 * casilla mandarla.
 */

export interface BuyerInput {
  name: string;
  email: string;
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

/** Validación de forma, no de existencia: la de verdad la hace el servidor. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isValidName(value: string): boolean {
  return value.trim().length >= 2;
}

export async function startCheckout(buyer: BuyerInput): Promise<CheckoutResult> {
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: buyer.name.trim(), email: buyer.email.trim().toLowerCase() }),
    });

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "No se pudo iniciar el pago. Probá de nuevo en un momento.";
      return { ok: false, message };
    }

    const url = (data as { url?: unknown })?.url;
    if (typeof url !== "string") {
      return { ok: false, message: "El servidor no devolvió un link de pago." };
    }
    return { ok: true, url };
  } catch {
    // Sin red, o el backend caído. Que el copy no culpe al usuario.
    return { ok: false, message: "No pudimos conectarnos. Revisá tu internet y probá de nuevo." };
  }
}
