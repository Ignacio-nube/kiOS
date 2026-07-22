import { describe, expect, it } from "vitest";
import { todayRange } from "./dates";

describe("todayRange", () => {
  it("cubre desde el inicio del día local hasta el inicio del siguiente", () => {
    const now = new Date(2026, 6, 22, 15, 30, 0); // 22 jul 2026, 15:30 local
    const range = todayRange(now);
    const from = new Date(range.from);
    const to = new Date(range.to);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
