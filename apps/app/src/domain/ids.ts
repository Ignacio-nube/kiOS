/**
 * UUIDv7 generado en cliente (regla 2 del esquema sync-ready).
 *
 * 48 bits de timestamp en ms + 74 bits aleatorios: ordenable por tiempo
 * (índices B-tree amigables) y globalmente único sin coordinación entre
 * terminales. Sin dependencias: `crypto.getRandomValues` existe en todos
 * los targets (navegador, WebView de Tauri, Node 22 de los tests).
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 9562

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Milisegundos embebidos en un UUIDv7 (para debug y tests). */
export function uuidv7Timestamp(id: string): number {
  return parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}
