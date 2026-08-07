/**
 * Todo lo que cambia entre "todavía no lancé" y "estoy vendiendo" vive acá.
 *
 * Las URLs entran por entorno porque el dominio y la release firmada se
 * consiguen DESPUÉS de que la landing exista. Cuando una falta, el CTA no
 * desaparece: se muestra deshabilitado con el motivo (ver `ctaState`). Una
 * landing con botones fantasma es peor que una que admite qué falta.
 */

/**
 * Demo web. Por defecto `/demo` del MISMO dominio: la landing y la demo se
 * publican juntas, en un solo proyecto de Vercel (ver `vercel.json` y
 * `scripts/build-vercel.mjs`), así que no hace falta configurar nada para
 * que el botón funcione.
 *
 * La variable sigue existiendo para poder apuntar a otro lado —por ejemplo
 * al dev server de la app mientras se trabaja en local— sin tocar código.
 */
export const DEMO_URL = (import.meta.env.VITE_DEMO_URL as string | undefined) ?? "/demo";

/**
 * Instalador de escritorio: el asset de la release de GitHub.
 *
 * Se eligió sobre Google Drive por dos razones concretas: Drive intercala
 * una página de "Virus scan warning" ante cualquier `.exe` (hay que
 * sortearla con `&confirm=t`), y el link no queda atado a una versión. Acá
 * la URL lleva el tag adentro, así que `v0.1.0` va a servir siempre ese
 * binario aunque después se publique otro.
 *
 * Al sacar una versión nueva hay que actualizar el tag de esta URL.
 */
export const DOWNLOAD_URL =
  (import.meta.env.VITE_DOWNLOAD_URL as string | undefined) ??
  "https://github.com/Ignacio-nube/kiOS/releases/download/v0.1.0/kiOS_0.1.0_x64-setup.exe";

/** Contacto de soporte que se muestra en el pie y en el mail de compra. */
export const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? "hola@kios.click";

/**
 * Precio de la licencia EN PESOS ENTEROS. Vive acá y no en la copy suelta
 * porque lo lee tanto el cartel de Precios como el checkout de Mercado
 * Pago: si divergen, el usuario ve un precio y paga otro.
 */
export const PRICE_ARS = 35_000;

/** Tope de productos del plan gratis. Espeja `domain/entitlements.ts`. */
export const FREE_PRODUCT_LIMIT = 50;

// ── Cómo se cobra ───────────────────────────────────────────────────────

/**
 * `"whatsapp"` → el botón de compra abre un chat; la transferencia y la
 * entrega del código se coordinan a mano.
 * `"mercadopago"` → checkout automático (`BuyDialog` + `api/`).
 *
 * Empieza en WhatsApp a propósito: vender a mano las primeras veces deja
 * ver qué pregunta la gente antes de automatizar la respuesta equivocada.
 * El camino de Mercado Pago queda ENTERO y testeado — cambiar esta línea
 * a `"mercadopago"` lo enciende, sin tocar nada más.
 */
export const SALES_MODE: "whatsapp" | "mercadopago" = "whatsapp";

/**
 * Número de WhatsApp en formato internacional, sin `+` ni separadores.
 *
 * Para Argentina va `54` + `9` + característica sin el 0 + número sin el
 * 15. El `9` es el que marca "celular" y es el error clásico: sin él,
 * wa.me abre un chat con un número que no existe.
 *
 *   54  9  381  4012380   →   +54 9 381 401-2380
 */
export const WHATSAPP_NUMBER = "5493813393590";

/** Cómo se muestra el número en pantalla (legible, no para el link). */
export const WHATSAPP_DISPLAY = "381 339-3590";

/**
 * Chat con el mensaje ya escrito. Que el visitante no tenga que redactar
 * nada baja mucho la fricción, y de paso llegan todas las consultas con
 * el mismo texto: se distingue de una las que vienen de la landing.
 */
export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const formatARS = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);

export interface CtaState {
  href: string;
  disabled: boolean;
  /** Por qué no se puede todavía; va al `title` del enlace. */
  reason?: string;
}

export function ctaState(url: string | undefined, reason: string): CtaState {
  return url ? { href: url, disabled: false } : { href: "#", disabled: true, reason };
}

export const demoCta = () => ctaState(DEMO_URL, "La demo todavía no está publicada");
export const downloadCta = () => ctaState(DOWNLOAD_URL, "El instalador todavía no está publicado");
