/**
 * El código de activación en pantalla, con botón de copiar.
 *
 * Aparece solo cuando el servidor confirmó el pago contra la API de
 * Mercado Pago (ver `api/claim.ts`). Es la garantía de que nadie se queda
 * sin nada habiendo pagado: si el mail no llega —Resend caído, dominio sin
 * verificar, la casilla mal escrita por el propio comprador— el código
 * está acá igual.
 *
 * Son 237 caracteres: copiarlo a mano de la pantalla es inviable, así que
 * el botón de copiar no es una comodidad sino el único uso realista.
 */
import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

export function CodigoActivacion({ licenseKey }: { licenseKey: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopiado(true);
      // Vuelve a "Copiar" solo: sin esto el botón queda mintiendo si el
      // usuario copia otra cosa después.
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles (o http sin TLS): el código igual está
      // seleccionable a mano, así que no hace falta avisar nada.
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-brand/40 bg-brand/[0.07] p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-brand uppercase">
          <KeyRound className="size-3.5" />
          Tu código de activación
        </span>
        <button
          onClick={() => void copiar()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-void px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-brand/50"
        >
          {copiado ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* `break-all` y monoespaciada: son 237 caracteres sin espacios y en
          un celular tienen que poder verse enteros, no cortados. */}
      <code className="block font-mono text-[12px] leading-relaxed break-all text-brand select-all">
        {licenseKey}
      </code>

      <p className="mt-3 text-[13px] leading-relaxed text-dimmer">
        Guardalo. Se pega en <strong className="text-dim">Configuración → Licencia</strong> dentro
        de kiOS y se activa sin internet.
      </p>
    </div>
  );
}
