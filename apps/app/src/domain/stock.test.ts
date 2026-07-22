import { describe, expect, it } from "vitest";
import { stockStatus } from "./stock";

describe("stockStatus", () => {
  it("out con 0 o negativo", () => {
    expect(stockStatus(0, 5)).toBe("out");
    expect(stockStatus(-3, null)).toBe("out");
  });

  it("low en o bajo el umbral", () => {
    expect(stockStatus(5, 5)).toBe("low");
    expect(stockStatus(3, 5)).toBe("low");
  });

  it("ok sobre el umbral o sin umbral", () => {
    expect(stockStatus(6, 5)).toBe("ok");
    expect(stockStatus(1, null)).toBe("ok");
  });
});
