/**
 * Normalización de texto para buscar: sin acentos y sin mayúsculas.
 *
 * El problema real: nadie con gente esperando en el mostrador escribe
 * "Turrón de maní" con las dos tildes. Escribe "turron" y espera que
 * aparezca. Con `LIKE … COLLATE NOCASE` no aparecía, porque NOCASE de
 * SQLite pliega SOLO la A-Z ASCII: no toca los acentos y ni siquiera pasa
 * "Á" a "á".
 *
 * ── Por qué un mapa explícito y no `normalize("NFD")` ──────────────────
 * La tentación es `value.normalize("NFD").replace(/\p{M}/gu, "")`, que
 * pliega TODOS los diacríticos del Unicode de una. El problema es que este
 * plegado también tiene que existir en SQL: la migración 003 rellena
 * `products.name_folded` de las filas que ya estaban, y SQLite no tiene
 * `unaccent` ni `normalize` — solo `replace()`.
 *
 * Si el JS plegara más caracteres que el SQL, las filas viejas quedarían
 * normalizadas distinto que las nuevas y el buscador encontraría unas sí y
 * otras no, sin ningún patrón visible. Con un mapa explícito y compartido
 * (la migración IMPORTA `ACCENT_MAP` de acá para armar sus `replace`) las
 * dos implementaciones no pueden divergir: son la misma lista.
 *
 * `ñ` se pliega a `n` a propósito. En español es una letra propia y no un
 * acento, pero acá el objetivo no es ortográfico sino que "nino" encuentre
 * "niño" — y quien busca apurado no va a ir a buscar la tecla.
 */

/**
 * Acentuada → base. Cubre lo que aparece en un catálogo de kiosco
 * argentino, con algún vecino del portugués/italiano por las dudas.
 * Fuente ÚNICA: la migración 003 arma su SQL a partir de este mismo mapa.
 */
export const ACCENT_MAP: Readonly<Record<string, string>> = {
  á: "a", à: "a", ä: "a", â: "a", ã: "a", å: "a",
  é: "e", è: "e", ë: "e", ê: "e",
  í: "i", ì: "i", ï: "i", î: "i",
  ó: "o", ò: "o", ö: "o", ô: "o", õ: "o",
  ú: "u", ù: "u", ü: "u", û: "u",
  ñ: "n",
  ç: "c",
  ý: "y", ÿ: "y",
};

/** Los mismos pares con la acentuada en MAYÚSCULA (el destino sigue en minúscula). */
export const ACCENT_PAIRS: readonly (readonly [string, string])[] = Object.entries(ACCENT_MAP)
  .flatMap(([accented, base]) => [
    [accented, base] as const,
    [accented.toUpperCase(), base] as const,
  ]);

/**
 * Texto listo para comparar: minúsculas y sin acentos.
 *
 * Se aplica a AMBOS lados de la comparación — a lo que se guarda en
 * `products.name_folded` y a lo que el usuario tipea. Comparar un lado
 * plegado contra otro sin plegar no arregla nada.
 */
export function foldForSearch(value: string): string {
  let out = "";
  for (const char of value.toLowerCase()) {
    out += ACCENT_MAP[char] ?? char;
  }
  return out;
}
