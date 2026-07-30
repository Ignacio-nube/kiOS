import { describe, expect, it } from "vitest";
import { ACCENT_MAP, ACCENT_PAIRS, foldForSearch } from "./search";

describe("foldForSearch", () => {
  it("resuelve el caso que motivó todo esto", () => {
    // Nadie con gente esperando escribe "Turrón de maní" con las dos tildes.
    expect(foldForSearch("Turrón de maní")).toBe("turron de mani");
    expect(foldForSearch("turron de mani")).toBe("turron de mani");
  });

  it("pliega mayúsculas y acentos a la vez", () => {
    expect(foldForSearch("AZÚCAR 1KG")).toBe("azucar 1kg");
    expect(foldForSearch("Café instantáneo 50g")).toBe("cafe instantaneo 50g");
    expect(foldForSearch("Rocío")).toBe("rocio");
    expect(foldForSearch("Ramón")).toBe("ramon");
  });

  it("pliega la ñ a n", () => {
    // Ortográficamente la ñ es una letra propia, pero acá el objetivo es
    // que "nino" encuentre "niño" — quien busca apurado no va a la tecla.
    expect(foldForSearch("Piñata")).toBe("pinata");
    expect(foldForSearch("DOÑA ROSA")).toBe("dona rosa");
  });

  it("es idempotente: plegar lo ya plegado no cambia nada", () => {
    // Importa porque el término del usuario se pliega en cada tecleada y se
    // compara contra una columna que ya está plegada.
    for (const value of ["Turrón", "AZÚCAR", "Rocío", "sin acentos"]) {
      expect(foldForSearch(foldForSearch(value))).toBe(foldForSearch(value));
    }
  });

  it("no toca números, espacios ni signos", () => {
    expect(foldForSearch("Gaseosa cola 2.25L")).toBe("gaseosa cola 2.25l");
    expect(foldForSearch("Pilas AA x2")).toBe("pilas aa x2");
    expect(foldForSearch("7790001000031")).toBe("7790001000031");
  });

  it("deja pasar intacto lo que no está en el mapa", () => {
    // Si algún día aparece un carácter raro, el buscador lo trata literal
    // en vez de romperse o comérselo.
    expect(foldForSearch("Ω±emoji🙂")).toBe("ω±emoji🙂");
  });
});

describe("ACCENT_PAIRS", () => {
  it("trae cada acentuada en minúscula Y en mayúscula", () => {
    // La migración usa estos pares para armar sus `replace()`. La versión en
    // mayúscula es imprescindible: `lower('Á')` en SQLite devuelve 'Á', así
    // que sin el par en mayúscula las filas viejas quedarían sin plegar.
    expect(ACCENT_PAIRS).toHaveLength(Object.keys(ACCENT_MAP).length * 2);

    for (const [accented, base] of ACCENT_PAIRS) {
      expect(base).toBe(base.toLowerCase());
      expect(foldForSearch(accented)).toBe(base);
    }

    const claves = ACCENT_PAIRS.map(([a]) => a);
    expect(claves).toContain("á");
    expect(claves).toContain("Á");
    expect(claves).toContain("Ñ");
  });
});
