/**
 * Esto existe por el bug que dejó al webhook sin recibir NADA: el dominio
 * canónico era `www.kios.click`, `PUBLIC_SITE_URL` decía `kios.click`, y
 * Mercado Pago recibía un 308 que no sigue. Cero notificaciones, cero
 * mails, cero pistas en los logs.
 */
import { afterEach, describe, expect, it } from "vitest";
import { originFromRequest, resolveSiteUrl } from "./site-url";

const req = (headers: Record<string, string>, url = "https://interno.vercel.app/api/checkout") =>
  new Request(url, { headers });

afterEach(() => {
  delete process.env.PUBLIC_SITE_URL;
});

describe("originFromRequest", () => {
  it("prefiere x-forwarded-host, que es el host PÚBLICO detrás del proxy", () => {
    expect(
      originFromRequest(req({ "x-forwarded-host": "www.kios.click", host: "interno.vercel.app" })),
    ).toBe("https://www.kios.click");
  });

  it("cae a `host` si no hay forwarded", () => {
    expect(originFromRequest(req({ host: "www.kios.click" }))).toBe("https://www.kios.click");
  });

  it("respeta x-forwarded-proto", () => {
    expect(
      originFromRequest(req({ "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" })),
    ).toBe("http://localhost:3000");
  });

  it("sin headers usa la URL del request", () => {
    expect(originFromRequest(new Request("https://www.kios.click/api/checkout"))).toBe(
      "https://www.kios.click",
    );
  });
});

describe("resolveSiteUrl", () => {
  it("usa el origen REAL aunque PUBLIC_SITE_URL diga otra cosa", () => {
    // El corazón del arreglo: la variable mal escrita ya no puede romper
    // las notificaciones, porque no es la que manda.
    process.env.PUBLIC_SITE_URL = "https://kios.click";
    const { url } = resolveSiteUrl(req({ "x-forwarded-host": "www.kios.click" }));
    expect(url).toBe("https://www.kios.click");
  });

  it("reporta el desajuste para que quede en los logs", () => {
    process.env.PUBLIC_SITE_URL = "https://kios.click";
    const { mismatch } = resolveSiteUrl(req({ "x-forwarded-host": "www.kios.click" }));
    expect(mismatch).toEqual({
      configured: "https://kios.click",
      actual: "https://www.kios.click",
    });
  });

  it("no reporta nada cuando coinciden", () => {
    process.env.PUBLIC_SITE_URL = "https://www.kios.click";
    expect(resolveSiteUrl(req({ "x-forwarded-host": "www.kios.click" })).mismatch).toBeNull();
  });

  it("la barra final no cuenta como desajuste", () => {
    process.env.PUBLIC_SITE_URL = "https://www.kios.click/";
    expect(resolveSiteUrl(req({ "x-forwarded-host": "www.kios.click" })).mismatch).toBeNull();
  });

  it("sin PUBLIC_SITE_URL funciona igual y no alarma", () => {
    const { url, mismatch } = resolveSiteUrl(req({ "x-forwarded-host": "www.kios.click" }));
    expect(url).toBe("https://www.kios.click");
    expect(mismatch).toBeNull();
  });

  it("la notification_url que se arma no tiene doble barra", () => {
    process.env.PUBLIC_SITE_URL = "https://www.kios.click/";
    const { url } = resolveSiteUrl(req({ "x-forwarded-host": "www.kios.click" }));
    expect(`${url}/api/webhook`).toBe("https://www.kios.click/api/webhook");
  });
});
