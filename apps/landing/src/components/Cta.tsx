/**
 * Los enlaces de acción de la landing.
 *
 * Un CTA sin URL (todavía no hay demo publicada, todavía no hay instalador)
 * NO se esconde: se muestra apagado y con el motivo en el tooltip. Esconderlo
 * cambiaría la composición de la página según variables de entorno, que es
 * la clase de diferencia entre "lo vi en dev" y "lo ve el cliente" que
 * después no se explica.
 */
import type { ReactNode } from "react";
import type { CtaState } from "../lib/config";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-3";

const VARIANTS: Record<Variant, string> = {
  // El ámbar sólido con texto oscuro: el par de contraste del design system.
  primary:
    "bg-brand text-brand-ink shadow-[0_8px_30px_-8px_rgb(253_191_45/0.55)] " +
    "hover:bg-brand-hover hover:shadow-[0_10px_38px_-8px_rgb(253_191_45/0.7)] hover:-translate-y-0.5",
  secondary:
    "border border-line bg-raised/50 text-ink hover:border-dimmer hover:bg-raised hover:-translate-y-0.5",
  ghost: "text-dim hover:text-ink",
};

const SIZES = { md: "px-5 py-2.5 text-[15px]", lg: "px-6 py-3.5 text-base" };

interface CtaProps {
  state?: CtaState;
  href?: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}

export function Cta({
  state,
  href,
  variant = "primary",
  size = "lg",
  className = "",
  children,
}: CtaProps) {
  const target = state?.href ?? href ?? "#";
  const disabled = state?.disabled ?? false;
  // Los anclas internos no salen a ningún lado; el resto sí.
  const external = target.startsWith("http");

  return (
    <a
      href={disabled ? undefined : target}
      title={state?.reason}
      aria-disabled={disabled || undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${
        disabled ? "pointer-events-none opacity-40 saturate-50" : ""
      } ${className}`}
    >
      {children}
    </a>
  );
}
