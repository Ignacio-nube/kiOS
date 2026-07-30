import { describe, expect, it } from "vitest";
import { defaultCashierName, isValidCashierName, normalizeCashierName } from "./cashiers";

describe("defaultCashierName", () => {
  it("usa el nombre del negocio", () => {
    expect(defaultCashierName("Kiosco La Esquina")).toBe("Kiosco La Esquina");
  });

  it("cae a Principal si el negocio no tiene nombre", () => {
    expect(defaultCashierName("")).toBe("Principal");
    expect(defaultCashierName("   ")).toBe("Principal");
  });
});

describe("normalizeCashierName", () => {
  it("recorta y colapsa espacios", () => {
    expect(normalizeCashierName("  Juan   Pérez  ")).toBe("Juan Pérez");
  });
});

describe("isValidCashierName", () => {
  it("rechaza vacío o solo espacios", () => {
    expect(isValidCashierName("")).toBe(false);
    expect(isValidCashierName("   ")).toBe(false);
  });

  it("acepta un nombre normal", () => {
    expect(isValidCashierName("Rocío")).toBe(true);
  });

  it("rechaza nombres que no entran en el rail ni en el ticket", () => {
    expect(isValidCashierName("a".repeat(40))).toBe(true);
    expect(isValidCashierName("a".repeat(41))).toBe(false);
  });
});
