/**
 * Precios: gratis para siempre y un pago único para sacar el límite.
 *
 * La tarjeta destacada es la PAGA, y el badge dice "Sin vencimiento" en vez
 * de "Recomendado" (que era lo que decían las dos en el mockup, lo cual no
 * recomienda nada). El argumento diferencial acá no es cuál conviene: es
 * que no hay mensualidad, que es lo primero que pregunta cualquiera que ya
 * se quemó con un sistema de gestión por suscripción.
 */
import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  FREE_PRODUCT_LIMIT, PRICE_ARS, SALES_MODE, WHATSAPP_DISPLAY,
  downloadCta, formatARS, whatsappLink,
} from "../lib/config";
import { revealUp, stagger } from "../lib/motion";
import { Reveal, RevealGroup } from "./Reveal";
import { Cta } from "./Cta";
import { BuyDialog } from "./BuyDialog";

/**
 * El mensaje con el que arranca el chat. Menciona el producto y el precio
 * para que la conversación empiece donde tiene que empezar: acordar la
 * transferencia, no explicar de nuevo qué se está comprando.
 */
const WHATSAPP_MESSAGE =
  `¡Hola! Quiero comprar kiOS Activado (${formatARS(PRICE_ARS)}). ` +
  "¿Me pasás los datos para la transferencia?";

const FREE = [
  `Hasta ${FREE_PRODUCT_LIMIT} productos cargados`,
  "Venta, ticket y cobro completos",
  "Fiado y cuentas de clientes",
  "Reportes y cierre de caja",
  "Todos los temas de apariencia",
];

const PAID = [
  "Productos ilimitados",
  "Todo lo del plan gratis",
  "Activación por código, sin reinstalar nada",
  "Actualizaciones incluidas",
  "La licencia es tuya para siempre",
];

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] text-dim">
      <Check className="mt-0.5 size-4 shrink-0 text-brand" />
      {children}
    </li>
  );
}

export function Pricing() {
  const reduced = useReducedMotion();
  const [buying, setBuying] = useState(false);

  return (
    <section id="precios" className="mx-auto max-w-[1060px] px-6 py-24 lg:px-10 lg:py-28">
      <Reveal className="mx-auto mb-16 max-w-2xl text-center">
        <h2 className="text-gradient text-[clamp(1.9rem,3.2vw,2.6rem)] font-bold">
          Un plan gratis para arrancar, un pago único para crecer
        </h2>
        <p className="mt-4 text-lg text-dim">
          Sin suscripciones. El código de activación es tuyo para siempre.
        </p>
      </Reveal>

      <RevealGroup variants={stagger(0.12)} className="grid items-stretch gap-6 md:grid-cols-2">
        <motion.div
          variants={reduced ? undefined : revealUp}
          className="flex flex-col rounded-2xl border border-line bg-panel p-8"
        >
          <div className="text-sm font-semibold text-dim">Gratis</div>
          <div className="mt-2 font-display text-5xl font-bold text-chalk">$0</div>
          <div className="mt-1 text-sm text-faint">Para siempre</div>

          <ul className="mt-8 flex-1 space-y-3.5">
            {FREE.map((item) => (
              <Feature key={item}>{item}</Feature>
            ))}
          </ul>

          <Cta state={downloadCta()} variant="secondary" className="mt-8 w-full">
            Descargar gratis para Windows
          </Cta>
        </motion.div>

        <motion.div
          variants={reduced ? undefined : revealUp}
          className="relative flex flex-col rounded-2xl border-2 border-brand bg-panel p-8 shadow-[0_30px_70px_-32px_rgb(253_191_45/0.45)]"
        >
          <div className="absolute -top-3.5 left-8 rounded-md bg-brand px-3 py-1 text-xs font-bold text-brand-ink">
            Sin vencimiento
          </div>

          <div className="text-sm font-semibold text-brand">kiOS Activado</div>
          <div className="tnum mt-2 font-display text-5xl font-bold text-chalk">
            {formatARS(PRICE_ARS)}
          </div>
          <div className="mt-1 text-sm text-faint">Pago único, sin mensualidades</div>

          <ul className="mt-8 flex-1 space-y-3.5">
            {PAID.map((item) => (
              <Feature key={item}>{item}</Feature>
            ))}
          </ul>

          {SALES_MODE === "whatsapp" ? (
            <>
              <a
                href={whatsappLink(WHATSAPP_MESSAGE)}
                target="_blank"
                rel="noreferrer"
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-bold text-brand-ink shadow-[0_8px_30px_-8px_rgb(253_191_45/0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-hover"
              >
                <MessageCircle className="size-[18px]" />
                Comprar por WhatsApp
              </a>
              {/* Decir de antemano que atiende una persona, y con qué
                  número: nadie escribe a un WhatsApp que no sabe de quién
                  es, y menos para mandar plata. */}
              <p className="mt-3 text-center text-xs text-faint">
                Coordinamos la transferencia y te paso el código.
                <br />
                WhatsApp {WHATSAPP_DISPLAY}.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => setBuying(true)}
                className="mt-8 w-full rounded-xl bg-brand py-3.5 font-bold text-brand-ink shadow-[0_8px_30px_-8px_rgb(253_191_45/0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-hover"
              >
                Comprar código de activación
              </button>
              <p className="mt-3 text-center text-xs text-faint">
                Pagás con Mercado Pago y te llega el código por mail.
              </p>
            </>
          )}
        </motion.div>
      </RevealGroup>

      {SALES_MODE === "mercadopago" && (
        <BuyDialog open={buying} onClose={() => setBuying(false)} />
      )}
    </section>
  );
}
