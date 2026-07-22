/**
 * Contexto que los repositorios estampan en cada fila (reglas 2, 4 y 5
 * del esquema sync-ready). Inyectable: los tests fijan reloj e IDs.
 */
export interface RepoContext {
  tenantId: string;
  deviceId: string;
  /** ISO-8601 UTC. */
  now(): string;
  /** UUIDv7. */
  newId(): string;
}
