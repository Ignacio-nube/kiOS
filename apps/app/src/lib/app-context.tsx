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
import { getEntitlements, type Entitlements } from "../domain/entitlements";
import { verifyLicenseKey, type LicenseState } from "../domain/license";

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
    return {
      repos: createRepositories(bundle.driver, ctx),
      isDesktop: bundle.kind === "tauri",
      persisted: bundle.persisted,
    };
  })();
  return bootPromise;
}

async function resolveLicense(repos: Repositories): Promise<LicenseState> {
  const key = await repos.meta.get(META_KEYS.licenseKey);
  if (!key) return { status: "free" };
  const payload = await verifyLicenseKey(key);
  // Clave inválida o de una versión vieja: se degrada a free en silencio,
  // jamás se rompe la caja.
  return payload ? { status: "licensed", payload } : { status: "free" };
}

export interface AppServices extends BootResult {
  licenseState: LicenseState;
  entitlements: Entitlements;
  /** Re-lee y re-valida la licencia (tras pegar una clave nueva). */
  refreshLicense: () => Promise<void>;
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
        const license = await resolveLicense(result.repos);
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
    const license = await resolveLicense(result.repos);
    setBoot((prev) =>
      prev.status === "ready" ? { ...prev, license } : prev,
    );
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
