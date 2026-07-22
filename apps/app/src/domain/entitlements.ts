/**
 * Entitlements como DATOS, en un único módulo. Las pantallas consumen el
 * objeto `Entitlements` (vía useEntitlements) y jamás preguntan por el
 * estado de la licencia: sumar un límite nuevo = agregar un campo acá,
 * sin tocar UI existente.
 */
import type { LicenseState } from "./license";

export interface Entitlements {
  /** Tope de productos activos; null = sin límite. */
  maxProducts: number | null;
}

const FREE_ENTITLEMENTS: Entitlements = {
  maxProducts: 50,
};

const LICENSED_ENTITLEMENTS: Entitlements = {
  maxProducts: null,
};

export function getEntitlements(state: LicenseState): Entitlements {
  return state.status === "licensed" ? LICENSED_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

/** Helper de dominio para el único límite de v1. */
export function canAddProduct(entitlements: Entitlements, activeProductCount: number): boolean {
  return entitlements.maxProducts === null || activeProductCount < entitlements.maxProducts;
}
