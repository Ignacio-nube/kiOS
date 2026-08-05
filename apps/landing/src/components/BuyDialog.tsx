/**
 * Los dos datos que hacen falta antes de mandar a Mercado Pago.
 *
 * El mail es a dónde llega el código, y es el único lugar donde va a estar:
 * no hay cuenta de usuario ni panel donde recuperarlo. Por eso el aviso de
 * "revisá que esté bien escrito" está antes del botón y no después.
 *
 * El nombre ya no viaja dentro de la licencia (el código es el mismo para
 * todos), pero se pide igual: encabeza el mail y es el único registro de a
 * quién se le vendió, porque tampoco hay base de datos.
 *
 * Diálogo propio y no Radix: es lo único modal de toda la landing y no
 * justifica la dependencia. Lo que sí hace falta hacer a mano está hecho:
 * Escape cierra, el foco entra al primer campo y el fondo no scrollea.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { isValidEmail, isValidName, startCheckout } from "../lib/checkout";
import { PRICE_ARS, formatARS } from "../lib/config";
import { EASE } from "../lib/motion";

export function BuyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // El body no scrollea detrás del modal.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstField.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const valid = isValidName(name) && isValidEmail(email);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const result = await startCheckout({ name, email });
    if (result.ok) {
      // Mercado Pago se hace cargo desde acá. No se limpia `busy`: la
      // navegación tarda y un botón que vuelve a estar activo invita a
      // apretarlo dos veces, o sea a crear dos pagos.
      window.location.href = result.url;
      return;
    }
    setError(result.message);
    setBusy(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-dimmer transition-colors hover:text-ink"
            >
              <X className="size-5" />
            </button>

            <h2 id="buy-title" className="font-display text-xl font-bold text-chalk">
              Comprar kiOS Activado
            </h2>
            <p className="mt-1.5 text-sm text-dim">
              {formatARS(PRICE_ARS)} · pago único. Te mandamos el código de activación por mail apenas
              se acredite.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="buy-name" className="mb-1.5 block text-sm text-dim">
                  ¿A nombre de quién?
                </label>
                <input
                  id="buy-name"
                  ref={firstField}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Kiosco La Esquina"
                  autoComplete="organization"
                  className="w-full rounded-xl border border-line bg-void px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-faint">Para el mail y el comprobante.</p>
              </div>

              <div>
                <label htmlFor="buy-email" className="mb-1.5 block text-sm text-dim">
                  Tu mail
                </label>
                <input
                  id="buy-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="vos@ejemplo.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-line bg-void px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-faint">
                  Revisá que esté bien escrito: el código llega ahí y a ningún otro lado.
                </p>
              </div>

              {error && (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!valid || busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-bold text-brand-ink transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? "Abriendo Mercado Pago…" : "Ir a pagar"}
              </button>

              <p className="flex items-start gap-2 text-xs text-faint">
                <ShieldCheck className="mt-px size-4 shrink-0" />
                El pago lo cobra Mercado Pago. kiOS no ve ni guarda los datos de tu tarjeta.
              </p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
