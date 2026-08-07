/**
 * El precio de la licencia, del lado del SERVIDOR.
 *
 * ── Por qué la variable se llama VITE_PRICE_ARS ─────────────────────────
 * Parece un error tenerla con prefijo `VITE_` en código de servidor, pero
 * es a propósito y es el punto entero de este archivo.
 *
 * El precio se muestra en la landing (cliente) y se cobra en el checkout
 * (servidor). Si fueran dos variables distintas, tarde o temprano alguien
 * cambia una y no la otra: el cartel dice $35.000 y Mercado Pago cobra
 * otra cosa. Con UNA sola variable eso es imposible.
 *
 * Que funcione para los dos lados es una propiedad de Vite y de Vercel: el
 * prefijo `VITE_` decide qué se EXPONE al bundle del navegador, no dónde
 * se puede leer. En el servidor, `process.env` ve todas las variables del
 * proyecto, tengan el prefijo o no.
 *
 * ── Por qué no hay fallback silencioso a un default ─────────────────────
 * Si la variable falta o está mal escrita, el cliente cae a su default y
 * el servidor podría caer a otro. Acá se elige fallar: es preferible que
 * el checkout devuelva un error a que cobre un precio que nadie decidió.
 */

/** El mismo default que `apps/landing/src/lib/config.ts`. */
export const DEFAULT_PRICE_ARS = 35_000;

export class InvalidPriceError extends Error {
  constructor(raw: string | undefined) {
    super(
      `VITE_PRICE_ARS inválido (${JSON.stringify(raw)}). ` +
        "Tiene que ser un entero de pesos mayor a 0, sin puntos ni símbolos: 35000",
    );
  }
}

/**
 * Precio en PESOS ENTEROS. Sin la variable, el default; con una variable
 * presente pero inservible, lanza — un precio mal tipeado no se redondea
 * a algo razonable, se corta.
 */
export function priceARS(raw: string | undefined = process.env.VITE_PRICE_ARS): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_PRICE_ARS;

  const text = raw.trim();

  /**
   * Se valida el TEXTO, no el número parseado, y ésa es la parte que
   * importa: `Number("35.000")` no falla — devuelve **35**. Escribir el
   * precio con punto de miles es el error más fácil de cometer en el panel
   * de Vercel, y validando el resultado en vez de la forma se cobrarían
   * treinta y cinco pesos sin que nada avise.
   *
   * Solo dígitos: sin puntos, sin comas, sin signos, sin notación
   * científica (`1e9` es demasiado fácil de tipear de más).
   */
  if (!/^\d+$/.test(text)) throw new InvalidPriceError(raw);

  const value = Number(text);
  if (!Number.isSafeInteger(value) || value <= 0) throw new InvalidPriceError(raw);
  return value;
}
