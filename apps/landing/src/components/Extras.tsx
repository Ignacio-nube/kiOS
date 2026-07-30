/**
 * "Y además": lo que la app hace y no entró en las cuatro funciones.
 *
 * Existe porque kiOS creció más rápido que la copy del hero. Fiado, cierre
 * de caja por cajero y exportación a Excel son razones de compra reales
 * para un kiosco de barrio —el fiado, sobre todo— y quedarían invisibles
 * si solo se contaran las cuatro grandes. Van en grilla chica y no como
 * una quinta fila alternada: son argumentos de refuerzo, no de portada.
 */
import { BookUser, Boxes, FileSpreadsheet, Lock, Printer, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Reveal, RevealGroup } from "./Reveal";
import { revealUp, stagger } from "../lib/motion";

const EXTRAS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BookUser,
    title: "Fiado, sin el cuaderno",
    body: "Anotá lo que se llevan y cobrá después. Cada cliente con su cuenta, su saldo y su historial.",
  },
  {
    icon: Users,
    title: "Quién cobró cada venta",
    body: "Cargá a los que atienden y cerrá la caja por cajero al final del turno, sin discutir de memoria.",
  },
  {
    icon: Boxes,
    title: "El stock se lleva solo",
    body: "Cada venta descuenta. Reposiciones, mermas y ajustes quedan anotados con fecha.",
  },
  {
    icon: FileSpreadsheet,
    title: "Tus números en Excel",
    body: "Exportá las ventas del período que quieras para pasárselas a tu contador.",
  },
  {
    icon: Printer,
    title: "Ticket en papel",
    body: "Imprime en cualquier comandera térmica de 80mm, o no imprime nada si no querés.",
  },
  {
    icon: Lock,
    title: "Tus datos en tu PC",
    body: "Todo se guarda en tu computadora. Sin cuentas, sin internet obligatoria, sin que nadie más los vea.",
  },
];

export function Extras() {
  const reduced = useReducedMotion();

  return (
    <section className="mx-auto max-w-[1180px] px-6 py-24 lg:px-10 lg:py-28">
      <Reveal className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="text-gradient text-[clamp(1.75rem,3vw,2.4rem)] font-bold">
          Y además, todo lo que un kiosco necesita
        </h2>
        <p className="mt-4 text-lg text-dim">
          Nada de esto es un plan aparte ni un módulo que se paga: viene adentro.
        </p>
      </Reveal>

      <RevealGroup variants={stagger(0.07)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXTRAS.map(({ icon: Icon, title, body }) => (
          <motion.div
            key={title}
            variants={reduced ? undefined : revealUp}
            className="group rounded-2xl border border-line bg-panel/70 p-6 transition-colors hover:border-brand/35 hover:bg-panel"
          >
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-line bg-void text-brand transition-colors group-hover:border-brand/40">
              <Icon className="size-5" />
            </div>
            <h3 className="font-display text-[17px] font-semibold text-chalk">{title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-dimmer">{body}</p>
          </motion.div>
        ))}
      </RevealGroup>
    </section>
  );
}
