/**
 * Los tres pasos para empezar.
 *
 * La línea que une los números se DIBUJA al entrar en viewport, de
 * izquierda a derecha. No es adorno: es la que convierte tres tarjetas
 * sueltas en una secuencia, y refuerza la promesa del título ("te lleva
 * tres minutos") mostrando que el camino es corto y en una sola dirección.
 */
import { motion, useReducedMotion } from "motion/react";
import { Reveal, RevealGroup } from "./Reveal";
import { revealUp, stagger, EASE } from "../lib/motion";

const STEPS = [
  {
    n: "1",
    title: "Descargá kiOS gratis",
    body: "Instalalo en tu PC con Windows en un par de minutos.",
  },
  {
    n: "2",
    title: "Cargá tus productos",
    body: "Nombre, precio y código de barras. En minutos tenés tu kiosco listo para vender.",
  },
  {
    n: "3",
    title: "Activá cuando quieras crecer",
    body: "Sacate el límite de productos con un solo pago, sin mensualidades.",
  },
];

export function Steps() {
  const reduced = useReducedMotion();

  return (
    <section
      id="empezar"
      className="border-y border-line-soft bg-pit px-6 py-24 lg:px-10 lg:py-28"
    >
      <div className="mx-auto max-w-[1100px]">
        <Reveal className="mb-16 text-center">
          <h2 className="text-gradient text-[clamp(1.75rem,3vw,2.4rem)] font-bold">
            Empezar te lleva tres minutos
          </h2>
        </Reveal>

        <div className="relative">
          {/* La línea vive detrás de los números y solo existe cuando las
              tres columnas están una al lado de la otra. Apilado en móvil,
              una línea horizontal no uniría nada. */}
          <div className="absolute top-7 right-[16%] left-[16%] hidden md:block">
            <motion.div
              className="h-px origin-left bg-gradient-to-r from-brand/60 via-brand/30 to-transparent"
              initial={reduced ? undefined : { scaleX: 0 }}
              whileInView={reduced ? undefined : { scaleX: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
            />
          </div>

          <RevealGroup variants={stagger(0.14)} className="relative grid gap-12 md:grid-cols-3 md:gap-10">
            {STEPS.map((step) => (
              <motion.div key={step.n} variants={reduced ? undefined : revealUp}>
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-line bg-void font-display text-2xl font-bold text-brand">
                  {step.n}
                </div>
                <h3 className="text-lg font-semibold text-chalk">{step.title}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-dimmer">{step.body}</p>
              </motion.div>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
