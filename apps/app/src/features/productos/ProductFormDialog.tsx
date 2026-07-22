import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../../lib/app-context";
import { formatARSWhole, parseARSToCents } from "../../domain/money";
import type { Category, NewProduct, Product } from "../../data/types";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "../../ui/shadcn/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../ui/shadcn/select";

const NO_CATEGORY = "__none__";

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
  onCategoryCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = alta. */
  product: Product | null;
  categories: Category[];
  onSaved: () => void;
  onCategoryCreated: (category: Category) => void;
}) {
  const { repos } = useApp();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [categoryId, setCategoryId] = useState(NO_CATEGORY);
  const [lowStock, setLowStock] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setBarcode(product?.barcode ?? "");
    setPrice(product ? formatARSWhole(product.priceCents).replace(/[^\d,.-]/g, "") : "");
    setCost(product?.costCents != null ? formatARSWhole(product.costCents).replace(/[^\d,.-]/g, "") : "");
    setCategoryId(product?.categoryId ?? NO_CATEGORY);
    setLowStock(product?.lowStockThreshold != null ? String(product.lowStockThreshold) : "");
    setInitialStock("");
    setNewCategoryName("");
    setDuplicateWarning(false);
  }, [open, product]);

  async function checkDuplicate() {
    const trimmed = barcode.trim();
    if (trimmed === "") {
      setDuplicateWarning(false);
      return;
    }
    const dupes = await repos.products.findByBarcodeExcluding(trimmed, product?.id);
    setDuplicateWarning(dupes.length > 0);
  }

  async function handleCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (trimmed === "") return;
    const category = await repos.products.createCategory(trimmed);
    onCategoryCreated(category);
    setCategoryId(category.id);
    setNewCategoryName("");
  }

  async function handleSubmit() {
    const priceCents = parseARSToCents(price);
    if (name.trim() === "" || priceCents === null) {
      toast.error("Revisá el nombre y el precio");
      return;
    }
    const costCents = cost.trim() === "" ? null : parseARSToCents(cost);
    const lowStockThreshold = lowStock.trim() === "" ? null : Number(lowStock);
    const initial = initialStock.trim() === "" ? undefined : Number(initialStock);

    setSaving(true);
    try {
      const base: NewProduct = {
        name: name.trim(),
        barcode: barcode.trim() === "" ? null : barcode.trim(),
        priceCents,
        costCents,
        categoryId: categoryId === NO_CATEGORY ? null : categoryId,
        lowStockThreshold,
      };
      if (product) {
        await repos.products.update(product.id, base);
      } else {
        await repos.products.create({ ...base, initialStock: initial });
      }
      toast.success(product ? "Producto actualizado" : "Producto creado");
      onSaved();
    } catch (cause) {
      toast.error("No se pudo guardar", {
        description: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-ink">Nombre</label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Alfajor de chocolate" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Precio</label>
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$ 0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Costo (opcional)</label>
              <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$ 0" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-ink">Código de barras (opcional)</label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} onBlur={() => void checkDuplicate()} placeholder="7791234567890" />
            {duplicateWarning && (
              <p className="mt-1 text-xs text-warn">
                Ya hay otro producto con este código. Podés guardarlo igual, pero conviene revisar.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-ink">Categoría (opcional)</label>
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Crear categoría nueva…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreateCategory();
                  }
                }}
              />
              <Button variant="outline" onClick={() => void handleCreateCategory()}>Crear</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-ink">Aviso de stock bajo</label>
              <Input inputMode="numeric" value={lowStock} onChange={(e) => setLowStock(e.target.value)} placeholder="Ej: 5" />
            </div>
            {!product && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-ink">Stock inicial</label>
                <Input inputMode="numeric" value={initialStock} onChange={(e) => setInitialStock(e.target.value)} placeholder="0" />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="primary" disabled={saving} onClick={() => void handleSubmit()}>
            {product ? "Guardar cambios" : "Crear producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
