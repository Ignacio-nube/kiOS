/**
 * Shell de la app: rail de navegación + pantalla activa. Sin router: un
 * switch alcanza para 5 pantallas (patrón heredado de kioskito). Abre en
 * Venta, la tarea dominante.
 */
import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { ShoppingCart, Package, Boxes, Receipt, BarChart3, Settings, Users, Maximize2, Minimize2 } from "lucide-react";
import { AppProvider, useApp } from "./lib/app-context";
import { THEME_STORAGE_KEY } from "./lib/theme-options";
// Único origen del logo: logo-kiOS.svg (raíz) → copiado acá por `npm run assets`.
import logoUrl from "./assets/logo.svg";
import { useFullscreen } from "./lib/use-fullscreen";
import { Toaster } from "./ui/shadcn/sonner";
import { ConfirmDialogHost } from "./ui/confirm-dialog";
import { cn } from "./lib/utils";
import { VentaScreen } from "./features/venta/VentaScreen";
import { ProductosScreen } from "./features/productos/ProductosScreen";
import { StockScreen } from "./features/stock/StockScreen";
import { ClientesScreen } from "./features/clientes/ClientesScreen";
import { VentasDiaScreen } from "./features/ventas-dia/VentasDiaScreen";
import { ReportesScreen } from "./features/reportes/ReportesScreen";
import { ConfiguracionScreen, type SectionId } from "./features/configuracion/ConfiguracionScreen";
import { TicketPrintArea } from "./features/impresion/TicketPrintArea";
import { CashierPicker } from "./features/cajeros/CashierPicker";
import { useCashierStore } from "./features/cajeros/cashier-store";

type Screen = "venta" | "productos" | "stock" | "clientes" | "hoy" | "reportes" | "configuracion";

const NAV_ITEMS: { id: Screen; label: string; icon: typeof ShoppingCart }[] = [
  { id: "venta", label: "Venta", icon: ShoppingCart },
  { id: "productos", label: "Productos", icon: Package },
  { id: "stock", label: "Stock", icon: Boxes },
  { id: "clientes", label: "Clientes", icon: Users },
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

function NavRail({
  active,
  onChange,
  onManageCashiers,
}: {
  active: Screen;
  onChange: (screen: Screen) => void;
  onManageCashiers: () => void;
}) {
  const { isFullscreen, toggle } = useFullscreen();

  return (
    <nav className="glass flex w-20 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line py-4">
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

      <CashierPicker onManage={onManageCashiers} />

      <button
        onClick={() => void toggle()}
        className="flex w-16 flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium text-muted-ink transition-colors hover:bg-muted hover:text-ink"
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
  // Sección pedida al entrar a Configuración desde otra pantalla. Objeto
  // nuevo por pedido: dos clics seguidos al mismo destino igual reposicionan.
  const [configRequest, setConfigRequest] = useState<{ section: SectionId } | null>(null);
  const { repos } = useApp();
  const hydrateCashiers = useCashierStore((s) => s.hydrate);

  function goToConfig(section: SectionId) {
    setConfigRequest({ section });
    setScreen("configuracion");
  }

  // Asegura el cajero principal y resuelve cuál está activo. Corre una vez,
  // ya con la base abierta (el shell solo se monta cuando el boot terminó).
  useEffect(() => {
    void hydrateCashiers(repos);
  }, [repos, hydrateCashiers]);

  return (
    <div className="flex h-screen flex-col bg-paper">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <NavRail active={screen} onChange={setScreen} onManageCashiers={() => goToConfig("cajeros")} />
        <div className="min-h-0 flex-1 overflow-auto">
          {screen === "venta" && <VentaScreen />}
          {screen === "productos" && <ProductosScreen onGoToActivation={() => goToConfig("licencia")} />}
          {screen === "stock" && <StockScreen />}
          {screen === "clientes" && <ClientesScreen />}
          {screen === "hoy" && <VentasDiaScreen onGoToReportes={() => setScreen("reportes")} />}
          {screen === "reportes" && <ReportesScreen />}
          {screen === "configuracion" && <ConfiguracionScreen request={configRequest} />}
        </div>
      </div>
      {/* Área de impresión: invisible en pantalla, es lo único que sale en papel. */}
      <TicketPrintArea />
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
        <ConfirmDialogHost />
      </AppProvider>
    </ThemeProvider>
  );
}
