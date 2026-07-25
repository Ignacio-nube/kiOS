/**
 * Shell de la app: rail de navegación + pantalla activa. Sin router: un
 * switch alcanza para 5 pantallas (patrón heredado de kioskito). Abre en
 * Venta, la tarea dominante.
 */
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { ShoppingCart, Package, Boxes, Receipt, BarChart3, Settings, Maximize2, Minimize2 } from "lucide-react";
import { AppProvider, useApp } from "./lib/app-context";
import { THEME_STORAGE_KEY } from "./lib/theme-options";
// Único origen del logo: logo-kiOS.svg (raíz) → copiado acá por `npm run assets`.
import logoUrl from "./assets/logo.svg";
import { useFullscreen } from "./lib/use-fullscreen";
import { Toaster } from "./ui/shadcn/sonner";
import { cn } from "./lib/utils";
import { VentaScreen } from "./features/venta/VentaScreen";
import { ProductosScreen } from "./features/productos/ProductosScreen";
import { StockScreen } from "./features/stock/StockScreen";
import { VentasDiaScreen } from "./features/ventas-dia/VentasDiaScreen";
import { ReportesScreen } from "./features/reportes/ReportesScreen";
import { ConfiguracionScreen } from "./features/configuracion/ConfiguracionScreen";

type Screen = "venta" | "productos" | "stock" | "hoy" | "reportes" | "configuracion";

const NAV_ITEMS: { id: Screen; label: string; icon: typeof ShoppingCart }[] = [
  { id: "venta", label: "Venta", icon: ShoppingCart },
  { id: "productos", label: "Productos", icon: Package },
  { id: "stock", label: "Stock", icon: Boxes },
  { id: "hoy", label: "Hoy", icon: Receipt },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "configuracion", label: "Config.", icon: Settings },
];

function KiosMark({ size = 32 }: { size?: number }) {
  // El logo es un cuadrado ámbar autocontenido: mismo aspecto en los tres
  // temas, sin recolorear. Viene del SVG fuente, no de un dibujo inline.
  return <img src={logoUrl} width={size} height={size} alt="kiOS" draggable={false} />;
}

function BootScreen({ message }: { message?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-paper">
      <KiosMark size={56} />
      {message ? (
        <div className="max-w-md text-center">
          <p className="font-semibold text-danger">No se pudo abrir la base de datos</p>
          <p className="mt-1 text-sm text-muted-ink">{message}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-ink">Abriendo kiOS…</p>
      )}
    </div>
  );
}

function DemoBanner() {
  const { isDesktop, persisted } = useApp();
  if (isDesktop) return null;
  return (
    <div className="shrink-0 bg-brand/20 px-4 py-1.5 text-center text-sm font-medium text-ink">
      Demo: los datos {persisted ? "viven solo en este navegador y pueden perderse" : "no se guardan"} —{" "}
      la app de escritorio guarda todo en tu PC.
    </div>
  );
}

function NavRail({ active, onChange }: { active: Screen; onChange: (screen: Screen) => void }) {
  const { isFullscreen, toggle } = useFullscreen();

  return (
    <nav className="glass flex w-20 shrink-0 flex-col items-center gap-1 border-r border-line py-4">
      <div className="mb-3">
        <KiosMark />
      </div>
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-colors",
            active === id ? "bg-primary text-primary-foreground" : "text-muted-ink hover:bg-muted hover:text-ink",
          )}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}

      <button
        onClick={() => void toggle()}
        className="mt-auto flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium text-muted-ink transition-colors hover:bg-muted hover:text-ink"
        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
      >
        {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        {isFullscreen ? "Salir" : "Ampliar"}
      </button>
    </nav>
  );
}

function Shell() {
  const [screen, setScreen] = useState<Screen>("venta");

  return (
    <div className="flex h-screen flex-col bg-paper">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <NavRail active={screen} onChange={setScreen} />
        <div className="min-h-0 flex-1 overflow-auto">
          {screen === "venta" && <VentaScreen />}
          {screen === "productos" && <ProductosScreen onGoToActivation={() => setScreen("configuracion")} />}
          {screen === "stock" && <StockScreen />}
          {screen === "hoy" && <VentasDiaScreen />}
          {screen === "reportes" && <ReportesScreen />}
          {screen === "configuracion" && <ConfiguracionScreen />}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      themes={["light", "dark", "black"]}
      storageKey={THEME_STORAGE_KEY}
    >
      <AppProvider loading={<BootScreen />} error={(message) => <BootScreen message={message} />}>
        <Shell />
        <Toaster position="bottom-center" />
      </AppProvider>
    </ThemeProvider>
  );
}
