/**
 * Las cuatro funciones, en filas alternadas.
 *
 * Dos de las cuatro NO usan captura sino el componente vivo (el ticket que
 * se carga solo, los temas que se pueden tocar). Es la diferencia entre
 * contar una función y dejar que el visitante la use antes de instalar
 * nada — y de paso evita cuatro capturas que envejecen a distinta velocidad
 * que la app.
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Reveal } from "./Reveal";
import { AppShot } from "./AppShot";
import { LiveTicket } from "./LiveTicket";
import { ThemePreview } from "./ThemePreview";

interface Feature {
  n: string;
  title: string;
  body: string;
  visual: ReactNode;
  /** El visual va a la izquierda; el texto, a la derecha. */
  flip?: boolean;
}

const FEATURES: Feature[] = [
  {
    n: "01",
    title: "Cargá tus productos en segundos",
    body: "Nombre, precio, costo y código de barras. kiOS avisa solo cuando se te está por acabar el stock de algo.",
    visual: (
      <AppShot
        src="/shots/producto.webp"
        alt="Formulario de alta de producto en kiOS"
        label="kiOS — Productos"
      />
    ),
  },
  {
    n: "02",
    title: "El código de barras funciona como teclado",
    body: "Escaneá y el producto se agrega solo al ticket. Si no tenés el lector a mano, lo buscás por nombre.",
    visual: (
      <div className="mx-auto w-full max-w-[340px]">
        <LiveTicket />
      </div>
    ),
    flip: true,
  },
  {
    n: "03",
    title: "Cobrá y calculá el vuelto sin errores",
    body: "Elegí el medio de pago, ingresá lo que te dieron y kiOS calcula el vuelto al instante.",
    visual: (
      <AppShot src="/shots/cobrar.webp" alt="Cobro y cálculo de vuelto en kiOS" label="kiOS — Cobrar" />
    ),
  },
  {
    n: "04",
    title: "A tu manera, con el tema que prefieras",
    body: "Elegí claro, oscuro, negro o que siga el sistema. Y ponele el nombre de tu negocio a la app. Probalos acá:",
    visual: <ThemePreview />,
    flip: true,
  },
];

function FeatureRow({ feature }: { feature: Feature }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Parallax muy corto (28px en todo el recorrido). Lo justo para que las
  // columnas no viajen pegadas; más que eso y se nota el truco.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [18, -18]);

  return (
    <div
      ref={ref}
      className="grid items-center gap-12 py-14 lg:grid-cols-2 lg:gap-20 lg:py-20"
    >
      <Reveal className={feature.flip ? "lg:order-2" : undefined}>
        <div className="mb-3.5 font-display text-sm font-semibold text-brand">{feature.n}</div>
        <h3 className="text-[clamp(1.5rem,2.4vw,1.85rem)] font-semibold text-chalk">{feature.title}</h3>
        <p className="mt-3.5 max-w-md text-[17px] leading-relaxed text-dim">{feature.body}</p>
      </Reveal>

      <motion.div style={reduced ? undefined : { y }} className={feature.flip ? "lg:order-1" : undefined}>
        <Reveal delay={0.08}>{feature.visual}</Reveal>
      </motion.div>
    </div>
  );
}

export function Features() {
  return (
    <section id="funciones" className="mx-auto max-w-[1180px] px-6 py-20 lg:px-10 lg:py-28">
      {/* `max-w-3xl` y no `2xl`: con el ancho anterior el balanceo de líneas
          partía la frase en "para el día / a día", que se lee como un error
          de tipeo. Un título tiene que poder quebrarse donde uno respira. */}
      <Reveal className="mx-auto mb-6 max-w-3xl text-center">
        <h2 className="text-gradient text-[clamp(1.9rem,3.2vw,2.6rem)] font-bold">
          Pensado para el día a día del mostrador
        </h2>
        <p className="mt-4 text-lg text-dim">Cuatro cosas que tenés que poder hacer rápido, sin vueltas.</p>
      </Reveal>

      {FEATURES.map((feature) => (
        <FeatureRow key={feature.n} feature={feature} />
      ))}
    </section>
  );
}
