/**
 * Las tres pantallas "de dueño" (las que no se usan atendiendo) en un
 * conmutador de pestañas.
 *
 * Va a ancho completo y no en columna al lado de un texto: son capturas de
 * 1568px llenas de números chicos, y en media página no se lee un solo
 * saldo. Acá se leen, que es todo el punto — un kiosquero decide comprar
 * un sistema de gestión cuando ve SUS números en la pantalla, no cuando le
 * cuentan que hay reportes.
 *
 * El indicador de la pestaña activa se mueve con `layoutId`: Motion
 * interpola entre las posiciones de las dos pestañas en vez de apagar una
 * y prender otra, y eso es lo que hace que se lea como un solo control.
 */
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookUser, BarChart3, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";
import { EASE, spring } from "../lib/motion";

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  src: string;
  alt: string;
  caption: string;
}

const TABS: Tab[] = [
  {
    id: "clientes",
    label: "Fiado",
    icon: BookUser,
    src: "/shots/clientes.webp",
    alt: "Listado de clientes de kiOS con los saldos de cada cuenta",
    caption:
      "Quién te debe, cuánto y desde cuándo. El que se pasó del límite queda marcado — pero podés fiarle igual.",
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart3,
    src: "/shots/reportes.webp",
    alt: "Reportes del mes en kiOS con medios de pago y productos más vendidos",
    caption:
      "Cuánto vendiste, con qué te pagaron y qué se vende solo. El período que quieras, exportable a Excel.",
  },
  {
    id: "cierre",
    label: "Cierre de caja",
    icon: Wallet,
    src: "/shots/cierre.webp",
    alt: "Cierre de caja por cajero en kiOS",
    caption:
      "Lo que tiene que haber en el cajón, cajero por cajero. El fiado otorgado se muestra aparte: no entró plata.",
  },
];

export function Showcase() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(TABS[0]);

  return (
    <section className="border-y border-line-soft bg-pit px-6 py-24 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-[1360px]">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-gradient text-[clamp(1.9rem,3.2vw,2.6rem)] font-bold">
            Todo el negocio a la vista
          </h2>
          <p className="mt-4 text-lg text-dim">
            Cerrás el kiosco y en dos clics sabés cómo te fue. Sin planillas.
          </p>
        </Reveal>

        {/* Las tres pestañas juntas rozan los 340px. En un teléfono angosto
            eso desborda y empuja la página entera a scrollear de costado,
            que es el defecto responsive más difícil de notar y el más
            molesto de sufrir. El contenedor scrollea solo él. */}
        <Reveal className="mb-8 flex justify-center overflow-x-auto px-6 [scrollbar-width:none]">
          <div
            role="tablist"
            aria-label="Pantallas de kiOS"
            className="flex shrink-0 gap-1 rounded-xl border border-line bg-void p-1"
          >
            {TABS.map((tab) => {
              const selected = tab.id === active.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(tab)}
                  className={`relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    selected ? "text-brand-ink" : "text-dim hover:text-ink"
                  }`}
                >
                  {selected && (
                    <motion.span
                      layoutId="showcase-pill"
                      transition={reduced ? { duration: 0 } : spring}
                      className="absolute inset-0 rounded-lg bg-brand"
                    />
                  )}
                  <tab.icon className="relative size-4" />
                  <span className="relative">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_90px_-35px_rgb(0_0_0/0.9)]">
            <div className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="ml-2 text-[13px] text-dimmer">kiOS — {active.label}</span>
            </div>

            {/* `mode="wait"` para que no se solapen dos capturas de distinto
                alto y la caja pegue un salto en el medio de la transición. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={active.id}
                src={active.src}
                alt={active.alt}
                loading="lazy"
                decoding="async"
                initial={reduced ? false : { opacity: 0, scale: 1.015 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="block w-full"
              />
            </AnimatePresence>
          </div>
        </Reveal>

        <Reveal className="mx-auto mt-6 max-w-xl text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={active.id}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="text-[15px] leading-relaxed text-dimmer"
            >
              {active.caption}
            </motion.p>
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
