/**
 * Nav sticky. Arranca transparente sobre el hero y toma fondo + borde
 * recién cuando hay contenido pasando por abajo: un vidrio esmerilado
 * permanente sobre el propio hero es un borde que separa la página de nada.
 */
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { demoCta } from "../lib/config";
import { Cta } from "./Cta";

const LINKS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#precios", label: "Precios" },
  { href: "#empezar", label: "Cómo empezar" },
];

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);

  useMotionValueEvent(scrollY, "change", (value) => setSolid(value > 24));

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        solid ? "border-b border-line-soft bg-void/92 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-[1360px] items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <a href="#top" className="flex items-center gap-2.5" aria-label="kiOS, inicio">
          <img src="/logo.svg" alt="" width={34} height={34} className="rounded-lg" />
          <span className="font-display text-xl font-bold tracking-tight text-chalk">kiOS</span>
        </a>

        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[15px] text-dim transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Cta href="#precios" variant="secondary" size="md" className="hidden sm:inline-flex">
            Comprar
          </Cta>
          <Cta state={demoCta()} size="md">
            Probar demo
          </Cta>
        </div>
      </nav>
    </motion.header>
  );
}
