import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { META_KEYS } from "../../data/bootstrap";
import { THEME_OPTIONS } from "../../lib/theme-options";
import { cn } from "../../lib/utils";
import { Card, CardBody, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";

function AparienciaCard() {
  // "theme" es lo elegido; puede no estar montado aún en el primer render
  // (next-themes lee localStorage en un efecto) — se muestra sin selección
  // hasta entonces, evitando parpadeo de "Claro" marcado por error.
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apariencia</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-3 gap-3">
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
        </div>
      </CardBody>
    </Card>
  );
}

export function ConfiguracionScreen() {
  const { repos, licenseState, entitlements, refreshLicense } = useApp();
  const [businessName, setBusinessName] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    void repos.meta.get(META_KEYS.businessName).then((v) => setBusinessName(v ?? ""));
    void repos.products.countActive().then(setProductCount);
  }, [repos]);

  async function saveBusinessName() {
    await repos.meta.set(META_KEYS.businessName, businessName.trim());
    toast.success("Guardado");
  }

  async function activar() {
    if (licenseKey.trim() === "") return;
    setActivating(true);
    try {
      await repos.meta.set(META_KEYS.licenseKey, licenseKey.trim());
      await refreshLicense();
      toast.success("¡Listo! kiOS está activado.");
      setLicenseKey("");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-xl font-bold tracking-tight">Configuración</h1>

      <AparienciaCard />

      <Card>
        <CardHeader>
          <CardTitle>Tu negocio</CardTitle>
        </CardHeader>
        <CardBody className="flex gap-2">
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Nombre del kiosco" />
          <Button variant="outline" onClick={() => void saveBusinessName()}>Guardar</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Licencia</CardTitle>
          {licenseState.status === "licensed" ? (
            <Badge tone="brand">Activado</Badge>
          ) : (
            <Badge tone="neutral">Plan gratuito</Badge>
          )}
        </CardHeader>
        <CardBody className="space-y-4">
          {licenseState.status === "licensed" ? (
            <p className="text-sm">
              Activado a nombre de <span className="font-medium">{licenseState.payload.customer}</span>.
              Sin límite de productos.
            </p>
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
    </div>
  );
}
