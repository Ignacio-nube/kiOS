import { describe, expect, it } from "vitest";
import { createTestDriver } from "./test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { ensureIdentity } from "../../src/data/bootstrap";

describe("identidad local", () => {
  it("genera tenant_id y device_id una sola vez y los reusa", async () => {
    const driver = createTestDriver();
    await runMigrations(driver);

    const first = await ensureIdentity(driver);
    expect(first.tenantId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.tenantId).not.toBe(first.deviceId);

    const second = await ensureIdentity(driver);
    expect(second.tenantId).toBe(first.tenantId);
    expect(second.deviceId).toBe(first.deviceId);
  });
});
