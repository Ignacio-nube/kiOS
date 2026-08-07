/**
 * Reglas de licencia por dispositivo. Son decisiones de NEGOCIO, no
 * detalles: de acá depende qué se regala y qué se cobra.
 *
 *   demo web  → siempre activada, sin código y sin tope de productos.
 *   escritorio → free hasta que se pegue un código válido.
 *
 * Y la tercera, la menos obvia: una vez activado, el escritorio SIGUE
 * activado aunque el código deje de verificar. Eso es lo que permite rotar
 * la clave para invalidar códigos filtrados sin apagarle la app a los que
 * ya pagaron.
 */
import { beforeEach, describe, expect, it } from "vitest";
import * as ed from "@noble/ed25519";
import { createTestContext, createTestDriver, type TestDriver } from "./test-driver";
import { runMigrations } from "../../src/data/migrations/runner";
import { createRepositories, type Repositories } from "../../src/data/repos";
import { META_KEYS } from "../../src/data/bootstrap";
import { resolveLicense } from "../../src/lib/app-context";
import {
  LICENSE_PUBLIC_KEY_HEX, encodeLicenseKey, verifyLicenseKey,
} from "../../src/domain/license";

const DESKTOP = true;
const WEB = false;

let driver: TestDriver;
let repos: Repositories;

beforeEach(async () => {
  driver = createTestDriver();
  await runMigrations(driver);
  repos = createRepositories(driver, createTestContext());
});

describe("la clave pública embebida", () => {
  it("NO es el placeholder de ceros", () => {
    // Con el placeholder, ningún código funciona y la app cae a free en
    // silencio: se vende una licencia que no activa nada. Este test es el
    // que avisa si alguien revierte license.ts sin querer.
    expect(LICENSE_PUBLIC_KEY_HEX).not.toMatch(/^0+$/);
    expect(LICENSE_PUBLIC_KEY_HEX).toMatch(/^[0-9a-f]{64}$/);
  });

  it("acepta un código firmado con SU par privado y rechaza otro", async () => {
    // No se puede firmar acá con la privada real (no está en el repo, que
    // es justamente el punto), así que se prueba la propiedad: la app
    // acepta exactamente lo que firma la clave de la que salió su pública.
    const priv = ed.utils.randomPrivateKey();
    const pub = Buffer.from(await ed.getPublicKeyAsync(priv)).toString("hex");
    const bytes = new TextEncoder().encode(
      JSON.stringify({ customer: "kiOS", issuedAt: "2026-08-07T00:00:00.000Z" }),
    );
    const key = encodeLicenseKey(bytes, await ed.signAsync(bytes, priv));

    expect(await verifyLicenseKey(key, pub)).not.toBeNull();
    // Contra la pública embebida (otro par) tiene que fallar.
    expect(await verifyLicenseKey(key)).toBeNull();
  });
});

describe("resolveLicense", () => {
  it("la demo web está SIEMPRE activada, sin código", async () => {
    const state = await resolveLicense(repos, WEB);
    expect(state.status).toBe("licensed");
    // Sin tocar `meta`: la demo no persiste ni necesita nada.
    expect(await repos.meta.get(META_KEYS.licenseKey)).toBeNull();
  });

  it("la demo NO se apaga aunque haya un código inválido guardado", async () => {
    await repos.meta.set(META_KEYS.licenseKey, "KIOS-BASURA");
    expect((await resolveLicense(repos, WEB)).status).toBe("licensed");
  });

  it("escritorio sin código arranca en free", async () => {
    expect((await resolveLicense(repos, DESKTOP)).status).toBe("free");
  });

  it("escritorio con un código inválido queda en free, sin romperse", async () => {
    await repos.meta.set(META_KEYS.licenseKey, "no-es-un-codigo");
    expect((await resolveLicense(repos, DESKTOP)).status).toBe("free");
  });

  it("una vez activado sigue activado aunque el código deje de verificar", async () => {
    // Simula la rotación de clave: la constancia quedó de una activación
    // válida anterior, pero el código guardado ya no verifica contra la
    // pública nueva. El cliente que pagó no puede quedarse sin app.
    await repos.meta.set(
      META_KEYS.licenseActivation,
      JSON.stringify({ customer: "Kiosco La Esquina", issuedAt: "2026-01-01T00:00:00.000Z" }),
    );
    await repos.meta.set(META_KEYS.licenseKey, "KIOS-CODIGO-VIEJO");

    const state = await resolveLicense(repos, DESKTOP);
    expect(state.status).toBe("licensed");
    if (state.status === "licensed") {
      expect(state.payload.customer).toBe("Kiosco La Esquina");
    }
  });

  it("una constancia corrupta se ignora en vez de romper el arranque", async () => {
    await repos.meta.set(META_KEYS.licenseActivation, "{esto no es json");
    expect((await resolveLicense(repos, DESKTOP)).status).toBe("free");
  });
});
