/**
 * Pantalla de vuelta desde Mercado Pago.
 *
 * El código NO se muestra acá, y es a propósito: esta página se abre con
 * los parámetros que MP pone en la URL, sin ninguna prueba de que quien la
 * ve haya pagado. Mostrar la licencia acá sería regalarla a cualquiera que
 * copie el link. El código sale por mail, que es el canal que sí prueba
 * quién es el comprador.
 *
 * Al abrirse dispara la red de seguridad (`/api/claim`): si el webhook de
 * MP no llegó —pasa, y sin dejar rastro— el código se manda igual. El
 * servidor reconsulta el pago contra MP antes de mandar nada.
 */
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Inbox, LifeBuoy, Loader2 } from "lucide-react";
import { SUPPORT_EMAIL, WHATSAPP_DISPLAY, whatsappLink } from "../lib/config";
import { claimLicense, paymentIdFromUrl, type ClaimStatus } from "../lib/claim";
import { CodigoActivacion } from "./CodigoActivacion";

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
    body: `Mandanos un WhatsApp al ${WHATSAPP_DISPLAY} o un mail a ${SUPPORT_EMAIL} con el número de operación de Mercado Pago y lo resolvemos.`,
  },
];

/** Aviso de estado del envío. Solo aparece si hay algo concreto que decir. */
function EstadoDelEnvio({ estado }: { estado: ClaimStatus }) {
  if (estado.kind === "idle") return null;

  const comun = "mt-8 flex items-start gap-3 rounded-2xl border px-5 py-4 text-[15px]";

  if (estado.kind === "checking") {
    return (
      <div className={`${comun} border-line bg-panel/70 text-dim`}>
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-brand" />
        Confirmando el pago…
      </div>
    );
  }

  if (estado.kind === "sent") {
    return (
      <>
        <div className={`${comun} border-ok/30 bg-ok/10 text-ink`}>
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" />
          <span>
            Listo: el código salió a <strong>{estado.email}</strong>. Si no lo ves en unos
            minutos, revisá Spam.
          </span>
        </div>
        {estado.licenseKey && <CodigoActivacion licenseKey={estado.licenseKey} />}
      </>
    );
  }

  // El pago está confirmado pero el mail no salió. Es exactamente el caso
  // para el que existe mostrar el código: el comprador no se queda sin nada.
  if (estado.kind === "email_failed") {
    return (
      <>
        <div className={`${comun} border-brand/30 bg-brand/10 text-ink`}>
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>
            Tu pago está confirmado, pero el mail no pudo salir. No te preocupes: acá abajo
            está tu código. Guardalo ahora.
          </span>
        </div>
        {estado.licenseKey && <CodigoActivacion licenseKey={estado.licenseKey} />}
      </>
    );
  }

  if (estado.kind === "pending") {
    return (
      <div className={`${comun} border-line bg-panel/70 text-dim`}>
        <Clock className="mt-0.5 size-5 shrink-0 text-brand" />
        <span>
          El pago todavía no está acreditado. Apenas Mercado Pago lo confirme, el código
          sale solo a tu mail — no hace falta que hagas nada.
        </span>
      </div>
    );
  }

  // "manual" y "error" terminan en el mismo lugar: que nos escriba. Da lo
  // mismo cuál de los dos fue, y explicarlo solo asusta.
  return (
    <div className={`${comun} border-brand/30 bg-brand/10 text-ink`}>
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-brand" />
      <span>
        No pudimos confirmar el envío automáticamente. Escribinos por{" "}
        <a
          href={whatsappLink("¡Hola! Pagué kiOS y no me llegó el código.")}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          WhatsApp
        </a>{" "}
        con el número de operación y te lo pasamos en el momento.
      </span>
    </div>
  );
}

export function Gracias() {
  const [estado, setEstado] = useState<ClaimStatus>({ kind: "idle" });

  useEffect(() => {
    const paymentId = paymentIdFromUrl(window.location.search);
    // Sin payment_id no hay nada que reclamar: alguien entró a /gracias a
    // mano. Se muestra la página informativa y listo.
    if (!paymentId) return;

    let vigente = true;
    setEstado({ kind: "checking" });
    void claimLicense(paymentId).then((resultado) => {
      if (vigente) setEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, []);

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

      <EstadoDelEnvio estado={estado} />

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
