/**
 * Configuración como panel de ajustes: un índice de secciones a la izquierda
 * y UNA sección por vez a la derecha. Antes eran seis cards apiladas en la
 * misma pantalla — todo grita a la vez y encontrar algo es scrollear.
 */
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Database, KeyRound, Monitor, Palette, Store, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { META_KEYS } from "../../data/bootstrap";
import { THEME_OPTIONS } from "../../lib/theme-options";
import { cn } from "../../lib/utils";
import { useCashierStore } from "../cajeros/cashier-store";
import { Card, CardBody } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { DatosCard } from "./DatosCard";
import { CajerosCard } from "./CajerosCard";

export type SectionId = "negocio" | "cajeros" | "apariencia" | "licencia" | "datos";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "negocio", label: "Tu negocio", icon: Store },
  { id: "cajeros", label: "Cajeros", icon: Users },
  { id: "apariencia", label: "Apariencia", icon: Palette },
  { id: "licencia", label: "Licencia", icon: KeyRound },
  { id: "datos", label: "Datos", icon: Database },
];

/** Encabezado de la sección activa: título grande + para qué sirve. */
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-ink">{description}</p>
    </header>
  );
}

function AparienciaSection() {
  // "theme" es lo elegido; puede no estar montado aún en el primer render
  // (next-themes lee localStorage en un efecto) — se muestra sin selección
  // hasta entonces, evitando parpadeo de "Claro" marcado por error.
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEME_OPTIONS.map((opt) => {
            const selected = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={cn(
                  "rounded-xl border-2 p-2.5 text-left transition-colors",
                  selected ? "border-brand" : "border-line hover:border-muted-ink",
                )}
                style={{ background: opt.paper }}
              >
                <div className="mb-2 flex h-10 items-center justify-end rounded-lg p-1.5" style={{ background: opt.surface }}>
                  {selected && <Check className="size-4" style={{ color: opt.ink }} />}
                </div>
                <span className="text-sm font-medium" style={{ color: opt.ink }}>{opt.label}</span>
              </button>
            );
          })}

          {/* Sistema: sigue el SO (claro/oscuro). Preview partido en diagonal;
              el fondo y la etiqueta usan tokens para leerse en cualquier tema. */}
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "rounded-xl border-2 bg-secondary p-2.5 text-left transition-colors",
              theme === "system" ? "border-brand" : "border-line hover:border-muted-ink",
            )}
          >
            <div
              className="mb-2 flex h-10 items-center justify-center overflow-hidden rounded-lg"
              style={{ background: "linear-gradient(135deg, #f2f2f7 0 50%, #0b0b0c 50% 100%)" }}
            >
              <Monitor className="size-5 text-muted-ink" />
            </div>
            <span className="text-sm font-medium text-ink">Sistema</span>
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * `request` viene de quien navegó hasta acá queriendo una sección puntual
 * ("Gestionar cajeros…", el aviso de límite de productos). Es un objeto
 * nuevo en cada pedido a propósito: así el efecto vuelve a correr aunque se
 * pida dos veces la misma sección.
 */
export function ConfiguracionScreen({ request }: { request?: { section: SectionId } | null }) {
  const { repos, licenseState, entitlements, refreshLicense } = useApp();
  const [section, setSection] = useState<SectionId>(request?.section ?? "negocio");
  const [businessName, setBusinessName] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const cashierCount = useCashierStore((s) => s.cashiers.length);

  const refreshProductCount = useCallback(() => {
    void repos.products.countActive().then(setProductCount);
  }, [repos]);

  useEffect(() => {
    void repos.meta.get(META_KEYS.businessName).then((v) => setBusinessName(v ?? ""));
    refreshProductCount();
  }, [repos, refreshProductCount]);

  useEffect(() => {
    if (request) setSection(request.section);
  }, [request]);

  async function saveBusinessName() {
    await repos.meta.set(META_KEYS.businessName, businessName.trim());
    toast.success("Guardado");
  }

  async function activar() {
    const pegado = licenseKey.trim();
    if (pegado === "") return;
    setActivating(true);
    try {
      await repos.meta.set(META_KEYS.licenseKey, pegado);
      // Se mira el resultado en vez de cantar victoria: antes, pegar
      // cualquier cosa mostraba "¡Listo! kiOS está activado" y la app
      // seguía en plan gratis, sin ninguna pista de qué había pasado.
      const estado = await refreshLicense();
      if (estado.status === "licensed") {
        toast.success("¡Listo! kiOS está activado.");
        setLicenseKey("");
      } else {
        // El código queda escrito en el campo a propósito: casi siempre es
        // un copiado incompleto y así se ve dónde se cortó.
        toast.error("Ese código no es válido", {
          description: "Revisá que lo hayas copiado entero, desde KIOS- hasta el final.",
        });
      }
    } finally {
      setActivating(false);
    }
  }

  return (
    // Ancho acotado (un formulario estirado a 1400px es ilegible) pero
    // alineado a la izquierda, no centrado: así el título arranca en la misma
    // columna que en Stock, Productos y el resto.
    <div className="max-w-5xl p-6">
      <h1 className="mb-5 text-xl font-bold tracking-tight">Configuración</h1>

      {/* En pantallas chicas el índice se vuelve una fila que scrollea; en
          grandes es una columna fija que acompaña al contenido. */}
      <div className="grid gap-5 md:grid-cols-[13rem_1fr] md:items-start">
        <nav
          aria-label="Secciones de configuración"
          className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0"
        >
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors md:w-full",
                  active
                    ? "bg-muted font-semibold text-ink"
                    : "text-muted-ink hover:bg-muted/60 hover:text-ink",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {section === "negocio" && (
            <>
              <SectionHeader
                title="Tu negocio"
                description="El nombre que sale impreso en los tickets."
              />
              <Card>
                <CardBody className="flex gap-2">
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Nombre del kiosco"
                    onKeyDown={(e) => { if (e.key === "Enter") void saveBusinessName(); }}
                  />
                  <Button variant="outline" onClick={() => void saveBusinessName()}>Guardar</Button>
                </CardBody>
              </Card>
            </>
          )}

          {section === "cajeros" && (
            <>
              <SectionHeader
                title="Cajeros"
                description={
                  cashierCount === 1
                    ? "1 cajero cargado. Cada venta queda registrada con su nombre."
                    : `${cashierCount} cajeros cargados. Cada venta queda registrada con su nombre.`
                }
              />
              <CajerosCard />
            </>
          )}

          {section === "apariencia" && (
            <>
              <SectionHeader
                title="Apariencia"
                description="Cómo se ve kiOS en esta computadora. No afecta a las demás."
              />
              <AparienciaSection />
            </>
          )}

          {section === "licencia" && (
            <>
              <SectionHeader
                title="Licencia"
                description="Tu plan actual y la activación de kiOS."
              />
              <Card>
                <CardBody className="space-y-4">
                  <div className="flex items-center gap-2">
                    {licenseState.status === "licensed" ? (
                      <Badge tone="brand">Activado</Badge>
                    ) : (
                      <Badge tone="neutral">Plan gratuito</Badge>
                    )}
                  </div>

                  {licenseState.status === "licensed" ? (
                    <div className="space-y-1.5 text-sm">
                      <p>
                        Activado a nombre de{" "}
                        <span className="font-medium">{licenseState.payload.customer}</span>.
                        Sin límite de productos.
                      </p>
                      {/* La activación es de por vida y no consulta nada: la
                          firma se verifica con la clave que la app ya trae.
                          Decirlo saca la duda de "¿y si me quedo sin internet
                          se me apaga?", que es la pregunta que más aparece. */}
                      <p className="text-muted-ink">
                        No vence y no necesita internet para seguir funcionando.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-ink">
                        {productCount} de {entitlements.maxProducts} productos usados. Activá kiOS para sumar
                        productos sin límite.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          value={licenseKey}
                          onChange={(e) => setLicenseKey(e.target.value)}
                          placeholder="KIOS-XXXXX-XXXXX-…"
                          onKeyDown={(e) => { if (e.key === "Enter") void activar(); }}
                        />
                        <Button variant="primary" disabled={activating} onClick={() => void activar()}>
                          Activar
                        </Button>
                      </div>
                    </>
                  )}
                </CardBody>
              </Card>
            </>
          )}

          {section === "datos" && (
            <>
              <SectionHeader
                title="Datos"
                description="Cargar datos de prueba, liberar espacio o empezar de cero."
              />
              <DatosCard onChanged={refreshProductCount} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
