import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { META_KEYS } from "../../data/bootstrap";
import { Card, CardBody, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";

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
