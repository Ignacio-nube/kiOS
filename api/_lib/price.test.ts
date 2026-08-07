/**
 * El precio es lo que se le cobra a alguien. Un parseo permisivo de más
 * acá se traduce en cobrar mal, así que se prueban sobre todo las formas
 * de escribirlo mal.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_PRICE_ARS, InvalidPriceError, priceARS } from "./price";

describe("priceARS", () => {
  it("lee un entero de pesos", () => {
    expect(priceARS("35000")).toBe(35_000);
    expect(priceARS("  49000  ")).toBe(49_000);
    expect(priceARS("1")).toBe(1);
  });

  it("sin variable usa el default", () => {
    expect(priceARS(undefined)).toBe(DEFAULT_PRICE_ARS);
    expect(priceARS("")).toBe(DEFAULT_PRICE_ARS);
    expect(priceARS("   ")).toBe(DEFAULT_PRICE_ARS);
  });

  it('RECHAZA "35.000" con punto de miles', () => {
    // Es el error más fácil de cometer al escribirlo en Vercel, y el más
    // caro: `Number("35.000")` da 35, o sea cobrar treinta y cinco pesos.
    expect(() => priceARS("35.000")).toThrow(InvalidPriceError);
  });

  it("rechaza decimales, negativos, cero y basura", () => {
    for (const bad of ["35000.5", "-1", "0", "gratis", "$35000", "35 000", "NaN", "Infinity"]) {
      expect(() => priceARS(bad), `con "${bad}"`).toThrow(InvalidPriceError);
    }
  });

  it("rechaza la notación científica", () => {
    // `Number("3.5e4")` da 35000 y sería correcto de casualidad, pero
    // aceptar esa forma invita a que alguien escriba "1e9" sin pensarlo.
    expect(() => priceARS("3.5e4")).toThrow(InvalidPriceError);
  });

  it("el mensaje de error dice cómo se escribe bien", () => {
    // El que lo lee está en el panel de Vercel a las 11 de la noche.
    expect(() => priceARS("35.000")).toThrow(/35000/);
  });
});
