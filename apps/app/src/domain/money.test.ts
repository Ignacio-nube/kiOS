import { describe, expect, it } from "vitest";
import { formatARS, formatARSWhole, parseARSToCents } from "./money";

describe("formatARS", () => {
  it("formatea centavos como pesos es-AR", () => {
    // Intl puede usar espacio común o no-break: normalizamos para comparar.
    expect(formatARS(150050).replace(/\s/g, " ")).toBe("$ 1.500,50");
    expect(formatARS(0).replace(/\s/g, " ")).toBe("$ 0,00");
  });

  it("formatARSWhole omite decimales cuando son ,00", () => {
    expect(formatARSWhole(150000).replace(/\s/g, " ")).toBe("$ 1.500");
    expect(formatARSWhole(150050).replace(/\s/g, " ")).toBe("$ 1.500,50");
  });
});

describe("parseARSToCents", () => {
  it("acepta las formas usuales es-AR", () => {
    expect(parseARSToCents("1500")).toBe(150000);
    expect(parseARSToCents("1.500")).toBe(150000);
    expect(parseARSToCents("1.500,50")).toBe(150050);
    expect(parseARSToCents("1500,5")).toBe(150050);
    expect(parseARSToCents("$ 1.500,50")).toBe(150050);
    expect(parseARSToCents("0,99")).toBe(99);
  });

  it("rechaza basura", () => {
    expect(parseARSToCents("")).toBeNull();
    expect(parseARSToCents("abc")).toBeNull();
    expect(parseARSToCents("1.50")).toBeNull(); // miles mal agrupados
    expect(parseARSToCents("1,234")).toBeNull(); // tres decimales
    expect(parseARSToCents("-5")).toBeNull();
  });
});
