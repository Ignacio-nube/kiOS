/**
 * Todo el dinero de kiOS son centavos enteros (`*_cents`, INTEGER).
 * La conversión a decimales existe solo en el borde: formatear para
 * mostrar y parsear lo que tipea el usuario. (Herencia de ADR-003.)
 */

const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function formatARS(cents: number): string {
  return formatter.format(cents / 100);
}

/** Sin decimales, para precios de kiosco ("$ 1.500"). */
const wholeFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatARSWhole(cents: number): string {
  return cents % 100 === 0 ? wholeFormatter.format(cents / 100) : formatARS(cents);
}

/**
 * Parsea entrada de usuario es-AR a centavos: "1.500", "1500", "1500,50",
 * "$ 1.500,50". Devuelve null si no es un monto válido o es negativo.
 */
export function parseARSToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", decimals = ""] = cleaned.replace(/\./g, "").split(",");
  const cents = parseInt(whole, 10) * 100 + parseInt(decimals.padEnd(2, "0") || "0", 10);
  return Number.isSafeInteger(cents) ? cents : null;
}
