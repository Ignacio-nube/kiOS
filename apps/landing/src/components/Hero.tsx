/**
 * Hero. Dos columnas: la promesa a la izquierda, la prueba a la derecha.
 *
 * La captura NO sangra por el borde. Se probó y el recorte se comía justo
 * la pizarra del ticket —el total gigante y el botón ámbar, o sea lo único
 * que hay que mirar— a cambio de agrandar la lista de productos, que no
 * dice nada. Acá entra completa aunque quede chica: el detalle legible lo
 * pone la sección "Todo el negocio a la vista", donde las capturas van a
 * ancho completo.
 *
 * El ticket vivo tampoco va acá aunque tiente: la captura ya muestra un
 * ticket cargado, y superponerle otro es contar lo mismo dos veces. Vive
 * en la función 02, donde el argumento es justamente ese.
 */
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Download } from "lucide-react";
import { demoCta, downloadCta } from "../lib/config";
import { stagger, revealUp, EASE } from "../lib/motion";
import { Cta } from "./Cta";
import { AppShot } from "./AppShot";

export function Hero() {
  const reduced = useReducedMotion();
  const Item = reduced ? "div" : motion.div;
  const itemProps = reduced ? {} : { variants: revealUp };

  return (
    <section id="top" className="relative overflow-hidden">
      {/* Foco de luz ámbar donde arranca la lectura. Empieza DEBAJO del nav
          (top-0, no -top-40): el nav es sticky y translúcido, así que un
          halo que se metiera arriba se vería a través de él como una
          mancha marrón al lado del logo, no como luz. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-[-12%] h-[460px] w-[680px] rounded-full bg-brand/12 blur-[120px]"
      />

      <div className="mx-auto grid max-w-[1360px] items-center gap-14 px-6 pt-16 pb-24 lg:grid-cols-[1fr_1.05fr] lg:gap-20 lg:px-10 lg:pt-24 lg:pb-32">
        <motion.div
          variants={reduced ? undefined : stagger(0.09)}
          initial={reduced ? undefined : "hidden"}
          animate={reduced ? undefined : "show"}
        >
          <Item {...itemProps} className="mb-6 flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-raised/60 px-3 py-1 text-[13px] text-dim">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
              </span>
              Sistema de ventas para kioscos y almacenes
            </span>
          </Item>

          <Item {...itemProps}>
            <h1 className="text-gradient text-[clamp(2.4rem,4.6vw,3.7rem)] leading-[1.06] font-bold">
              Cobrá más rápido y controlá tu stock sin dolores de cabeza
            </h1>
          </Item>

          <Item {...itemProps}>
            <p className="mt-6 max-w-lg text-[19px] leading-relaxed text-dim">
              kiOS es el punto de venta pensado para el mostrador real: escaneás el código, se agrega
              solo al ticket y cobrás en segundos.
            </p>
          </Item>

          <Item {...itemProps} className="mt-9 flex flex-wrap gap-3">
            <Cta state={demoCta()}>
              Probar demo en el navegador
              <ArrowRight className="size-4" />
            </Cta>
            <Cta state={downloadCta()} variant="secondary">
              <Download className="size-4" />
              Descargar gratis
            </Cta>
          </Item>

          <Item {...itemProps}>
            <p className="mt-5 text-sm text-faint">
              Sin tarjeta. Sin instalación complicada. Anda en tu PC con Windows.
            </p>
          </Item>
        </motion.div>

        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 40, scale: 0.97 }}
          animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="relative"
        >
          <AppShot
            src="/shots/venta.webp"
            alt="Pantalla de venta de kiOS con el ticket cargado"
            label="kiOS — Venta"
            tilt
            priority
          />
        </motion.div>
      </div>
    </section>
  );
}
