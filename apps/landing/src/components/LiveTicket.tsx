/**
 * La pizarra del ticket, viva.
 *
 * Es el elemento firma del design system (panel oscuro, TOTAL enorme) y acá
 * hace algo que una captura no puede: MOSTRAR el argumento. La frase "el
 * código de barras funciona como teclado" se entiende en un segundo viendo
 * caer los renglones solos y el total saltar; en una captura estática hay
 * que creerle al texto.
 *
 * Los números son los mismos que salen en la captura de la app (Alfajor
 * triple ×2, Gaseosa, Chicles = $5.800): si alguien compara la animación
 * con el screenshot de al lado, cierran.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ScanLine } from "lucide-react";
import { EASE, spring } from "../lib/motion";

interface Line {
  name: string;
  qty: number;
  cents: number;
}

const LINES: Line[] = [
  { name: "Alfajor triple", qty: 2, cents: 320_000 },
  { name: "Gaseosa cola 500ml", qty: 1, cents: 190_000 },
  { name: "Chicles menta", qty: 1, cents: 70_000 },
];

/** Igual que `formatARS` de la app: centavos enteros, es-AR, dos decimales. */
const money = (cents: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(cents / 100);

/**
 * El resorte que anima el total pasa por valores intermedios con decimales,
 * y formatearlos crudo escupía cosas como "$ 5.177,64" — centavos que no
 * existen en ningún precio del ticket. Un número de plata con basura atrás
 * lee como error de cálculo, que es lo último que puede parecer una caja.
 * Se redondea a pesos enteros mientras viaja; el valor final es exacto
 * igual porque todos los precios son múltiplos de 100 centavos.
 */
const moneyRounded = (cents: number) => money(Math.round(cents / 100) * 100);

const STEP_MS = 1100;
const HOLD_MS = 2600;

export function LiveTicket({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  // Con movimiento reducido el ticket arranca —y se queda— completo.
  const [shown, setShown] = useState(reduced ? LINES.length : 0);

  const target = useMotionValue(0);
  const eased = useSpring(target, { stiffness: 120, damping: 18 });
  const totalText = useTransform(eased, moneyRounded);

  const total = LINES.slice(0, shown).reduce((sum, line) => sum + line.cents, 0);
  const complete = shown === LINES.length;

  useEffect(() => {
    target.set(total);
  }, [target, total]);

  useEffect(() => {
    if (reduced) return;
    // Al llegar al final se queda un rato con el total puesto (que es el
    // momento que vale la pena mirar) y recién ahí vuelve a empezar.
    const delay = complete ? HOLD_MS : STEP_MS;
    const timer = setTimeout(() => setShown((n) => (n === LINES.length ? 0 : n + 1)), delay);
    return () => clearTimeout(timer);
  }, [shown, complete, reduced]);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-line bg-[#0e0d0a] p-5 shadow-[0_30px_70px_-25px_rgb(0_0_0/0.9)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-dimmer uppercase">Ticket</span>
        <span className="flex items-center gap-1.5 text-[11px] text-dimmer">
          <ScanLine className="size-3.5" />
          {complete ? "Listo para cobrar" : "Esperando lectura…"}
        </span>
      </div>

      {/* Alto fijo: sin esto la tarjeta crece y encoge en cada vuelta del
          loop y empuja a todo lo que tenga al lado. */}
      <ul className="mt-4 min-h-[132px] space-y-2.5">
        <AnimatePresence initial={false}>
          {LINES.slice(0, shown).map((line) => (
            <motion.li
              key={line.name}
              layout
              initial={reduced ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <span className="truncate text-ink">
                {line.name}
                {line.qty > 1 && <span className="text-dimmer"> ×{line.qty}</span>}
              </span>
              <span className="tnum shrink-0 text-dim">{money(line.cents)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-[11px] text-dimmer">Total</p>
        {/* El "pop" del total al escanear: el único movimiento que el design
            system nombra explícitamente como permitido en la app. */}
        <motion.p
          key={shown}
          initial={reduced ? false : { scale: 0.94 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="tnum origin-left font-display text-4xl font-bold text-chalk"
        >
          <motion.span>{totalText}</motion.span>
        </motion.p>
      </div>

      <div
        className={`mt-4 rounded-xl py-3 text-center text-[15px] font-bold transition-colors duration-300 ${
          complete ? "bg-brand text-brand-ink" : "bg-brand/25 text-brand/60"
        }`}
      >
        Cobrar
      </div>
    </div>
  );
}
