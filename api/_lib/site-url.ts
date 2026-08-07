/**
 * De qué origen se cuelgan los `back_urls` y el `notification_url` que
 * recibe Mercado Pago.
 *
 * ── Por qué no alcanza con PUBLIC_SITE_URL ──────────────────────────────
 * Esto existe por un bug real y caro de diagnosticar: el dominio quedó
 * configurado en Vercel con `www` como canónico, `PUBLIC_SITE_URL` decía
 * `https://kios.click` (sin www), y entonces Vercel respondía **308** a
 * todo lo que llegara ahí.
 *
 * Mercado Pago **no sigue redirects** al notificar. Resultado: el webhook
 * nunca se ejecutaba, no salía ningún mail, y en los logs no había ni un
 * solo hit al endpoint — o sea, ninguna pista de que existiera un problema.
 *
 * La cura es no depender de que alguien escriba bien la variable: el
 * origen se toma del pedido que ya está llegando al servidor. Si el
 * comprador está en `https://www.kios.click`, ése es el host que resuelve
 * de verdad, sin redirects de por medio.
 */

/** El origen desde el que se sirvió este request, ya normalizado. */
export function originFromRequest(request: Request): string {
  // En Vercel el request llega por un proxy, así que el host público está
  // en `x-forwarded-host`; `host` a secas puede ser el interno.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  // Último recurso: la URL del propio request.
  return new URL(request.url).origin;
}

export interface SiteUrlResult {
  /** El que hay que usar. Sin barra final. */
  url: string;
  /**
   * `PUBLIC_SITE_URL` estaba puesta y NO coincide con el origen real.
   * Es la firma exacta del bug del `www`: se avisa fuerte en los logs.
   */
  mismatch: { configured: string; actual: string } | null;
}

/**
 * Prefiere SIEMPRE el origen real del pedido. `PUBLIC_SITE_URL` queda como
 * documentación y como señal de alarma: si difiere, algo está mal
 * configurado y conviene que quede escrito en el log.
 */
export function resolveSiteUrl(request: Request): SiteUrlResult {
  const actual = originFromRequest(request).replace(/\/+$/, "");
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  return {
    url: actual,
    mismatch: configured && configured !== actual ? { configured, actual } : null,
  };
}
