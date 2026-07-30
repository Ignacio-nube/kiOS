/**
 * La validación de firma del webhook es lo único que separa "vendo kiOS" de
 * "regalo kiOS a cualquiera que sepa hacer un curl". Va cubierta a fondo.
 */
import { describe, expect, it } from "vitest";
import { isValidSignature, timingSafeEqual } from "./mercadopago";

const SECRET = "un-secreto-de-webhook";

/** Arma la firma como la arma Mercado Pago, para poder probar el camino feliz. */
async function sign(manifest: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TS = "1785400000";
const DATA_ID = "123456789";
const REQUEST_ID = "abc-def-123";

async function validHeader(): Promise<string> {
  const v1 = await sign(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`);
  return `ts=${TS},v1=${v1}`;
}

describe("isValidSignature", () => {
  it("acepta una notificación legítima", async () => {
    expect(
      await isValidSignature({
        signatureHeader: await validHeader(),
        requestId: REQUEST_ID,
        dataId: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it("acepta cuando no viene request-id (el manifiesto lo omite)", async () => {
    const v1 = await sign(`id:${DATA_ID};ts:${TS};`);
    expect(
      await isValidSignature({
        signatureHeader: `ts=${TS},v1=${v1}`,
        requestId: null,
        dataId: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it("normaliza el id a minúsculas, como documenta MP", async () => {
    const v1 = await sign(`id:pay-abc123;request-id:${REQUEST_ID};ts:${TS};`);
    expect(
      await isValidSignature({
        signatureHeader: `ts=${TS},v1=${v1}`,
        requestId: REQUEST_ID,
        dataId: "PAY-ABC123",
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it("RECHAZA si el secreto no es el nuestro", async () => {
    const v1 = await sign(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`, "otro-secreto");
    expect(
      await isValidSignature({
        signatureHeader: `ts=${TS},v1=${v1}`,
        requestId: REQUEST_ID,
        dataId: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it("RECHAZA si alguien cambia el id del pago manteniendo la firma", async () => {
    // El ataque obvio: interceptar una notificación real y apuntarla a otro
    // pago. La firma cubre el id, así que no cierra.
    expect(
      await isValidSignature({
        signatureHeader: await validHeader(),
        requestId: REQUEST_ID,
        dataId: "999999999",
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it("RECHAZA headers ausentes o mal formados, sin explotar", async () => {
    const cases: { signatureHeader: string | null; dataId: string | null }[] = [
      { signatureHeader: null, dataId: DATA_ID },
      { signatureHeader: await validHeader(), dataId: null },
      { signatureHeader: "", dataId: DATA_ID },
      { signatureHeader: "basura", dataId: DATA_ID },
      { signatureHeader: `ts=${TS}`, dataId: DATA_ID },
      { signatureHeader: "v1=abc", dataId: DATA_ID },
      { signatureHeader: `ts=${TS},v1=`, dataId: DATA_ID },
    ];
    for (const { signatureHeader, dataId } of cases) {
      expect(
        await isValidSignature({ signatureHeader, requestId: REQUEST_ID, dataId, secret: SECRET }),
      ).toBe(false);
    }
  });

  it("tolera espacios alrededor de los campos del header", async () => {
    const v1 = await sign(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`);
    expect(
      await isValidSignature({
        signatureHeader: ` ts = ${TS} , v1 = ${v1} `.replace(/ = /g, "="),
        requestId: REQUEST_ID,
        dataId: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(true);
  });
});

describe("timingSafeEqual", () => {
  it("compara por igualdad real", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});
