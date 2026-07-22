/**
 * Licencias kiOS: código firmado Ed25519, verificable 100% OFFLINE.
 *
 * La clave = "KIOS-" + base32(payload JSON ‖ firma de 64 bytes) en grupos
 * de 5. La app solo lleva la clave PÚBLICA embebida; el firmador es un CLI
 * privado (scripts/license/) cuyo secreto nunca entra al repo.
 *
 * No es DRM: sin ofuscación, sin phone-home. Es fricción honesta para
 * clientes honestos, reversible por un usuario técnico.
 */
import { verifyAsync } from "@noble/ed25519";

/** Clave pública Ed25519 (hex). Se regenera con scripts/license/keygen.mjs. */
export const LICENSE_PUBLIC_KEY_HEX =
  "0000000000000000000000000000000000000000000000000000000000000000"; // PLACEHOLDER: sin clave real emitida aún

export interface LicensePayload {
  /** Nombre del cliente (se muestra en Configuración). */
  customer: string;
  /** ISO-8601 de emisión. */
  issuedAt: string;
  /** Reservado para features futuras; hoy no se interpreta. */
  features?: string[];
}

export type LicenseState =
  | { status: "free" }
  | { status: "licensed"; payload: LicensePayload };

// ── base32 Crockford (sin padding) ──────────────────────────────────────
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.toUpperCase()) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  // Estricto: los bits de relleno del último carácter deben ser cero;
  // si no, dos claves distintas decodificarían a los mismos bytes.
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) return null;
  return new Uint8Array(out);
}

// ── formato de clave ────────────────────────────────────────────────────
const SIGNATURE_BYTES = 64;
const KEY_PREFIX = "KIOS";

/** Usado por el CLI firmador y por los tests; la app solo verifica. */
export function encodeLicenseKey(payloadBytes: Uint8Array, signature: Uint8Array): string {
  const combined = new Uint8Array(payloadBytes.length + signature.length);
  combined.set(payloadBytes);
  combined.set(signature, payloadBytes.length);
  const groups = base32Encode(combined).match(/.{1,5}/g) ?? [];
  return [KEY_PREFIX, ...groups].join("-");
}

/**
 * Verifica una clave contra la clave pública. Devuelve el payload si la
 * firma es válida, null ante cualquier defecto (formato, firma, JSON).
 * Nunca lanza: una clave rota jamás debe romper la caja.
 */
export async function verifyLicenseKey(
  key: string,
  publicKeyHex: string = LICENSE_PUBLIC_KEY_HEX,
): Promise<LicensePayload | null> {
  try {
    const normalized = key.trim().toUpperCase();
    if (!normalized.startsWith(`${KEY_PREFIX}-`)) return null;
    const combined = base32Decode(normalized.slice(KEY_PREFIX.length + 1).replace(/-/g, ""));
    if (!combined || combined.length <= SIGNATURE_BYTES) return null;

    const payloadBytes = combined.slice(0, combined.length - SIGNATURE_BYTES);
    const signature = combined.slice(combined.length - SIGNATURE_BYTES);
    const valid = await verifyAsync(signature, payloadBytes, publicKeyHex);
    if (!valid) return null;

    const parsed: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (
      typeof parsed !== "object" || parsed === null ||
      typeof (parsed as LicensePayload).customer !== "string" ||
      typeof (parsed as LicensePayload).issuedAt !== "string"
    ) {
      return null;
    }
    return parsed as LicensePayload;
  } catch {
    return null;
  }
}
