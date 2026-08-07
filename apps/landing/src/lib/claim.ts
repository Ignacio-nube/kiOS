/**
 * Red de seguridad del lado del cliente: al volver de Mercado Pago,
 * `/gracias` le pide al servidor que reconfirme el pago y mande el código
 * si el webhook no llegó.
 *
 * El navegador NO decide nada: solo pasa el `payment_id` que MP puso en la
 * URL. Todo lo que importa —que el pago exista, esté aprobado, sea por el
 * monto correcto y a quién mandarle el mail— lo resuelve el servidor
 * consultando la API de MP. Ver `api/claim.ts`.
 */

export type ClaimStatus =
  /** Todavía no se sabe (no hay payment_id en la URL). */
  | { kind: "idle" }
  | { kind: "checking" }
  /** El mail salió. `email` viene enmascarado por el servidor. */
  | { kind: "sent"; email: string; licenseKey: string }
  /** El pago es válido pero el mail no salió: el código se muestra igual. */
  | { kind: "email_failed"; licenseKey: string }
  /** El pago existe pero no está acreditado todavía. */
  | { kind: "pending" }
  /** Algo no cierra y hay que mirarlo a mano. */
  | { kind: "manual" }
  | { kind: "error" };

/**
 * Mercado Pago vuelve con varios parámetros; el que importa es el id del
 * pago. Manda `payment_id` y también `collection_id` con el mismo valor
 * según el flujo, así que se aceptan los dos.
 */
export function paymentIdFromUrl(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("payment_id") ?? params.get("collection_id");
  if (!raw || !/^\d+$/.test(raw)) return null;
  return raw;
}

export async function claimLicense(paymentId: string): Promise<ClaimStatus> {
  try {
    const response = await fetch("/api/claim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    const data = (await response.json().catch(() => null)) as
      | { status?: string; email?: string; licenseKey?: string }
      | null;

    switch (data?.status) {
      case "sent":
        return {
          kind: "sent",
          email: data.email ?? "",
          licenseKey: data.licenseKey ?? "",
        };
      case "email_failed":
        return { kind: "email_failed", licenseKey: data.licenseKey ?? "" };
      case "pending":
        return { kind: "pending" };
      case "manual":
        return { kind: "manual" };
      default:
        return { kind: "error" };
    }
  } catch {
    return { kind: "error" };
  }
}
