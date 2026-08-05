/**
 * Reveal al entrar en viewport, con la preferencia de movimiento reducido
 * resuelta en UN solo lugar.
 *
 * `useReducedMotion` de Motion desactiva transforms pero NO la opacidad,
 * así que un `hidden: { opacity: 0 }` sin animar dejaría la página EN
 * BLANCO para quien pidió menos movimiento. Por eso acá, con la preferencia
 * activa, no se renderiza `motion` en absoluto: contenido visible y quieto.
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { inView, revealUp } from "../lib/motion";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Variantes propias; por defecto sube 24px con fade. */
  variants?: Variants;
  /** Retraso extra, para desfasar dos bloques hermanos. */
  delay?: number;
  as?: "div" | "section" | "li" | "header";
}

export function Reveal({
  children,
  className,
  variants = revealUp,
  delay = 0,
  as = "div",
}: RevealProps) {
  const reduced = useReducedMotion();
  const Tag = as;

  if (reduced) return <Tag className={className}>{children}</Tag>;

  const MotionTag = motion[Tag];
  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Igual que `Reveal` pero para el contenedor de una lista escalonada: no
 * anima nada propio, solo orquesta a los hijos que usen `variants`.
 */
export function RevealGroup({
  children,
  className,
  variants,
  as = "div",
}: Omit<RevealProps, "delay"> & { variants: Variants }) {
  const reduced = useReducedMotion();
  const Tag = as;

  if (reduced) return <Tag className={className}>{children}</Tag>;

  const MotionTag = motion[Tag];
  return (
    <MotionTag className={className} variants={variants} initial="hidden" whileInView="show" viewport={inView}>
      {children}
    </MotionTag>
  );
}
