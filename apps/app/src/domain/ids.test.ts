import { describe, expect, it } from "vitest";
import { uuidv7, uuidv7Timestamp } from "./ids";

describe("uuidv7", () => {
  it("tiene formato UUID con versión 7 y variante RFC", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("embebe el timestamp y es recuperable", () => {
    const now = 1753142400000;
    expect(uuidv7Timestamp(uuidv7(now))).toBe(now);
  });

  it("ordena lexicográficamente por tiempo", () => {
    const early = uuidv7(1000000000000);
    const late = uuidv7(2000000000000);
    expect(early < late).toBe(true);
  });

  it("no colisiona en una tanda grande", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()));
    expect(ids.size).toBe(10_000);
  });
});
