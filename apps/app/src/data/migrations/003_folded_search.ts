/**
 * Búsqueda sin acentos ni mayúsculas en productos y clientes.
 *
 * Problema que resuelve: `name LIKE '%turron%' COLLATE NOCASE` NO encuentra
 * "Turrón de maní". NOCASE de SQLite pliega solo la A-Z ASCII — no toca los
 * acentos y ni siquiera convierte "Á" en "á". En el mostrador eso significa
 * que un producto existe pero no aparece, que es peor que no tenerlo.
 *
 * ── Por qué una columna y no una función ────────────────────────────────
 * SQLite (en las tres builds que usa kiOS: tauri-plugin-sql, sqlite-wasm y
 * better-sqlite3) no trae `unaccent` ni ICU, y registrar una colación
 * propia habría que hacerlo tres veces, una por driver. Una columna
 * materializada se calcula una vez al escribir, la indexamos, y la búsqueda
 * queda en un `LIKE` común contra texto ya normalizado.
 *
 * ── Por qué el relleno se arma desde ACCENT_MAP ─────────────────────────
 * Las filas que YA existen hay que normalizarlas acá, en SQL, con
 * `replace()` anidados. Las filas NUEVAS las normaliza el repo en
 * JavaScript. Son dos implementaciones del mismo plegado, y si difieren en
 * un solo carácter el buscador encuentra unos productos sí y otros no sin
 * ningún patrón visible.
 *
 * Por eso el SQL se GENERA a partir del mismo `ACCENT_MAP` que usa el
 * JavaScript: no son dos listas que hay que acordarse de sincronizar, es
 * una sola lista leída dos veces.
 *
 * El índice va sobre la columna nueva y es parcial (`WHERE deleted_at IS
 * NULL`), igual que el resto del esquema: los borrados no se buscan nunca.
 */
import type { Migration } from "./types";
import { ACCENT_PAIRS } from "../../domain/search";

/**
 * Envuelve `column` en los `replace()` anidados que quitan los acentos y
 * cierra con `lower()` para la A-Z ASCII.
 *
 * El orden importa: `lower()` va AL FINAL. Si fuera primero no serviría de
 * nada, porque `lower('Á')` en SQLite devuelve 'Á' — por eso los pares
 * incluyen la forma en mayúscula y apuntan directo a la minúscula base.
 */
function foldSql(column: string): string {
  let expression = column;
  for (const [accented, base] of ACCENT_PAIRS) {
    expression = `replace(${expression}, '${accented}', '${base}')`;
  }
  return `lower(${expression})`;
}

export const migration003: Migration = {
  version: 3,
  name: "folded_search",
  statements: [
    // ── productos ─────────────────────────────────────────────────────
    // ADD COLUMN es O(1) (solo reescribe el schema). Reconstruir la tabla
    // para esto copiaría cada fila e índice de un catálogo entero.
    "ALTER TABLE products ADD COLUMN name_folded TEXT",
    `UPDATE products SET name_folded = ${foldSql("name")}`,
    `CREATE INDEX idx_products_name_folded ON products(name_folded)
       WHERE deleted_at IS NULL`,

    // ── clientes ──────────────────────────────────────────────────────
    // Mismo bug, misma cura: "rocio" tiene que encontrar a "Rocío".
    "ALTER TABLE customers ADD COLUMN name_folded TEXT",
    `UPDATE customers SET name_folded = ${foldSql("name")}`,
    `CREATE INDEX idx_customers_name_folded ON customers(name_folded)
       WHERE deleted_at IS NULL`,
  ],
};
