import { describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import {
  base32Decode, base32Encode, encodeLicenseKey, verifyLicenseKey, type LicensePayload,
} from "./license";

async function makeSignedKey(payload: LicensePayload) {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKeyHex = Buffer.from(await ed.getPublicKeyAsync(privateKey)).toString("hex");
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = await ed.signAsync(payloadBytes, privateKey);
  return { key: encodeLicenseKey(payloadBytes, signature), publicKeyHex };
}

const payload: LicensePayload = {
  customer: "Kiosco Doña Rosa",
  issuedAt: "2026-07-22T12:00:00.000Z",
};

describe("base32", () => {
  it("roundtrip de bytes arbitrarios", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 7]);
    expect(Array.from(base32Decode(base32Encode(bytes))!)).toEqual(Array.from(bytes));
  });

  it("decode rechaza caracteres fuera del alfabeto", () => {
    expect(base32Decode("AB!")).toBeNull();
  });
});

describe("verifyLicenseKey", () => {
  it("acepta una clave firmada válida y devuelve el payload", async () => {
    const { key, publicKeyHex } = await makeSignedKey(payload);
    expect(key.startsWith("KIOS-")).toBe(true);
    const result = await verifyLicenseKey(key, publicKeyHex);
    expect(result).toEqual(payload);
  });

  it("tolera minúsculas y espacios alrededor", async () => {
    const { key, publicKeyHex } = await makeSignedKey(payload);
    expect(await verifyLicenseKey(`  ${key.toLowerCase()}  `, publicKeyHex)).toEqual(payload);
  });

  it("rechaza una clave adulterada", async () => {
    const { key, publicKeyHex } = await makeSignedKey(payload);
    // Se adultera un carácter del MEDIO (los del final solo tocan bits de
    // relleno base32 que el decoder estricto ya rechaza por separado).
    const i = Math.floor(key.length / 2);
    const original = key[i] === "-" ? key[i + 1]! : key[i]!;
    const j = key[i] === "-" ? i + 1 : i;
    const replacement = original === "A" ? "B" : "A";
    const flipped = key.slice(0, j) + replacement + key.slice(j + 1);
    expect(await verifyLicenseKey(flipped, publicKeyHex)).toBeNull();
  });

  it("rechaza claves firmadas con OTRA clave privada", async () => {
    const { key } = await makeSignedKey(payload);
    const other = await makeSignedKey(payload);
    expect(await verifyLicenseKey(key, other.publicKeyHex)).toBeNull();
  });

  it("nunca lanza ante basura", async () => {
    for (const garbage of ["", "KIOS-", "KIOS-ZZZ", "hola", "KIOS-ABCDE-12345"]) {
      expect(await verifyLicenseKey(garbage, "00".repeat(32))).toBeNull();
    }
  });
});
