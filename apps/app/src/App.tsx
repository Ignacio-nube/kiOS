/**
 * Shell de la app. Fase 0: navegación + pantalla de estado del sistema.
 * Las pantallas reales (Venta, Productos, Stock, Hoy, Configuración)
 * llegan en fase 1 y se montan acá.
 */
import { AppProvider, useApp } from "./lib/app-context";
import { Toaster } from "./ui/shadcn/sonner";
import { Card, CardBody, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

function KiosMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 125 125" role="img" aria-label="kiOS">
      <rect width="125" height="125" rx="28" fill="#FDBF2D" />
      <circle cx="42" cy="27" r="7" fill="#0B0B0C" />
      <path d="M42 45 L42 98" stroke="#0B0B0C" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M48 82 L82 48" stroke="#0B0B0C" strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d="M58 72 L86 98" stroke="#0B0B0C" strokeWidth="11" strokeLinecap="round" fill="none" />
    </svg>
  );
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
    <div className="bg-brand/20 px-4 py-1.5 text-center text-sm font-medium text-ink">
      Demo: los datos {persisted ? "viven solo en este navegador y pueden perderse" : "no se guardan"} —{" "}
      la app de escritorio guarda todo en tu PC.
    </div>
  );
}

function SystemStatus() {
  const { isDesktop, persisted, entitlements } = useApp();
  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6 flex items-center gap-3">
        <KiosMark />
        <div>
          <h1 className="text-xl font-bold tracking-tight">kiOS</h1>
          <p className="text-sm text-muted-ink">Gestión para tu kiosco</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sistema listo</CardTitle>
          <Badge tone="ok">Base de datos abierta</Badge>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p>
            Modo:{" "}
            <span className="font-medium">
              {isDesktop ? "escritorio" : persisted ? "navegador (persistente)" : "navegador (memoria)"}
            </span>
          </p>
          <p>
            Productos permitidos:{" "}
            <span className="font-medium">
              {entitlements.maxProducts === null ? "sin límite" : entitlements.maxProducts}
            </span>
          </p>
          <p className="text-muted-ink">
            La pantalla de venta llega en la fase 1. Esta vista solo confirma que
            la fundación (base, migraciones, identidad y licencia) funciona.
          </p>
        </CardBody>
      </Card>
    </main>
  );
}

export default function App() {
  return (
    <AppProvider loading={<BootScreen />} error={(message) => <BootScreen message={message} />}>
      <div className="flex h-screen flex-col bg-paper">
        <DemoBanner />
        <div className="flex-1 overflow-auto">
          <SystemStatus />
        </div>
      </div>
      <Toaster position="bottom-center" />
    </AppProvider>
  );
}
