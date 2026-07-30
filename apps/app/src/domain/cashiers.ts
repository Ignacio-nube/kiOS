/**
 * Reglas puras de cajeros. Un cajero es SOLO una identidad: quién está
 * atendiendo la caja. Sin clave, sin roles, sin permisos — sirve para
 * atribuir ventas y cerrar la caja, no para controlar accesos.
 */

/** Largo máximo de un nombre de cajero (entra en el rail y en el ticket). */
export const CASHIER_NAME_MAX = 40;

/**
 * Nombre del cajero principal cuando todavía no hay ninguno: el del negocio,
 * o "Principal" si el kiosquero no lo cargó. Es un valor INICIAL, no un
 * espejo: si después renombra el negocio, el cajero conserva su nombre.
 */
export function defaultCashierName(businessName: string): string {
  return normalizeCashierName(businessName) || "Principal";
}

/** Recorta y colapsa espacios internos (se tipea apurado en el mostrador). */
export function normalizeCashierName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isValidCashierName(raw: string): boolean {
  const name = normalizeCashierName(raw);
  return name.length > 0 && name.length <= CASHIER_NAME_MAX;
}
