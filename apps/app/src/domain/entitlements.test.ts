import { describe, expect, it } from "vitest";
import { canAddProduct, getEntitlements } from "./entitlements";

describe("entitlements", () => {
  it("free: tope de 50 productos", () => {
    const ent = getEntitlements({ status: "free" });
    expect(ent.maxProducts).toBe(50);
    expect(canAddProduct(ent, 0)).toBe(true);
    expect(canAddProduct(ent, 49)).toBe(true);
    expect(canAddProduct(ent, 50)).toBe(false);
  });

  it("con licencia: sin límite", () => {
    const ent = getEntitlements({
      status: "licensed",
      payload: { customer: "Kiosco Doña Rosa", issuedAt: "2026-07-22T00:00:00Z" },
    });
    expect(ent.maxProducts).toBeNull();
    expect(canAddProduct(ent, 100000)).toBe(true);
  });
});
