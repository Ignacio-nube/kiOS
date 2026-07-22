import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../lib/app-context";
import { canAddProduct } from "../../domain/entitlements";
import { stockStatus } from "../../domain/stock";
import type { Category, Product } from "../../data/types";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Money } from "../../ui/money";
import { EmptyState } from "../../ui/empty-state";
import { ListRow, ListRowDetail, ListRowMain, ListRowTitle } from "../../ui/list-row";
import { ProductFormDialog } from "./ProductFormDialog";

const STATUS_BADGE = {
  ok: { tone: "ok", label: "En stock" },
  low: { tone: "warn", label: "Stock bajo" },
  out: { tone: "danger", label: "Sin stock" },
} as const;

export function ProductosScreen({ onGoToActivation }: { onGoToActivation: () => void }) {
  const { repos, entitlements } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const reload = useCallback(async () => {
    const [list, cats, levels] = await Promise.all([
      repos.products.list(),
      repos.products.listCategories(),
      repos.stock.levels(),
    ]);
    setProducts(list);
    setCategories(cats);
    setStockByProduct(new Map(levels.map((l) => [l.productId, l.qty])));
  }, [repos]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = filter.trim() === ""
    ? products
    : products.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase()));

  function handleNuevo() {
    if (!canAddProduct(entitlements, products.length)) {
      toast.warning(`Llegaste al límite de ${entitlements.maxProducts} productos del plan gratuito`, {
        description: "Podés seguir vendiendo y editando lo que ya cargaste. Activá kiOS para sumar productos sin límite.",
        action: { label: "Activar", onClick: onGoToActivation },
      });
      return;
    }
    setEditing(null);
    setDialogOpen(true);
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`¿Dar de baja "${product.name}"? Podés volver a cargarlo después.`)) return;
    await repos.products.softDelete(product.id);
    toast.success("Producto dado de baja");
    void reload();
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Productos</h1>
          {entitlements.maxProducts !== null && (
            <p className="text-sm text-muted-ink">{products.length} / {entitlements.maxProducts} del plan gratuito</p>
          )}
        </div>
        <Button variant="primary" onClick={handleNuevo}>
          <Plus className="size-4" /> Nuevo producto
        </Button>
      </div>

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Buscar por nombre…"
        className="mb-4 max-w-sm"
      />

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={products.length === 0 ? "Todavía no cargaste productos" : "Sin resultados"}
            description={products.length === 0 ? "Cargá tu primer producto para empezar a vender." : undefined}
            action={products.length === 0 && (
              <Button variant="primary" onClick={handleNuevo}>
                <Plus className="size-4" /> Cargar el primero
              </Button>
            )}
          />
        ) : (
          filtered.map((product) => {
            const qty = stockByProduct.get(product.id) ?? 0;
            const status = STATUS_BADGE[stockStatus(qty, product.lowStockThreshold)];
            return (
              <ListRow key={product.id}>
                <ListRowMain>
                  <ListRowTitle>{product.name}</ListRowTitle>
                  <ListRowDetail>{product.barcode ?? "Sin código"}</ListRowDetail>
                </ListRowMain>
                <Badge tone={status.tone}>{status.label} · {qty}</Badge>
                <Money cents={product.priceCents} className="w-24 text-right" />
                <div className="flex items-center gap-1">
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-muted hover:text-ink"
                    onClick={() => { setEditing(product); setDialogOpen(true); }}
                    aria-label="Editar"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-muted-ink hover:bg-danger/10 hover:text-danger"
                    onClick={() => void handleDelete(product)}
                    aria-label="Dar de baja"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </ListRow>
            );
          })
        )}
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        categories={categories}
        onCategoryCreated={(c) => setCategories((prev) => [...prev, c])}
        onSaved={() => {
          setDialogOpen(false);
          void reload();
        }}
      />
    </div>
  );
}
