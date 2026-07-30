/**
 * La ventana de páginas es la única lógica del componente, y la que se rompe
 * en silencio: un off-by-one deja la última página inalcanzable.
 */
import { describe, expect, it } from "vitest";
import { pageWindow } from "./pagination";

describe("pageWindow", () => {
  it("muestra todas las páginas cuando entran sin elipsis", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("colapsa con elipsis cuando la actual está en el medio", () => {
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
  });

  it("no pone elipsis para esconder UNA sola página (ocuparía lo mismo)", () => {
    // current=4/7 deja huecos 1→3 y 5→7: ambos de UNA página, así que se
    // rellenan y no aparece ninguna elipsis.
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Igual del lado derecho: 4→6 esconde solo la 5.
    expect(pageWindow(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("siempre incluye la primera y la última", () => {
    for (const total of [1, 2, 7, 40, 500]) {
      // Solo páginas válidas: la actual va siempre clampeada a [1, total].
      const currents = new Set([1, 2, Math.ceil(total / 2), total].filter((p) => p <= total));
      for (const current of currents) {
        const window = pageWindow(current, total);
        expect(window[0]).toBe(1);
        expect(window[window.length - 1]).toBe(total);
        // Y la actual siempre es alcanzable de un clic.
        expect(window).toContain(current);
      }
    }
  });

  it("nunca ofrece páginas fuera de rango", () => {
    for (const total of [1, 3, 9, 25]) {
      for (let current = 1; current <= total; current++) {
        const numbers = pageWindow(current, total).filter((p): p is number => p !== "gap");
        expect(numbers.every((p) => p >= 1 && p <= total)).toBe(true);
        // Y sin repetidos: dos botones a la misma página es un bug visual.
        expect(new Set(numbers).size).toBe(numbers.length);
      }
    }
  });
});
