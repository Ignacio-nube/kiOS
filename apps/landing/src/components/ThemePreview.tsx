/**
 * Los cuatro temas de kiOS, elegibles acá mismo.
 *
 * Es una recreación, no una captura: un screenshot del selector muestra
 * cuál eligió el que sacó la foto. Acá el visitante toca y ve el cambio,
 * que es exactamente lo que la función hace en la app.
 *
 * Los colores salen de los tokens reales de `apps/app/src/index.css`. Si
 * allá cambian, acá quedan viejos — es el precio de no depender de una
 * captura, y por eso están anotados con su nombre de token.
 */
import { useState } from "react";
import { motion } from "motion/react";
import { Check, Monitor } from "lucide-react";
import { spring } from "../lib/motion";

interface Theme {
  id: string;
  label: string;
  /** --paper */
  paper: string;
  /** --surface */
  surface: string;
  /** --ink */
  ink: string;
}

const THEMES: Theme[] = [
  { id: "light", label: "Claro", paper: "#F2F2F7", surface: "#FFFFFF", ink: "#0B0B0C" },
  { id: "dark", label: "Oscuro", paper: "#0B0B0C", surface: "#1C1C1E", ink: "#F2F2F7" },
  { id: "black", label: "Negro", paper: "#000000", surface: "#121212", ink: "#F2F2F7" },
];

export function ThemePreview() {
  const [selected, setSelected] = useState("light");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {THEMES.map((theme) => {
        const active = selected === theme.id;
        return (
          <button
            key={theme.id}
            onClick={() => setSelected(theme.id)}
            aria-pressed={active}
            className={`relative rounded-xl border-2 p-2.5 text-left transition-colors ${
              active ? "border-brand" : "border-line hover:border-dimmer"
            }`}
            style={{ background: theme.paper }}
          >
            <div
              className="mb-2 flex h-11 items-center justify-end rounded-lg p-1.5"
              style={{ background: theme.surface }}
            >
              {active && (
                <motion.span layoutId="theme-check" transition={spring}>
                  <Check className="size-4" style={{ color: theme.ink }} />
                </motion.span>
              )}
            </div>
            <span className="text-sm font-medium" style={{ color: theme.ink }}>
              {theme.label}
            </span>
          </button>
        );
      })}

      {/* "Sistema" sigue al SO. Preview partido en diagonal, igual que en la app. */}
      <button
        onClick={() => setSelected("system")}
        aria-pressed={selected === "system"}
        className={`rounded-xl border-2 bg-raised p-2.5 text-left transition-colors ${
          selected === "system" ? "border-brand" : "border-line hover:border-dimmer"
        }`}
      >
        <div
          className="mb-2 flex h-11 items-center justify-center overflow-hidden rounded-lg"
          style={{ background: "linear-gradient(135deg,#f2f2f7 0 50%,#0b0b0c 50% 100%)" }}
        >
          {selected === "system" ? (
            <motion.span layoutId="theme-check" transition={spring}>
              <Check className="size-4 text-dimmer" />
            </motion.span>
          ) : (
            <Monitor className="size-5 text-dimmer" />
          )}
        </div>
        <span className="text-sm font-medium text-ink">Sistema</span>
      </button>
    </div>
  );
}
