/**
 * Vocabulario de animación de la landing.
 *
 * Una sola curva y tres duraciones para TODA la página: si cada sección
 * inventa su propio easing, el scroll se siente como cinco sitios pegados.
 * La curva es un ease-out fuerte — arranca rápido y frena — que es lo que
 * hace leer un movimiento como "material que llega" y no como "elemento
 * que aparece".
 */
import type { Variants, Transition } from "motion/react";

/** Ease-out expo. Mismo valor que `--ease-out-expo` en el CSS. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DURATION = { fast: 0.35, base: 0.6, slow: 0.9 } as const;

export const spring: Transition = { type: "spring", stiffness: 320, damping: 30 };

/**
 * Reveal al entrar en viewport. `y` chico a propósito: 24px se lee como que
 * el contenido se asienta; 80px se lee como que la página está rota y salta.
 */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE },
  },
};

export const revealFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE } },
};

/** Contenedor que escalona a sus hijos. Usar junto con `revealUp` en cada hijo. */
export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/**
 * `amount: 0.25` en vez del default: con secciones altas, esperar a que
 * entre el 100% significa que el usuario ya la leyó cuando recién arranca
 * la animación. `once` porque re-animar al volver a subir marea.
 */
export const inView = { once: true, amount: 0.25 } as const;
