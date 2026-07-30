/**
 * Reglas puras de cuenta corriente (el fiado del kiosco). El saldo NUNCA es
 * una columna: es la agregación del ledger `customer_account_movements`,
 * mismo patrón que el stock (ADR-004).
 *
 * ⚠ CONVENCIÓN DE SIGNO — es la INVERSA a la del stock, y confundirlas es el
 * bug más fácil de cometer acá:
 *   delta > 0  AUMENTA la deuda (el cliente se llevó algo fiado)
 *   delta < 0  BAJA la deuda (pagó, o se le anuló una venta)
 * Por lo tanto: saldo POSITIVO = el cliente DEBE; saldo NEGATIVO = tiene
 * saldo a favor. (En stock es al revés: negativo es salida de mercadería.)
 */

export type AccountMovementType =
  | "credit_sale"
  | "payment"
  | "adjustment"
  | "void_reversal";

export const ACCOUNT_MOVEMENT_LABELS: Record<AccountMovementType, string> = {
  credit_sale: "Fiado",
  payment: "Pago",
  adjustment: "Ajuste",
  void_reversal: "Venta anulada",
};

/** Saldo = suma del ledger. Positivo = debe. */
export function accountBalance(movements: { deltaCents: number }[]): number {
  return movements.reduce((sum, m) => sum + m.deltaCents, 0);
}

/**
 * Estado del límite de crédito.
 * - `none`: el cliente no tiene límite configurado (nunca se avisa nada).
 * - `ok`: dentro del límite.
 * - `near`: llegó al 80% del límite.
 * - `over`: lo pasó.
 */
export type CreditStatus = "none" | "ok" | "near" | "over";

/** A partir de este porcentaje del límite se avisa "cerca". */
export const CREDIT_NEAR_RATIO = 0.8;

/**
 * ⚠ `"over"` es un AVISO, nunca un bloqueo: la app jamás impide fiar (misma
 * regla que el stock negativo — una venta no se traba frente al cliente).
 * Si estás por escribir `disabled={status === "over"}`, no lo hagas.
 */
export function creditStatus(balanceCents: number, limitCents: number | null): CreditStatus {
  if (limitCents === null) return "none";
  if (balanceCents <= 0) return "ok";
  if (balanceCents >= limitCents) return "over";
  if (balanceCents >= limitCents * CREDIT_NEAR_RATIO) return "near";
  return "ok";
}

/** El estado que TENDRÍA la cuenta si se cierra esta venta fiada. */
export function creditStatusAfter(
  balanceCents: number,
  limitCents: number | null,
  addCents: number,
): CreditStatus {
  return creditStatus(balanceCents + addCents, limitCents);
}

/** Cuánto más puede fiar antes del límite; null = sin límite. Nunca negativo. */
export function availableCredit(balanceCents: number, limitCents: number | null): number | null {
  if (limitCents === null) return null;
  return Math.max(0, limitCents - balanceCents);
}

/** Cómo se lee un saldo en pantalla (el signo por sí solo no se entiende). */
export function balanceLabel(balanceCents: number): "Debe" | "A favor" | "Al día" {
  if (balanceCents > 0) return "Debe";
  if (balanceCents < 0) return "A favor";
  return "Al día";
}

/** Tono del Badge por estado (los tones del design system). */
export const CREDIT_STATUS_TONE: Record<CreditStatus, "neutral" | "ok" | "warn" | "danger"> = {
  none: "neutral",
  ok: "ok",
  near: "warn",
  over: "danger",
};
