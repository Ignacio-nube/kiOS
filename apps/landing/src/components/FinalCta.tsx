/**
 * Cierre. Es el único bloque ámbar sólido de toda la página: después de
 * scrollear metros de negro, un rectángulo encendido no se puede no ver.
 * El brillo que lo recorre es el gesto de marquesina — y por eso corre
 * despacio y con pausa, no en loop continuo tipo banner.
 */
import { ArrowRight } from "lucide-react";
import { demoCta } from "../lib/config";
import { Reveal } from "./Reveal";

export function FinalCta() {
  const demo = demoCta();

  return (
    <section id="demo" className="px-6 pb-24 lg:px-10">
      <Reveal className="mx-auto max-w-[1180px]">
        <div className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#fdbf2d_0%,#e0a41a_45%,#a8760c_100%)] px-8 py-16 text-center sm:px-16 sm:py-20">
          <div
            aria-hidden
            className="animate-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-white/25 blur-2xl"
          />

          <h2 className="relative text-[clamp(1.75rem,3vw,2.4rem)] font-bold text-brand-ink">
            ¿Querés verlo funcionando ya?
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-lg text-[#4a3a0c]">
            Probá la demo en el navegador, con productos de ejemplo cargados y sin instalar nada.
          </p>

          <a
            href={demo.disabled ? undefined : demo.href}
            title={demo.reason}
            aria-disabled={demo.disabled || undefined}
            target="_blank"
            rel="noreferrer"
            className={`relative mt-9 inline-flex items-center gap-2 rounded-xl bg-void px-8 py-4 font-bold text-ink transition-transform duration-200 hover:-translate-y-0.5 ${
              demo.disabled ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Probar demo ahora
            <ArrowRight className="size-4" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
