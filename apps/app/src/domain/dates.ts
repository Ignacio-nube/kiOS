/**
 * Rango del día LOCAL del kiosquero, expresado en los límites ISO-UTC
 * que usan las columnas `created_at` (regla: [from, to) semiabierto).
 */
export interface DateRange {
  from: string;
  to: string;
}

export function todayRange(now: Date = new Date()): DateRange {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}
