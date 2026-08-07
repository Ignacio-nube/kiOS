import { MessageCircle } from "lucide-react";
import { SALES_MODE, SUPPORT_EMAIL, WHATSAPP_DISPLAY, whatsappLink } from "../lib/config";

const LINKS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#precios", label: "Precios" },
  { href: "#empezar", label: "Cómo empezar" },
  { href: "#demo", label: "Demo" },
];

const SOPORTE_MESSAGE = "¡Hola! Tengo una consulta sobre kiOS.";

export function Footer() {
  return (
    <footer className="border-t border-line-soft px-6 py-12 lg:px-10">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="" width={26} height={26} className="rounded-md" />
          <span className="font-display font-bold text-ink">kiOS</span>
          <span className="text-sm text-faint">
            — punto de venta para kioscos y almacenes.
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-7">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-dimmer transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}

          {/* Mientras se venda a mano, el soporte es el mismo WhatsApp por
              el que se compra. Un `mailto:` a una casilla del dominio sería
              un contacto muerto hasta que el mail esté configurado, y un
              contacto muerto es peor que ninguno. */}
          {SALES_MODE === "whatsapp" ? (
            <a
              href={whatsappLink(SOPORTE_MESSAGE)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-dimmer transition-colors hover:text-ink"
            >
              <MessageCircle className="size-4" />
              {WHATSAPP_DISPLAY}
            </a>
          ) : (
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-sm text-dimmer transition-colors hover:text-ink"
            >
              Soporte
            </a>
          )}
        </nav>

        <p className="text-[13px] text-faint">© {new Date().getFullYear()} kiOS.</p>
      </div>
    </footer>
  );
}
