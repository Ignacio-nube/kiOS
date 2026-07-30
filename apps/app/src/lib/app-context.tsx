/**
 * Bootstrap y contexto global de la app.
 *
 * `bootOnce` es una promesa singleton A NIVEL MÓDULO: React StrictMode
 * monta los efectos dos veces en dev; dos `createDriver()` concurrentes
 * abren dos conexiones y en OPFS la segunda encuentra el archivo lockeado
 * y degrada a memoria (base vacía). Con la promesa cacheada, ambos
 * montajes comparten el mismo driver. (Gotcha heredado de kioskito.)
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import { createDriver } from "../data/drivers/detect";
import { runMigrations } from "../data/migrations/runner";
import { ensureIdentity, META_KEYS } from "../data/bootstrap";
import { createRepositories, type Repositories } from "../data/repos";
import { seedDemoDataIfEmpty } from "../data/seed";
import { getEntitlements, type Entitlements } from "../domain/entitlements";
import { verifyLicenseKey, type LicensePayload, type LicenseState } from "../domain/license";

interface BootResult {
  repos: Repositories;
  isDesktop: boolean;
  /** false solo en la demo web sin OPFS (datos en memoria). */
  persisted: boolean;
}

let bootPromise: Promise<BootResult> | null = null;

function bootOnce(): Promise<BootResult> {
  bootPromise ??= (async () => {
    const bundle = await createDriver();
    await runMigrations(bundle.driver);
    const ctx = await ensureIdentity(bundle.driver);
    const repos = createRepositories(bundle.driver, ctx);
    if (bundle.kind === "wasm") {
      await seedDemoDataIfEmpty(repos);
    }
    return {
      repos,
      isDesktop: bundle.kind === "tauri",
      persisted: bundle.persisted,
    };
  })();
  return bootPromise;
}

/**
 * Licencia sintética de la demo web: la demo va SIEMPRE activada (sin tope
 * de productos) para que se pueda probar la app completa sin fricción de
 * activación. No se persiste ni se firma — vive solo mientras la pestaña
 * está abierta. En escritorio esto no aplica: ahí manda la clave real.
 */
const DEMO_LICENSE: LicenseState = {
  status: "licensed",
  payload: { customer: "Demo kiOS", issuedAt: "2026-01-01T00:00:00.000Z" },
};

/**
 * Lee la constancia de activación previa. Tolera basura sin romper: si el
 * JSON está corrupto se ignora y se cae a la verificación normal.
 */
async function readActivation(repos: Repositories): Promise<LicensePayload | null> {
  const raw = await repos.meta.get(META_KEYS.licenseActivation);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" && parsed !== null &&
      typeof (parsed as LicensePayload).customer === "string" &&
      typeof (parsed as LicensePayload).issuedAt === "string"
    ) {
      return parsed as LicensePayload;
    }
  } catch {
    // JSON roto: como si no existiera.
  }
  return null;
}

/**
 * Resuelve el estado de licencia de ESTE dispositivo.
 *
 * La verificación criptográfica se exige UNA VEZ, al activar. A partir de
 * ahí queda una constancia en `meta` y la app sigue activada aunque el
 * código deje de verificar — que es exactamente lo que pasa cuando se rota
 * la clave para que los códigos filtrados no sirvan en las descargas
 * nuevas. Sin la constancia, esa rotación le apagaría la app a todos los
 * que ya pagaron, que es lo contrario de lo que se busca.
 *
 * Sí, la constancia es un registro en la base local y alguien técnico puede
 * escribirla a mano. Es el mismo trato que el resto del esquema de
 * licencias (ADR-005): fricción honesta para clientes honestos, sin
 * ofuscación ni phone-home.
 */
async function resolveLicense(repos: Repositories, isDesktop: boolean): Promise<LicenseState> {
  if (!isDesktop) return DEMO_LICENSE;

  const key = await repos.meta.get(META_KEYS.licenseKey);
  const payload = key ? await verifyLicenseKey(key) : null;

  if (payload) {
    // Activación válida ahora: se deja (o refresca) la constancia.
    await repos.meta.set(META_KEYS.licenseActivation, JSON.stringify(payload));
    return { status: "licensed", payload };
  }

  // El código no verifica (rotamos la clave, o está mal pegado). Si esta
  // instalación YA se había activado alguna vez, sigue activada.
  const previous = await readActivation(repos);
  if (previous) return { status: "licensed", payload: previous };

  // Nunca se activó: free en silencio, jamás se rompe la caja.
  return { status: "free" };
}

export interface AppServices extends BootResult {
  licenseState: LicenseState;
  entitlements: Entitlements;
  /**
   * Re-lee y re-valida la licencia (tras pegar una clave nueva). DEVUELVE
   * el estado resuelto: quien activa necesita saber si el código sirvió,
   * y el `licenseState` del contexto todavía trae el valor viejo en ese
   * mismo tick de React.
   */
  refreshLicense: () => Promise<LicenseState>;
}

export type BootState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; services: AppServices };

const AppContext = createContext<AppServices | null>(null);

export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error("useApp fuera de <AppProvider>");
  return services;
}

export function AppProvider({
  children,
  loading,
  error,
}: {
  children: ReactNode;
  loading: ReactNode;
  error: (message: string) => ReactNode;
}) {
  const [boot, setBoot] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; result: BootResult; license: LicenseState }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await bootOnce();
        const license = await resolveLicense(result.repos, result.isDesktop);
        if (!cancelled) setBoot({ status: "ready", result, license });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (!cancelled) setBoot({ status: "error", message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLicense = useCallback(async () => {
    const result = await bootOnce();
    const license = await resolveLicense(result.repos, result.isDesktop);
    setBoot((prev) =>
      prev.status === "ready" ? { ...prev, license } : prev,
    );
    return license;
  }, []);

  const services = useMemo<AppServices | null>(() => {
    if (boot.status !== "ready") return null;
    return {
      ...boot.result,
      licenseState: boot.license,
      entitlements: getEntitlements(boot.license),
      refreshLicense,
    };
  }, [boot, refreshLicense]);

  if (boot.status === "loading") return <>{loading}</>;
  if (boot.status === "error") return <>{error(boot.message)}</>;
  return <AppContext.Provider value={services}>{children}</AppContext.Provider>;
}

/** Hook de conveniencia: las pantallas consumen límites, no licencias. */
export function useEntitlements(): Entitlements {
  return useApp().entitlements;
}
