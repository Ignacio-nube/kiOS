import { SUPPORT_EMAIL } from "../lib/config";

const LINKS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#precios", label: "Precios" },
  { href: "#empezar", label: "Cómo empezar" },
  { href: "#demo", label: "Demo" },
];

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

        <nav className="flex flex-wrap gap-7">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-dimmer transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm text-dimmer transition-colors hover:text-ink"
          >
            Soporte
          </a>
        </nav>

        <p className="text-[13px] text-faint">© {new Date().getFullYear()} kiOS.</p>
      </div>
    </footer>
  );
}
