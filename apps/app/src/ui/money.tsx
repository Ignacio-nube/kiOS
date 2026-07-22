/**
 * Dinero en pantalla: SIEMPRE tabular, siempre desde centavos enteros.
 * `size="display"` es el total de la pizarra del ticket — el elemento
 * firma de kiOS: enorme, en blanco sobre tinta, como cartel de precio.
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { formatARS, formatARSWhole } from "../domain/money";

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  cents: number;
  size?: "sm" | "md" | "lg" | "display";
  /** Omite ",00" (precios de kiosco suelen ser redondos). */
  whole?: boolean;
}

export function Money({ cents, size = "md", whole = false, className, ...props }: MoneyProps) {
  return (
    <span
      className={cn(
        "tnum",
        size === "sm" && "text-sm",
        size === "md" && "text-base font-medium",
        size === "lg" && "text-2xl font-semibold",
        size === "display" && "text-6xl font-bold tracking-tight",
        className,
      )}
      {...props}
    >
      {whole ? formatARSWhole(cents) : formatARS(cents)}
    </span>
  );
}
