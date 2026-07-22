/**
 * Selección de driver en runtime: mismo bundle para escritorio y demo web.
 * `import()` dinámico para que cada target cargue solo su driver (el WASM
 * de sqlite pesa ~1 MB y el escritorio no debe bajarlo).
 *
 * Este módulo es la ÚNICA puerta hacia src/data/drivers para el resto de
 * la app (lo custodia eslint): las pantallas hablan con repositorios.
 */
import type { SqlDriver } from "../driver";

export interface DriverBundle {
  driver: SqlDriver;
  kind: "tauri" | "wasm";
  /** false solo en la demo web sin OPFS: los datos viven en memoria. */
  persisted: boolean;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function createDriver(): Promise<DriverBundle> {
  if (isTauri()) {
    const { createTauriDriver } = await import("./tauri");
    return { driver: await createTauriDriver(), kind: "tauri", persisted: true };
  }
  const { createWasmDriver, wasmPersisted } = await import("./wasm");
  const driver = await createWasmDriver();
  return { driver, kind: "wasm", persisted: wasmPersisted() };
}
