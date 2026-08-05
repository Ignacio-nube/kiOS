/**
 * Pantalla de vuelta desde Mercado Pago.
 *
 * El código NO se muestra acá, y es a propósito: esta página se abre con
 * los parámetros que MP pone en la URL, sin ninguna prueba de que quien la
 * ve haya pagado. Mostrar la licencia acá sería regalarla a cualquiera que
 * copie el link. El código sale por mail, que es el canal que sí prueba
 * quién es el comprador.
 *
 * Lo que sí hace es contener la ansiedad de los primeros minutos: dice
 * cuánto puede tardar, adónde mirar, y qué hacer si no llega — porque el
 * que acaba de pagar $35.000 y no ve nada, escribe.
 */
import { CheckCircle2, Clock, Inbox, LifeBuoy } from "lucide-react";
import { SUPPORT_EMAIL } from "../lib/config";

const PASOS = [
  {
    icon: Inbox,
    title: "Fijate en tu casilla",
    body: "Te mandamos el código de activación al mail que pusiste en la compra. Revisá también Spam o Promociones.",
  },
  {
    icon: Clock,
    title: "Suele llegar en minutos",
    body: "Depende de cuándo Mercado Pago acredite el pago. Con tarjeta es casi inmediato; con otros medios puede tardar más.",
  },
  {
    icon: LifeBuoy,
    title: "Si no llega, escribinos",
    body: `Mandanos un mail a ${SUPPORT_EMAIL} con el número de operación de Mercado Pago y lo resolvemos.`,
  },
];

export function Gracias() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-20">
      <div className="mb-8 flex size-14 items-center justify-center rounded-2xl bg-brand text-brand-ink">
        <CheckCircle2 className="size-7" />
      </div>

      <h1 className="text-gradient text-[clamp(2rem,4vw,2.8rem)] font-bold">
        ¡Gracias por comprar kiOS!
      </h1>
      <p className="mt-4 text-lg text-dim">
        Tu código de activación va camino a tu mail. Es tuyo para siempre: no vence ni se renueva.
      </p>

      <ul className="mt-10 space-y-4">
        {PASOS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4 rounded-2xl border border-line bg-panel/70 p-5">
            <Icon className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <h2 className="font-display font-semibold text-chalk">{title}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-dimmer">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <a
        href="/"
        className="mt-10 self-start text-[15px] text-dim underline underline-offset-4 transition-colors hover:text-ink"
      >
        Volver al inicio
      </a>
    </main>
  );
}
